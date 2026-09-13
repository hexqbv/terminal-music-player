const { parseKey } = require('./keys');
const { spawnVlc, togglePauseVlc, quitVlc, getLength, getTime } = require('./vlcPlayer');
const { clearLines, writeProgressLine, renderProgressBar } = require('./render');

// Why VLC RC interface instead of afplay:
// afplay has no stdin, so pausing it with SIGSTOP freezes the OS process
// but not VLC's underlying audio clock — resuming after a pause could skip ahead.
// VLC's RC interface is a real two-way protocol where VLC tracks its own position correctly.


/**
 * Renders the songs menu to stdout with cursor and playback status.
 *
 * @param {object} state - App state object
 */
function render(state) {
  if (state.lastLinesCount > 0) {
    clearLines(state.lastLinesCount);
  }

  let linesCount = 0;
  if (!state.songs || state.songs.length === 0) {
    console.log('No songs found in songs directory.');
    linesCount = 1;
  } else {
    state.songs.forEach((song, index) => {
      const marker = index === state.cursor ? '> ' : '  ';
      let status = '';
      if (index === state.currentIndex) {
        status = state.paused ? ' (paused)' : ' (playing)';
      }
      console.log(`${marker}${song.name}${status}`);
      linesCount++;
    });
  }
  // Reserve a blank line for the progress bar.
  console.log('');
  linesCount++;

  state.lastLinesCount = linesCount;
}

/**
 * Starts interval to update progress bar based on VLC playback position.
 * @param {object} state - App state object
 */
function startProgressTracking(state) {
  // Avoid multiple timers.
  if (state.progressTimer) return;
  // Why two consecutive matching reads instead of a single fetch-and-cache:
  // VLC hasn't finished parsing the file immediately after spawn, so the very
  // first get_length response is often 0 or a tiny placeholder. Caching that
  // wrong value permanently breaks the progress bar for the whole track.
  // We keep polling until two back-to-back non-zero identical readings agree,
  // which is the signal that VLC's demuxer has settled on the real duration.
  let lastLen = null; // most recent non-zero reading
  state.progressTimer = setInterval(async () => {
    try {
      if (!state.player) return;
      if (!state.duration) {
        const len = await getLength(state.player);
        if (len && len > 0) {
          if (len === lastLen) {
            // Two consecutive matching non-zero readings — safe to trust this.
            state.duration = len;
          } else {
            // First sighting of this value; record it and wait for confirmation.
            lastLen = len;
          }
        }
      }
      if (!state.paused && state.duration) {
        const t = await getTime(state.player);
        if (t != null) state.elapsed = t;
      }
      const bar = renderProgressBar(state.elapsed || 0, state.duration || 0);
      if (bar) writeProgressLine(bar);
    } catch (err) {
      // Log but do not crash — a transient VLC response error should not kill playback.
      process.stderr.write(`[progress] ${err.message}\n`);
    }
  }, 500);
}

/**
 * Stops the progress tracking interval and clears related state.
 * @param {object} state - App state object
 */
function stopProgressTracking(state) {
  if (state.progressTimer) {
    clearInterval(state.progressTimer);
    state.progressTimer = null;
  }
  state.duration = null;
  state.elapsed = 0;
}

/**
 * Toggles playback pause/resume via VLC RC interface.
 *
 * @param {object} state - App state object
 */
function togglePause(state) {
  if (!state || !state.player) {
    return;
  }

  togglePauseVlc(state.player);
  state.paused = !state.paused;

  render(state);
}

/**
 * Stops playback by sending quit to VLC and applying SIGKILL as a safety net.
 *
 * @param {object} state - App state object
 * @param {boolean} [immediateKill=false] - Whether to SIGKILL immediately
 */
function stopPlayer(state, immediateKill = false) {
  if (state && state.player) {
    // Stop progress bar updates for the current track.
    stopProgressTracking(state);
    const player = state.player;
    state.player = null;
    state.currentIndex = null;
    state.paused = false;

    try {
      quitVlc(player);
    } catch {}

    if (immediateKill) {
      try {
        player.kill('SIGKILL');
      } catch {}
    } else {
      setTimeout(() => {
        try {
          player.kill('SIGKILL');
        } catch {}
      }, 100).unref();
    }
  }
}


/**
 * Plays a song at the specified index using VLC RC interface.
 *
 * @param {object} state - App state object
 * @param {number} index - Index of the song to play
 */
function playSong(state, index) {
  if (!state.songs || state.songs.length === 0) {
    return;
  }

  state.currentIndex = index;
  state.cursor = index;
  stopPlayer(state);

  try {
    const player = spawnVlc(state.songs[index].filePath);
    state.player = player;
    state.paused = false;

    // 'error' handler: a bad/missing file emits ENOENT instead of crashing the process.
    player.on('error', (err) => {
      process.stdout.write(`\nVLC error: ${err.message}\n`);
      if (state.player === player) {
        state.player = null;
        state.currentIndex = null;
        stopProgressTracking(state);
        render(state);
      }
    });

    player.on('exit', () => {
      if (state.player === player) {
        state.player = null;
        state.currentIndex = null;
        state.paused = false;
        stopProgressTracking(state);
        render(state);
      }
    });

    startProgressTracking(state);
    render(state);
  } catch (err) {
    process.stdout.write(`\nFailed to start VLC: ${err.message}\n`);
  }
}

// Track Navigation:
// A "skip" is just kill + spawn a new process on a different file.
function playRelative(state, offset) {
  if (!state || !state.songs || state.songs.length === 0) {
    return;
  }

  const baseIndex = state.currentIndex !== null ? state.currentIndex : state.cursor;
  const len = state.songs.length;
  const nextIndex = ((baseIndex + offset) % len + len) % len;

  playSong(state, nextIndex);
}

// Terminal and Process Cleanup:
// Without this cleanup, an orphaned child process keeps running with no parent
// to stop it, and the terminal is left stuck in raw mode.
function cleanupAndExit(state) {
  stopPlayer(state, true);
  if (process.stdin.setRawMode) {
    try {
      process.stdin.setRawMode(false);
    } catch {}
  }
  process.stdin.pause();
  process.exit(0);
}

/**
 * Starts the interactive raw-mode terminal music player loop.
 *
 * @param {Array} songs - Array of discovered song objects
 * @returns {object} The app state object
 */
function createApp(songs = []) {
  const state = {
    songs,
    cursor: 0,
    currentIndex: null,
    player: null,
    paused: false,
    duration: null,
    elapsed: 0,
    progressTimer: null,
    lastLinesCount: 0,
  };

  // Calling process.stdin.setRawMode(true) is the Node equivalent of `stty raw` —
  // it turns off line buffering so every keystroke is delivered immediately
  // instead of only after Enter.
  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  render(state);

  const onData = (chunk) => {
    const key = parseKey(chunk);

    if (key === 'ctrl-c' || key === 'q') {
      cleanupAndExit(state);
      return;
    }

    if (key === 'p' || key === 'space') {
      togglePause(state);
      return;
    }

    if (key === 'n') {
      playRelative(state, 1);
      return;
    }

    if (key === 'b') {
      playRelative(state, -1);
      return;
    }

    if (state.songs.length > 0) {
      if (key === 'up') {
        state.cursor = (state.cursor - 1 + state.songs.length) % state.songs.length;
        render(state);
      } else if (key === 'down') {
        state.cursor = (state.cursor + 1) % state.songs.length;
        render(state);
      } else if (key === 'enter') {
        playSong(state, state.cursor);
      }
    }
  };

  process.stdin.on('data', onData);

  state.togglePause = () => togglePause(state);
  state.playRelative = (offset) => playRelative(state, offset);
  state.cleanupAndExit = () => cleanupAndExit(state);
  state.stopPlayer = () => stopPlayer(state);

  process.stdin.once('end', () => cleanupAndExit(state));
  process.on('SIGINT', () => cleanupAndExit(state));
  process.on('SIGTERM', () => cleanupAndExit(state));

  return state;
}

createApp.createApp = createApp;
createApp.startApp = createApp;
createApp.app = createApp;
createApp.render = render;
createApp.togglePause = togglePause;
createApp.playSong = playSong;
createApp.playRelative = playRelative;
createApp.stopPlayer = stopPlayer;
createApp.cleanupAndExit = cleanupAndExit;
createApp.default = createApp;

module.exports = createApp;
