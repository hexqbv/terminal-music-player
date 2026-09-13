// VLC playback wrapper using RC interface.
// This replaces the afplay based player because afplay has no stdin and cannot be paused correctly.
// VLC's RC (remote control) interface allows sending "pause" and "quit" commands over stdin.

const { spawn, spawnSync } = require('child_process');

/**
 * Checks whether VLC is installed and accessible on the system PATH.
 * Uses spawnSync so the check is synchronous and happens before the app starts.
 *
 * @returns {boolean}
 */
function isVlcInstalled() {
  const result = spawnSync('vlc', ['--version'], { stdio: 'ignore' });
  // status === 0 means the command ran successfully.
  return result.status === 0;
}

function spawnVlc(filePath) {
  // --play-and-exit makes VLC exit after playback finishes.
  const vlc = spawn('vlc', ['--intf', 'rc', '--play-and-exit', filePath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  vlc.on('error', err => {
    console.error('Failed to start VLC:', err);
  });
  return vlc;
}

function sendCommand(vlc, command) {
  if (vlc && !vlc.killed) {
    vlc.stdin.write(`${command}\n`);
  }
}

function togglePauseVlc(vlc) {
  sendCommand(vlc, 'pause');
}

function quitVlc(vlc) {
  sendCommand(vlc, 'quit');
  // Safety net: kill if not exited after short delay.
  setTimeout(() => {
    if (vlc && !vlc.killed) {
      vlc.kill('SIGKILL');
    }
  }, 100);
}

// Query a numeric value from VLC RC interface.
function queryNumber(vlc, command) {
  return new Promise(resolve => {
    // Send command.
    sendCommand(vlc, command);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      resolve(null);
    }, 400);
    const onData = data => {
      if (timedOut) return;
      clearTimeout(timeout);
      // VLC replies with "<command>: <number>"
      const match = data.toString().match(/\d+/);
      if (match) {
        resolve(parseInt(match[0], 10));
      } else {
        resolve(null);
      }
      // Remove listener after first data.
      vlc.stdout.removeListener('data', onData);
    };
    vlc.stdout.once('data', onData);
  });
}

// Return current playback time in seconds.
async function getTime(vlc) {
  try {
    const sec = await queryNumber(vlc, 'get_time');
    return sec;
  } catch {
    return null;
  }
}

// Return total track length in seconds.
async function getLength(vlc) {
  try {
    const sec = await queryNumber(vlc, 'get_length');
    return sec;
  } catch {
    return null;
  }
}

module.exports = {
  isVlcInstalled,
  spawnVlc,
  sendCommand,
  togglePauseVlc,
  quitVlc,
  getTime,
  getLength
};
