const { chromium } = require('/tmp/live-board-pw/node_modules/playwright');

const mockSupabaseScript = `
(() => {
  const calls = [];
  window.__liveBoardMockCalls = calls;

  function rowFrom(params = {}) {
    return {
      fen: params.p_fen || '8/8/8/8/8/8/8/8 w - - 0 1',
      pgn: params.p_pgn || '',
      orientation: params.p_orientation || 'white',
      last_move: params.p_last_move || null,
      student_moves_allowed: params.p_student_moves_allowed !== false,
      revision: Number(params.p_expected_revision || 0) + 1,
      active_lesson_id: params.p_active_lesson_id || ''
    };
  }

  function createChannel() {
    return {
      on() { return this; },
      subscribe(callback) {
        setTimeout(() => callback && callback('SUBSCRIBED'), 0);
        return this;
      },
      send() { return Promise.resolve({ status: 'ok' }); },
      unsubscribe() { return Promise.resolve(); }
    };
  }

  window.supabase = {
    createClient() {
      return {
        async rpc(name, params = {}) {
          calls.push({ name, params });
          if (name === 'get_live_board_messages') return { data: [], error: null };
          if (name === 'post_live_board_message') return { data: true, error: null };
          if (name === 'clear_live_board_messages') return { data: true, error: null };
          if (name === 'get_live_board_room') return { data: rowFrom(params), error: null };
          if (name === 'create_live_board_room' || name === 'create_live_board_room_v2') {
            return { data: rowFrom(params), error: null };
          }
          if (name === 'update_live_board_teacher' || name === 'update_live_board_student') {
            return { data: rowFrom(params), error: null };
          }
          return { data: null, error: null };
        },
        channel() { return createChannel(); },
        removeChannel() {}
      };
    }
  };
})();
`;

async function preparePage(browser) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://cdn.jsdelivr.net/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: mockSupabaseScript });
  });
  return { page, errors };
}

(async () => {
  const browser = await chromium.launch({ headless: true });

  try {
    const teacher = await preparePage(browser);
    await teacher.page.goto('http://127.0.0.1:8000/live-board.html', { waitUntil: 'networkidle' });

    const teacherPanel = teacher.page.locator('#sessionMessages');
    if (!(await teacherPanel.evaluate((element) => element.hidden))) {
      throw new Error('Teacher message panel should remain hidden before a room exists');
    }

    await teacher.page.locator('#createRoomButton').click();
    await teacher.page.waitForFunction(() => location.hash.includes('access='));
    await teacher.page.waitForFunction(() => {
      const panel = document.getElementById('sessionMessages');
      return panel && panel.hidden === false;
    });

    const teacherKey = await teacher.page.evaluate(() => window.LiveBoardMessages && window.LiveBoardMessages.sessionKey);
    if (!teacherKey || !teacherKey.includes('|teacher|')) {
      throw new Error('Teacher message lifecycle did not initialize with secure credentials');
    }

    await teacher.page.locator('#sessionMessageInput').fill('Lifecycle test');
    await teacher.page.locator('#sendSessionMessageButton').click();
    await teacher.page.waitForFunction(() => document.getElementById('messageBoardStatus').textContent === 'Sent');

    const teacherPostCalls = await teacher.page.evaluate(() =>
      window.__liveBoardMockCalls.filter((call) => call.name === 'post_live_board_message').length
    );
    if (teacherPostCalls !== 1) {
      throw new Error(`Expected one teacher message RPC, received ${teacherPostCalls}`);
    }
    if (teacher.errors.length) throw new Error(`Teacher page errors: ${teacher.errors.join(' | ')}`);
    await teacher.page.close();

    const student = await preparePage(browser);
    await student.page.goto(
      'http://127.0.0.1:8000/live-board.html#room=ABC123&role=student&access=student-token',
      { waitUntil: 'networkidle' }
    );
    await student.page.waitForFunction(() => {
      const panel = document.getElementById('sessionMessages');
      return panel && panel.hidden === false;
    });

    const studentKey = await student.page.evaluate(() => window.LiveBoardMessages && window.LiveBoardMessages.sessionKey);
    if (!studentKey || !studentKey.includes('ABC123|student|student-token')) {
      throw new Error('Student message lifecycle did not initialize from the secure link');
    }

    await student.page.locator('#sessionMessageInput').fill('Student lifecycle test');
    await student.page.locator('#sendSessionMessageButton').click();
    await student.page.waitForFunction(() => document.getElementById('messageBoardStatus').textContent === 'Sent');

    const studentPostCalls = await student.page.evaluate(() =>
      window.__liveBoardMockCalls.filter((call) => call.name === 'post_live_board_message').length
    );
    if (studentPostCalls !== 1) {
      throw new Error(`Expected one student message RPC, received ${studentPostCalls}`);
    }
    if (student.errors.length) throw new Error(`Student page errors: ${student.errors.join(' | ')}`);
    await student.page.close();

    console.log('Live Board message lifecycle browser test passed');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
