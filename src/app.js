const { parseKey } = require('./keys');
const { playBasic, stopBasic } = require('./basicPlayer');

/**
 * Renders the songs menu to stdout with cursor and playback status.
 *
 * @param {object} state - App state object
 */
function render(state) {
  console.clear();
  if (!state.songs || state.songs.length === 0) {
    console.log('No songs found in songs directory.');
    return;
  }

  state.songs.forEach((song, index) => {
    const marker = index === state.cursor ? '> ' : '  ';
    let status = '';
    if (index === state.currentIndex) {
      status = state.paused ? ' (paused)' : ' (playing)';
    }
    console.log(`${marker}${song.name}${status}`);
  });
}

// SIGSTOP and SIGCONT are the same syscalls as running `kill -SIGSTOP <pid>` in a terminal —
// they freeze/resume a process without killing it, unlike SIGKILL.
function togglePause(state) {
  if (!state || !state.player) {
    return;
  }

  if (state.paused) {
    state.player.kill('SIGCONT');
    state.paused = false;
  } else {
    state.player.kill('SIGSTOP');
    state.paused = true;
  }

  render(state);
}

/**
 * Plays a song at the specified index.
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
  stopBasic();

  const player = playBasic(state.songs[index].filePath);
  state.player = player;
  state.paused = false;

  player.on('exit', () => {
    if (state.player === player) {
      state.player = null;
      state.currentIndex = null;
      state.paused = false;
      render(state);
    }
  });

  render(state);
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
  if (state && state.player && state.paused) {
    try {
      state.player.kill('SIGCONT');
    } catch {}
  }
  stopBasic();
  if (state) {
    state.player = null;
    state.currentIndex = null;
    state.paused = false;
  }
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
createApp.cleanupAndExit = cleanupAndExit;
createApp.default = createApp;

module.exports = createApp;
