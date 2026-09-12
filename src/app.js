const { parseKey } = require('./keys');
const { playBasic, stopBasic } = require('./basicPlayer');

/**
 * Renders the songs menu to stdout with the current cursor position highlighted.
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
    console.log(`${marker}${song.name}`);
  });
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
        state.player = playBasic(state.songs[state.cursor].filePath);
        state.paused = false;
        render(state);
      }
    }
  };

  process.stdin.on('data', onData);

  function cleanup() {
    stopBasic();
    process.stdin.removeListener('data', onData);
    if (process.stdin.setRawMode) {
      try {
        process.stdin.setRawMode(false);
      } catch {}
    }
    process.stdin.pause();
  }

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
createApp.default = createApp;

module.exports = createApp;
