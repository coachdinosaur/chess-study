from pathlib import Path
import re

APP_PATH = Path("app.js")
CSS_PATH = Path("styles.css")

app = APP_PATH.read_text(encoding="utf-8")
css = CSS_PATH.read_text(encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


app = replace_once(
    app,
    """    lastClockTick: 0,
    timerId: null,
    engineThinking: false,""",
    """    lastClockTick: 0,
    activeClock: null,
    timerId: null,
    gameReady: false,
    engineThinking: false,""",
    "play clock state",
)

app = replace_once(
    app,
    """  state.play.lastClockTick = 0;
  state.play.whiteTime = 0;""",
    """  state.play.lastClockTick = 0;
  state.play.activeClock = null;
  state.play.gameReady = false;
  state.play.whiteTime = 0;""",
    "start game clock reset",
)

app = replace_once(
    app,
    """  applyEngineSkillLevel(state.play.skill);
  worker.postMessage('ucinewgame');

  if (state.play.timeControl !== 'none') {
    state.play.clockRunning = true;
    startPlayClock();
  }

  const turn = game.turn();
  const humanSideLetter = state.play.assignedSide === 'white' ? 'w' : 'b';
  if (turn !== humanSideLetter) {
    void triggerEngineMove();
  }""",
    """  applyEngineSkillLevel(state.play.skill);
  worker.postMessage('ucinewgame');

  state.play.gameReady = true;
  const turn = game.turn();
  const humanSideLetter = state.play.assignedSide === 'white' ? 'w' : 'b';
  state.analysis.boardMessage = turn === humanSideLetter
    ? 'Stockfish is ready. Your turn!'
    : 'Stockfish is ready and will move first.';

  if (state.play.timeControl !== 'none') {
    state.play.clockRunning = true;
    state.play.activeClock = turn;
  }
  renderAll();
  if (state.play.timeControl !== 'none') {
    startPlayClock();
  }

  if (turn !== humanSideLetter) {
    void triggerEngineMove();
  }""",
    "engine ready clock start",
)

app = replace_once(
    app,
    """  state.play.active = false;
  state.play.engineThinking = false;
  stopPlayClock();""",
    """  state.play.active = false;
  state.play.gameReady = false;
  state.play.clockRunning = false;
  state.play.activeClock = null;
  state.play.lastClockTick = 0;
  state.play.engineThinking = false;
  stopPlayClock();""",
    "stop game clock cleanup",
)

app = replace_once(
    app,
    """  if (!state.play.active) {
    return false;
  }
  if (!state.analysis.game) {""",
    """  if (!state.play.active) {
    return false;
  }
  if (!state.play.gameReady) {
    return false;
  }
  if (!state.analysis.game) {""",
    "engine readiness guard",
)

app = replace_once(
    app,
    """function applyAnalysisMove(move) {
  if (!state.analysis.game) {
    return;
  }
  updateClockElapsed();
  const shouldKeepAnalysisLive = analysisShouldFollowPositionChanges();""",
    """function applyAnalysisMove(move) {
  if (!state.analysis.game) {
    return;
  }
  const playMoverColor = state.play.active ? state.analysis.game.turn() : null;
  if (playMoverColor && !settlePlayMoverClock(playMoverColor)) {
    return;
  }
  const shouldKeepAnalysisLive = analysisShouldFollowPositionChanges();""",
    "human move clock settlement",
)

app = replace_once(
    app,
    """    if (state.play.timeControl !== 'none') {
      const turn = state.analysis.game.turn();
      if (turn === 'b') {
        state.play.whiteTime += state.play.whiteInc;
      } else {
        state.play.blackTime += state.play.blackInc;
      }
    }""",
    """    if (state.play.timeControl !== 'none') {
      if (playMoverColor === 'w') {
        state.play.whiteTime += state.play.whiteInc;
      } else {
        state.play.blackTime += state.play.blackInc;
      }
    }""",
    "human increment attribution",
)

app = replace_once(
    app,
    """    schedulePersist();
    renderAll();
    window.setTimeout(() => {
      if (shouldEngineMoveInPlay()) {
        void triggerEngineMove();
      }
    }, 50);
    return;""",
    """    schedulePersist();
    const nextTurn = state.analysis.game.turn();
    state.play.activeClock = state.play.timeControl === 'none' ? null : nextTurn;
    renderAll();
    beginPlayTurnClock(nextTurn);
    if (shouldEngineMoveInPlay()) {
      void triggerEngineMove();
    }
    return;""",
    "human to engine handoff",
)

app = replace_once(
    app,
    """  if (state.play.active) {
    const humanSide = state.play.assignedSide === 'white' ? 'w' : 'b';""",
    """  if (state.play.active) {
    if (!state.play.gameReady) {
      return;
    }
    const humanSide = state.play.assignedSide === 'white' ? 'w' : 'b';""",
    "block moves while Stockfish loads",
)

app = replace_once(
    app,
    """function applyPlayEngineMove(bestMoveUci) {
  if (!state.play.active || !state.analysis.game) {
    return;
  }
  updateClockElapsed();
  bestMoveUci = chooseBeginnerMove(bestMoveUci);
  const parsedMove = tablebaseUciMoveObject(bestMoveUci);""",
    """function applyPlayEngineMove(bestMoveUci) {
  if (!state.play.active || !state.analysis.game) {
    return;
  }
  const engineMoverColor = state.analysis.game.turn();
  bestMoveUci = chooseBeginnerMove(bestMoveUci);
  if (!settlePlayMoverClock(engineMoverColor)) {
    return;
  }
  const parsedMove = tablebaseUciMoveObject(bestMoveUci);""",
    "engine move clock settlement",
)

app = replace_once(
    app,
    """  if (state.play.timeControl !== 'none') {
    const turn = state.analysis.game.turn();
    if (turn === 'w') {
      state.play.blackTime += state.play.blackInc;
    } else {
      state.play.whiteTime += state.play.whiteInc;
    }
  }""",
    """  if (state.play.timeControl !== 'none') {
    if (engineMoverColor === 'w') {
      state.play.whiteTime += state.play.whiteInc;
    } else {
      state.play.blackTime += state.play.blackInc;
    }
  }""",
    "engine increment attribution",
)

app = replace_once(
    app,
    """  if (checkPuzzleMaterialObjective()) {
    return;
  }

  renderAll();
}""",
    """  if (checkPuzzleMaterialObjective()) {
    return;
  }

  const nextTurn = state.analysis.game.turn();
  state.play.activeClock = state.play.timeControl === 'none' ? null : nextTurn;
  renderAll();
  beginPlayTurnClock(nextTurn);
}""",
    "engine to human handoff",
)

clock_pattern = re.compile(
    r"function startPlayClock\(\) \{.*?\n\}\n\nfunction renderPlayPanel\(\) \{",
    re.S,
)
clock_replacement = """function playClockNow() {
  return window.performance?.now ? window.performance.now() : Date.now();
}

function playClockTimeFor(color) {
  return color === 'w' ? state.play.whiteTime : state.play.blackTime;
}

function playClockFlagReason(color) {
  return color === 'w'
    ? 'Black wins on time (White flagged).'
    : 'White wins on time (Black flagged).';
}

function startPlayClock() {
  stopPlayClock();
  if (state.play.timeControl === 'none') {
    return;
  }
  state.play.lastClockTick = playClockNow();
  state.play.timerId = window.setInterval(tickPlayClock, 50);
}

function stopPlayClock() {
  if (state.play.timerId) {
    window.clearInterval(state.play.timerId);
    state.play.timerId = null;
  }
}

function beginPlayTurnClock(color) {
  if (
    !state.play.active
    || !state.play.gameReady
    || !state.play.clockRunning
    || state.play.timeControl === 'none'
  ) {
    return;
  }
  state.play.activeClock = color;
  state.play.lastClockTick = playClockNow();
}

function updateClockElapsed() {
  const color = state.play.activeClock;
  if (
    !state.play.active
    || !state.play.clockRunning
    || !state.analysis.game
    || (color !== 'w' && color !== 'b')
  ) {
    return null;
  }

  const now = playClockNow();
  if (!state.play.lastClockTick) {
    state.play.lastClockTick = now;
    return { color, remaining: playClockTimeFor(color) };
  }

  const elapsed = Math.max(0, now - state.play.lastClockTick);
  state.play.lastClockTick = now;
  if (color === 'w') {
    state.play.whiteTime = Math.max(0, state.play.whiteTime - elapsed);
  } else {
    state.play.blackTime = Math.max(0, state.play.blackTime - elapsed);
  }
  return { color, remaining: playClockTimeFor(color) };
}

function settlePlayMoverClock(color) {
  if (state.play.timeControl === 'none' || !state.play.clockRunning) {
    return true;
  }

  if (state.play.activeClock !== color) {
    console.warn('[PlayClock] Correcting active clock ownership.', {
      activeClock: state.play.activeClock,
      mover: color,
    });
    state.play.activeClock = color;
  }

  const settled = updateClockElapsed();
  if (settled && settled.remaining <= 0) {
    stopPlayGame({ reason: playClockFlagReason(color) });
    return false;
  }

  state.play.activeClock = null;
  state.play.lastClockTick = 0;
  return true;
}

function tickPlayClock() {
  if (!state.play.active || !state.analysis.game) {
    stopPlayClock();
    return;
  }

  if (state.play.timeControl === 'none' || !state.play.clockRunning) {
    stopPlayClock();
    return;
  }

  if (state.puzzle.sessionActive) {
    return;
  }

  const settled = updateClockElapsed();
  if (settled && settled.remaining <= 0) {
    stopPlayGame({ reason: playClockFlagReason(settled.color) });
    return;
  }

  if (dom.playPanel) {
    const clocks = dom.playPanel.querySelectorAll('.play-clock-time');
    if (clocks.length === 2) {
      clocks[0].textContent = formatPlayClock(state.play.whiteTime);
      clocks[1].textContent = formatPlayClock(state.play.blackTime);
      const cards = dom.playPanel.querySelectorAll('.play-clock');
      if (cards.length === 2) {
        cards[0].classList.toggle('is-low', state.play.whiteTime <= 10000);
        cards[1].classList.toggle('is-low', state.play.blackTime <= 10000);
      }
    } else {
      renderPlayPanel();
    }
  }
}

function formatPlayClock(ms) {
  if (ms <= 0) {
    return '0:00.0';
  }
  if (ms < 10000) {
    const totalTenths = Math.ceil(ms / 100);
    const seconds = Math.floor(totalTenths / 10);
    const tenths = totalTenths % 10;
    return `0:${seconds.toString().padStart(2, '0')}.${tenths}`;
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function renderPlayPanel() {"""
app, count = clock_pattern.subn(clock_replacement, app, count=1)
if count != 1:
    raise SystemExit(f"clock implementation: expected exactly one match, found {count}")

app = replace_once(
    app,
    """  const formatTime = (ms) => {
    if (ms <= 0) return '0:00';
    const totalSecs = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

""",
    "",
    "duplicate play clock formatter",
)

app = replace_once(
    app,
    """          <div class="play-clock ${state.analysis.game?.turn() === 'w' ? 'is-active' : ''}">
            <span class="play-clock-label">White</span>
            <span class="play-clock-time">${formatTime(whiteTime)}</span>
          </div>
          <div class="play-clock ${state.analysis.game?.turn() === 'b' ? 'is-active' : ''}">
            <span class="play-clock-label">Black</span>
            <span class="play-clock-time">${formatTime(blackTime)}</span>
          </div>""",
    """          <div class="play-clock ${state.play.activeClock === 'w' ? 'is-active' : ''} ${whiteTime <= 10000 ? 'is-low' : ''}">
            <span class="play-clock-label">White</span>
            <span class="play-clock-time">${formatPlayClock(whiteTime)}</span>
          </div>
          <div class="play-clock ${state.play.activeClock === 'b' ? 'is-active' : ''} ${blackTime <= 10000 ? 'is-low' : ''}">
            <span class="play-clock-label">Black</span>
            <span class="play-clock-time">${formatPlayClock(blackTime)}</span>
          </div>""",
    "play clock markup",
)

css = replace_once(
    css,
    """.play-clock-time {
  color: var(--text);
  font-family: "Consolas", "Cascadia Code", monospace;
  font-size: 1.28rem;
  font-weight: 800;
}""",
    """.play-clock-time {
  min-width: 5.4ch;
  color: var(--text);
  font-family: "Consolas", "Cascadia Code", monospace;
  font-size: 1.45rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.015em;
}

.play-clock.is-low .play-clock-time {
  color: var(--danger);
}""",
    "desktop clock styling",
)

css = replace_once(
    css,
    """  .play-clock-time {
    font-size: 1.08rem;
  }""",
    """  .play-clock-time {
    min-width: 5.4ch;
    font-size: 1.18rem;
  }""",
    "mobile clock styling",
)

for required in (
    "function settlePlayMoverClock(color)",
    "function formatPlayClock(ms)",
    "beginPlayTurnClock(nextTurn)",
    "state.play.gameReady = true;",
    "state.play.activeClock === 'w'",
    "state.play.activeClock === 'b'",
):
    if required not in app:
        raise SystemExit(f"missing required patched code: {required}")

if "window.setTimeout(() => {\n      if (shouldEngineMoveInPlay())" in app:
    raise SystemExit("old 50 ms engine handoff delay remains")

APP_PATH.write_text(app, encoding="utf-8")
CSS_PATH.write_text(css, encoding="utf-8")
print("Play clock patch applied.")
