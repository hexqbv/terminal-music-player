const { spawn } = require('child_process');

// Module-level reference to the current child process for audio playback
let currentChild = null;

// Audio Architecture:
// Node doesn't decode audio itself — it spawns a separate OS process and hands off the file.

/**
 * Plays an audio file using macOS built-in afplay CLI as a child process.
 *
 * @param {string} filePath - Path to the audio file
 * @returns {import('child_process').ChildProcess}
 */
function playBasic(filePath) {
  if (currentChild) {
    stopBasic();
  }

  const child = spawn('afplay', [filePath]);
  currentChild = child;

  child.on('error', (err) => {
    console.error(`Audio playback error: ${err.message}`);
    if (currentChild === child) {
      currentChild = null;
    }
  });

  child.on('exit', (code, signal) => {
    if (currentChild === child) {
      currentChild = null;
    }
  });

  return child;
}

/**
 * Stops playback by killing the current child process with SIGKILL if one exists.
 */
function stopBasic() {
  if (currentChild) {
    currentChild.kill('SIGKILL');
    currentChild = null;
  }
}

module.exports = {
  playBasic,
  stopBasic,
};
