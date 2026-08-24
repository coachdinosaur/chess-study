/**
 * ClockEngine — High-precision Chess Clock Timing Engine
 * Supports Fischer increment, USCF Simple Delay, Bronstein Delay, Sudden Death,
 * Asymmetric / Handicap time controls, sub-second precision, and drift-free timing.
 */

export const TIMING_MODES = {
  FISCHER: 'fischer',       // Bonus increment added per move
  SIMPLE_DELAY: 'delay',    // USCF countdown delay before base time decrements
  BRONSTEIN: 'bronstein',   // Refund of time spent during move up to delay amount
  NONE: 'none'              // Sudden death (no increment or delay)
};

export const CLOCK_STATES = {
  READY: 'ready',           // Clock configured, waiting for first move
  RUNNING: 'running',       // Clock actively ticking
  PAUSED: 'paused',         // Clock paused mid-game
  FLAGGED: 'flagged'        // One player ran out of time
};

export const PRESET_TIME_CONTROLS = [
  // Bullet
  { id: 'bullet-1-0', label: '1 min', group: 'Bullet', baseMinutes: 1, baseSeconds: 0, increment: 0, mode: TIMING_MODES.NONE },
  { id: 'bullet-1-1', label: '1 | 1', group: 'Bullet', baseMinutes: 1, baseSeconds: 0, increment: 1, mode: TIMING_MODES.FISCHER },
  { id: 'bullet-2-1', label: '2 | 1', group: 'Bullet', baseMinutes: 2, baseSeconds: 0, increment: 1, mode: TIMING_MODES.FISCHER },
  
  // Blitz
  { id: 'blitz-3-0', label: '3 min', group: 'Blitz', baseMinutes: 3, baseSeconds: 0, increment: 0, mode: TIMING_MODES.NONE },
  { id: 'blitz-3-2', label: '3 | 2', group: 'Blitz', baseMinutes: 3, baseSeconds: 0, increment: 2, mode: TIMING_MODES.FISCHER },
  { id: 'blitz-5-0', label: '5 min', group: 'Blitz', baseMinutes: 5, baseSeconds: 0, increment: 0, mode: TIMING_MODES.NONE },
  { id: 'blitz-5-3', label: '5 | 3', group: 'Blitz', baseMinutes: 5, baseSeconds: 0, increment: 3, mode: TIMING_MODES.FISCHER },
  { id: 'blitz-5-5', label: '5 | 5', group: 'Blitz', baseMinutes: 5, baseSeconds: 0, increment: 5, mode: TIMING_MODES.FISCHER },
  
  // Rapid
  { id: 'rapid-10-0', label: '10 min', group: 'Rapid', baseMinutes: 10, baseSeconds: 0, increment: 0, mode: TIMING_MODES.NONE },
  { id: 'rapid-10-5', label: '10 | 5', group: 'Rapid', baseMinutes: 10, baseSeconds: 0, increment: 5, mode: TIMING_MODES.FISCHER },
  { id: 'rapid-15-10', label: '15 | 10', group: 'Rapid', baseMinutes: 15, baseSeconds: 0, increment: 10, mode: TIMING_MODES.FISCHER },

  // Classical
  { id: 'classical-30-0', label: '30 min', group: 'Classical', baseMinutes: 30, baseSeconds: 0, increment: 0, mode: TIMING_MODES.NONE },
  { id: 'classical-60-0', label: '60 min', group: 'Classical', baseMinutes: 60, baseSeconds: 0, increment: 0, mode: TIMING_MODES.NONE },
  { id: 'classical-90-30', label: '90 | 30', group: 'Classical', baseMinutes: 90, baseSeconds: 0, increment: 30, mode: TIMING_MODES.FISCHER }
];

export class ClockEngine {
  constructor(config = {}) {
    this.nowFn = config.nowFn || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    this.reset(config);
  }

  /**
   * Reset / configure the clock engine with specified settings
   */
  reset(config = {}) {
    const p1BaseMs = (config.p1BaseMs !== undefined)
      ? config.p1BaseMs
      : ((config.baseMinutes || 5) * 60 + (config.baseSeconds || 0)) * 1000;
      
    const p2BaseMs = (config.p2BaseMs !== undefined)
      ? config.p2BaseMs
      : p1BaseMs;

    this.config = {
      p1BaseMs: Math.max(1000, p1BaseMs),
      p2BaseMs: Math.max(1000, p2BaseMs),
      p1IncrementMs: Math.max(0, (config.p1IncrementMs !== undefined ? config.p1IncrementMs : (config.increment || 0) * 1000)),
      p2IncrementMs: Math.max(0, (config.p2IncrementMs !== undefined ? config.p2IncrementMs : (config.increment || 0) * 1000)),
      p1Mode: config.p1Mode || config.mode || TIMING_MODES.FISCHER,
      p2Mode: config.p2Mode || config.mode || TIMING_MODES.FISCHER,
      firstTurn: config.firstTurn || 1 // 1 = White/Player 1, 2 = Black/Player 2
    };

    this.state = CLOCK_STATES.READY;
    this.activePlayer = null; // 1 or 2 when running/paused
    this.winner = null;        // 1 or 2 if opponent flagged
    this.flaggedPlayer = null; // 1 or 2 who ran out of time

    this.players = {
      1: {
        remainingMs: this.config.p1BaseMs,
        moves: 0,
        mode: this.config.p1Mode,
        incrementMs: this.config.p1IncrementMs,
        activeDelayRemainingMs: 0
      },
      2: {
        remainingMs: this.config.p2BaseMs,
        moves: 0,
        mode: this.config.p2Mode,
        incrementMs: this.config.p2IncrementMs,
        activeDelayRemainingMs: 0
      }
    };

    this.turnStartTime = null;
    this.turnStartRemainingMs = null;
    this.lastTickTime = null;
  }

  /**
   * Start the clock or switch turn
   * If READY, tapping player X's side starts the OTHER player's clock (Player 1 taps -> Player 2 starts)
   * or player can specify explicit playerToStart
   */
  tap(player, explicitTime = null) {
    const now = explicitTime !== null ? explicitTime : this.nowFn();

    // 1. Ready state: first tap
    if (this.state === CLOCK_STATES.READY) {
      const startPlayer = (player === 1) ? 2 : 1;
      this._startTurn(startPlayer, now);
      return { success: true, action: 'start', activePlayer: startPlayer };
    }

    // 2. Running state: must tap the active player's clock to switch
    if (this.state === CLOCK_STATES.RUNNING) {
      if (player !== this.activePlayer) {
        // Ignored accidental tap on inactive player's clock
        return { success: false, reason: 'not_active_player' };
      }

      // Finalize current player's turn
      this._updateCurrentTime(now);
      if (this.state === CLOCK_STATES.FLAGGED) {
        return { success: false, reason: 'flagged' };
      }

      this._finalizeTurn(this.activePlayer, now);

      // Switch to opponent
      const nextPlayer = (this.activePlayer === 1) ? 2 : 1;
      this._startTurn(nextPlayer, now);
      return { success: true, action: 'switch', activePlayer: nextPlayer, moves: this.players[player].moves };
    }

    // 3. Paused state: tapping resumes for the active player
    if (this.state === CLOCK_STATES.PAUSED) {
      this.resume(now);
      return { success: true, action: 'resume', activePlayer: this.activePlayer };
    }

    return { success: false, reason: 'invalid_state' };
  }

  /**
   * Start turn for a player
   */
  _startTurn(player, now) {
    this.state = CLOCK_STATES.RUNNING;
    this.activePlayer = player;
    this.turnStartTime = now;
    this.lastTickTime = now;
    this.turnStartRemainingMs = this.players[player].remainingMs;

    const pData = this.players[player];
    if (pData.mode === TIMING_MODES.SIMPLE_DELAY) {
      pData.activeDelayRemainingMs = pData.incrementMs;
    } else {
      pData.activeDelayRemainingMs = 0;
    }
  }

  /**
   * Finalize a turn when a move is completed: apply increments or delay refunds
   */
  _finalizeTurn(player, now) {
    const pData = this.players[player];
    pData.moves += 1;
    const elapsedTurnMs = Math.max(0, now - this.turnStartTime);

    if (pData.mode === TIMING_MODES.FISCHER) {
      // Add Fischer bonus increment
      pData.remainingMs += pData.incrementMs;
    } else if (pData.mode === TIMING_MODES.BRONSTEIN) {
      // Bronstein refund: refund elapsed time up to the delay amount
      const refund = Math.min(elapsedTurnMs, pData.incrementMs);
      pData.remainingMs = Math.min(this.turnStartRemainingMs, pData.remainingMs + refund);
    }

    pData.activeDelayRemainingMs = 0;
  }

  /**
   * Pause the clock
   */
  pause(explicitTime = null) {
    if (this.state !== CLOCK_STATES.RUNNING) return false;
    const now = explicitTime !== null ? explicitTime : this.nowFn();
    this._updateCurrentTime(now);
    this.state = CLOCK_STATES.PAUSED;
    return true;
  }

  /**
   * Resume the clock from paused state
   */
  resume(explicitTime = null) {
    if (this.state !== CLOCK_STATES.PAUSED || !this.activePlayer) return false;
    const now = explicitTime !== null ? explicitTime : this.nowFn();
    this.state = CLOCK_STATES.RUNNING;
    this.turnStartTime = now;
    this.lastTickTime = now;
    this.turnStartRemainingMs = this.players[this.activePlayer].remainingMs;
    return true;
  }

  /**
   * Tick / sync the clock with current high-resolution timestamp
   */
  tick(explicitTime = null) {
    const now = explicitTime !== null ? explicitTime : this.nowFn();
    if (this.state === CLOCK_STATES.RUNNING) {
      this._updateCurrentTime(now);
    }
    return this.getSnapshot();
  }

  /**
   * Calculate current remaining time for the active player without drift
   */
  _updateCurrentTime(now) {
    if (this.state !== CLOCK_STATES.RUNNING || !this.activePlayer) return;

    const pData = this.players[this.activePlayer];
    const elapsedTurnMs = Math.max(0, now - this.turnStartTime);

    if (pData.mode === TIMING_MODES.SIMPLE_DELAY) {
      if (elapsedTurnMs < pData.incrementMs) {
        // Still inside simple delay window
        pData.activeDelayRemainingMs = pData.incrementMs - elapsedTurnMs;
        pData.remainingMs = this.turnStartRemainingMs;
      } else {
        // Delay window expired, decrement base time
        pData.activeDelayRemainingMs = 0;
        const baseElapsedMs = elapsedTurnMs - pData.incrementMs;
        pData.remainingMs = Math.max(0, this.turnStartRemainingMs - baseElapsedMs);
      }
    } else {
      // Standard / Fischer / Bronstein: base time decrements continuously
      pData.remainingMs = Math.max(0, this.turnStartRemainingMs - elapsedTurnMs);
    }

    this.lastTickTime = now;

    // Check for Flag Fall
    if (pData.remainingMs <= 0) {
      pData.remainingMs = 0;
      this.state = CLOCK_STATES.FLAGGED;
      this.flaggedPlayer = this.activePlayer;
      this.winner = (this.activePlayer === 1) ? 2 : 1;
    }
  }

  /**
   * Adjust time manually (e.g. arbiter time penalty / addition)
   */
  adjustTime(player, deltaMs) {
    if (!this.players[player]) return;
    this.players[player].remainingMs = Math.max(0, this.players[player].remainingMs + deltaMs);
    if (this.activePlayer === player && this.state === CLOCK_STATES.RUNNING) {
      this.turnStartRemainingMs += deltaMs;
    }
    if (this.players[player].remainingMs <= 0) {
      this.players[player].remainingMs = 0;
      this.state = CLOCK_STATES.FLAGGED;
      this.flaggedPlayer = player;
      this.winner = (player === 1) ? 2 : 1;
    }
  }

  /**
   * Get an immutable snapshot of current clock state
   */
  getSnapshot() {
    return {
      state: this.state,
      activePlayer: this.activePlayer,
      winner: this.winner,
      flaggedPlayer: this.flaggedPlayer,
      p1: {
        remainingMs: Math.max(0, this.players[1].remainingMs),
        moves: this.players[1].moves,
        mode: this.players[1].mode,
        incrementMs: this.players[1].incrementMs,
        delayRemainingMs: this.players[1].activeDelayRemainingMs,
        isLowTime: this.players[1].remainingMs < 20000 && this.players[1].remainingMs > 0,
        isCriticalTime: this.players[1].remainingMs < 10000 && this.players[1].remainingMs > 0
      },
      p2: {
        remainingMs: Math.max(0, this.players[2].remainingMs),
        moves: this.players[2].moves,
        mode: this.players[2].mode,
        incrementMs: this.players[2].incrementMs,
        delayRemainingMs: this.players[2].activeDelayRemainingMs,
        isLowTime: this.players[2].remainingMs < 20000 && this.players[2].remainingMs > 0,
        isCriticalTime: this.players[2].remainingMs < 10000 && this.players[2].remainingMs > 0
      }
    };
  }

  /**
   * Format milliseconds into human-readable digital clock time
   * @param {number} ms Milliseconds remaining
   * @param {boolean} showSubSeconds If true and time < 20s, shows tenths of second (e.g. 09.4)
   */
  static formatTime(ms, showSubSeconds = true) {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const tenths = Math.floor((ms % 1000) / 100);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, '0');

    // Low time (< 20 seconds) with sub-seconds
    if (showSubSeconds && totalSeconds < 20 && hours === 0) {
      return `${pad(seconds)}.${tenths}`;
    }

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }

    return `${pad(minutes)}:${pad(seconds)}`;
  }
}
