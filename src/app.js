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
      cleanup();
      process.exit(0);
    }

    if (key === 'p' || key === 'space') {
      togglePause(state);
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
        state.currentIndex = state.cursor;
        stopBasic();
        const player = playBasic(state.songs[state.cursor].filePath);
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
    }
  };

  process.stdin.on('data', onData);

  function cleanup() {
    if (state.player && state.paused) {
      try {
        state.player.kill('SIGCONT');
      } catch {}
    }
    stopBasic();
    state.player = null;
    state.currentIndex = null;
    state.paused = false;
    process.stdin.removeListener('data', onData);
    if (process.stdin.setRawMode) {
      try {
        process.stdin.setRawMode(false);
      } catch {}
    }
    process.stdin.pause();
  }

  state.togglePause = () => togglePause(state);
  state.cleanup = cleanup;

  process.stdin.once('end', cleanup);
  process.once('exit', cleanup);
  process.once('SIGINT', () => {
    cleanup();
    process.exit(0);
  });

  return state;
}

createApp.createApp = createApp;
createApp.startApp = createApp;
createApp.app = createApp;
createApp.render = render;
createApp.togglePause = togglePause;
createApp.default = createApp;

module.exports = createApp;
