import test from 'node:test';
import assert from 'node:assert/strict';
import { ClockEngine, TIMING_MODES, CLOCK_STATES, PRESET_TIME_CONTROLS } from '../clock/clock-engine.mjs';

test('ClockEngine - Initial Ready State', () => {
  const engine = new ClockEngine({
    baseMinutes: 5,
    baseSeconds: 0,
    increment: 3,
    mode: TIMING_MODES.FISCHER
  });

  const snap = engine.getSnapshot();
  assert.equal(snap.state, CLOCK_STATES.READY);
  assert.equal(snap.activePlayer, null);
  assert.equal(snap.p1.remainingMs, 300000);
  assert.equal(snap.p2.remainingMs, 300000);
  assert.equal(snap.p1.moves, 0);
  assert.equal(snap.p2.moves, 0);
  assert.equal(snap.p1.incrementMs, 3000);
  assert.equal(snap.p2.incrementMs, 3000);
});

test('ClockEngine - First tap starts opponent clock', () => {
  let virtualTime = 10000;
  const engine = new ClockEngine({
    baseMinutes: 3,
    increment: 2,
    nowFn: () => virtualTime
  });

  // Player 1 taps clock -> Player 2 starts
  const res = engine.tap(1);
  assert.equal(res.success, true);
  assert.equal(res.action, 'start');
  assert.equal(res.activePlayer, 2);

  let snap = engine.getSnapshot();
  assert.equal(snap.state, CLOCK_STATES.RUNNING);
  assert.equal(snap.activePlayer, 2);

  // Advance time by 5000ms
  virtualTime += 5000;
  snap = engine.tick();
  assert.equal(snap.p2.remainingMs, 180000 - 5000);
  assert.equal(snap.p1.remainingMs, 180000);
});

test('ClockEngine - Fischer Increment added on move completion', () => {
  let virtualTime = 10000;
  const engine = new ClockEngine({
    baseMinutes: 3,
    increment: 2, // 2s Fischer increment
    mode: TIMING_MODES.FISCHER,
    nowFn: () => virtualTime
  });

  // Player 2 starts (Player 1 tapped)
  engine.tap(1); // active = 2

  // Player 2 spends 4000ms
  virtualTime += 4000;
  // Player 2 taps their clock to switch to Player 1
  const res = engine.tap(2);
  assert.equal(res.success, true);
  assert.equal(res.action, 'switch');
  assert.equal(res.activePlayer, 1);

  const snap = engine.getSnapshot();
  // Player 2 remaining should be: 180,000 - 4000 + 2000 (increment) = 178,000
  assert.equal(snap.p2.remainingMs, 178000);
  assert.equal(snap.p2.moves, 1);
  assert.equal(snap.p1.remainingMs, 180000);
  assert.equal(snap.p1.moves, 0);
});

test('ClockEngine - Simple USCF Delay behavior', () => {
  let virtualTime = 10000;
  const engine = new ClockEngine({
    baseMinutes: 5,
    increment: 5, // 5s delay
    mode: TIMING_MODES.SIMPLE_DELAY,
    nowFn: () => virtualTime
  });

  engine.tap(1); // active = 2

  // Player 2 spends 3000ms (within 5s delay)
  virtualTime += 3000;
  let snap = engine.tick();
  assert.equal(snap.p2.remainingMs, 300000); // Base time not touched
  assert.equal(snap.p2.delayRemainingMs, 2000); // 2s delay left

  // Player 2 finishes move at 3s
  engine.tap(2); // active = 1
  snap = engine.getSnapshot();
  assert.equal(snap.p2.remainingMs, 300000); // no loss of base time, no increment
  assert.equal(snap.p2.moves, 1);

  // Player 1 spends 7000ms (5s delay + 2s base time)
  virtualTime += 7000;
  engine.tap(1); // active = 2
  snap = engine.getSnapshot();
  assert.equal(snap.p1.remainingMs, 298000); // Lost exactly 2000ms of base time
  assert.equal(snap.p1.moves, 1);
});

test('ClockEngine - Bronstein Delay behavior', () => {
  let virtualTime = 10000;
  const engine = new ClockEngine({
    baseMinutes: 5,
    increment: 5, // 5s Bronstein delay
    mode: TIMING_MODES.BRONSTEIN,
    nowFn: () => virtualTime
  });

  engine.tap(1); // active = 2

  // Player 2 spends 3000ms (less than 5s)
  virtualTime += 3000;
  // During thinking, base time appears decremented
  let snap = engine.tick();
  assert.equal(snap.p2.remainingMs, 297000);

  // When move finishes, 3000ms is refunded (refund = min(elapsed, delay) = 3000)
  engine.tap(2); // active = 1
  snap = engine.getSnapshot();
  assert.equal(snap.p2.remainingMs, 300000);

  // Player 1 spends 8000ms (more than 5s)
  virtualTime += 8000;
  // When move finishes, 5000ms is refunded
  engine.tap(1); // active = 2
  snap = engine.getSnapshot();
  assert.equal(snap.p1.remainingMs, 297000); // 300,000 - 8000 + 5000 = 297,000
});

test('ClockEngine - Inactive player touch rejection', () => {
  let virtualTime = 10000;
  const engine = new ClockEngine({
    baseMinutes: 3,
    nowFn: () => virtualTime
  });

  engine.tap(1); // starts Player 2

  // Player 1 accidentally taps while it is Player 2's turn
  const res = engine.tap(1);
  assert.equal(res.success, false);
  assert.equal(res.reason, 'not_active_player');

  const snap = engine.getSnapshot();
  assert.equal(snap.activePlayer, 2);
  assert.equal(snap.state, CLOCK_STATES.RUNNING);
});

test('ClockEngine - Flag fall detection', () => {
  let virtualTime = 10000;
  const engine = new ClockEngine({
    baseMinutes: 1, // 60,000ms
    increment: 0,
    mode: TIMING_MODES.NONE,
    nowFn: () => virtualTime
  });

  engine.tap(1); // starts Player 2

  // Advance by 61,000ms (past 60s)
  virtualTime += 61000;
  const snap = engine.tick();

  assert.equal(snap.state, CLOCK_STATES.FLAGGED);
  assert.equal(snap.flaggedPlayer, 2);
  assert.equal(snap.winner, 1);
  assert.equal(snap.p2.remainingMs, 0);

  // Tapping after flag fall fails
  const res = engine.tap(2);
  assert.equal(res.success, false);
});

test('ClockEngine - Pause and Resume', () => {
  let virtualTime = 10000;
  const engine = new ClockEngine({
    baseMinutes: 5,
    nowFn: () => virtualTime
  });

  engine.tap(1); // starts Player 2

  virtualTime += 10000;
  engine.tick();
  assert.equal(engine.pause(), true);

  let snap = engine.getSnapshot();
  assert.equal(snap.state, CLOCK_STATES.PAUSED);
  assert.equal(snap.p2.remainingMs, 290000);

  // Time elapses while paused
  virtualTime += 50000;
  snap = engine.tick();
  assert.equal(snap.p2.remainingMs, 290000); // Time remained frozen

  assert.equal(engine.resume(), true);
  virtualTime += 5000;
  snap = engine.tick();
  assert.equal(snap.p2.remainingMs, 285000);
});

test('ClockEngine - Asymmetric / Handicap Time Control', () => {
  const engine = new ClockEngine({
    p1BaseMs: 180000, // 3 min White
    p2BaseMs: 600000, // 10 min Black
    p1IncrementMs: 2000, // 2s increment White
    p2IncrementMs: 5000, // 5s increment Black
    p1Mode: TIMING_MODES.FISCHER,
    p2Mode: TIMING_MODES.FISCHER
  });

  const snap = engine.getSnapshot();
  assert.equal(snap.p1.remainingMs, 180000);
  assert.equal(snap.p2.remainingMs, 600000);
  assert.equal(snap.p1.incrementMs, 2000);
  assert.equal(snap.p2.incrementMs, 5000);
});

test('ClockEngine - Static formatTime helper', () => {
  assert.equal(ClockEngine.formatTime(300000), '05:00');
  assert.equal(ClockEngine.formatTime(65000), '01:05');
  assert.equal(ClockEngine.formatTime(3665000), '1:01:05');
  assert.equal(ClockEngine.formatTime(9400, true), '09.4');
  assert.equal(ClockEngine.formatTime(15800, true), '15.8');
  assert.equal(ClockEngine.formatTime(0, true), '00.0');
});

test('ClockEngine - Presets sanity check', () => {
  assert.ok(PRESET_TIME_CONTROLS.length >= 10);
  for (const preset of PRESET_TIME_CONTROLS) {
    assert.ok(preset.id);
    assert.ok(preset.label);
    assert.ok(preset.baseMinutes >= 1);
  }
});
