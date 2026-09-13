// VLC playback wrapper using RC interface.
// This replaces the afplay based player because afplay has no stdin and cannot be paused correctly.
// VLC's RC (remote control) interface allows sending "pause" and "quit" commands over stdin.

function spawnVlc(filePath) {
  const { spawn } = require('child_process');
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

module.exports = {
  spawnVlc,
  sendCommand,
  togglePauseVlc,
  quitVlc
};
