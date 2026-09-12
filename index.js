const path = require('path');
const readline = require('readline');
const { discoverSongs } = require('./src/discover');
const { playBasic, stopBasic } = require('./src/basicPlayer');

// The menu goes out through stdout and the user's choice comes back through stdin.
// By default, readline buffers input until Enter is pressed (cooked mode).
//
// Node doesn't decode audio itself — it spawns a separate OS process and hands off the file.
const songsDir = path.join(__dirname, 'songs');
const songs = discoverSongs(songsDir);

songs.forEach((song, index) => {
  console.log(`${index + 1}. ${song.name}`);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Pick a number to play (q to quit): ', (answer) => {
  const trimmed = answer.trim();

  if (trimmed.toLowerCase() === 'q') {
    stopBasic();
    rl.close();
    return;
  }

  const num = Number(trimmed);
  if (Number.isInteger(num) && num >= 1 && num <= songs.length) {
    const selectedSong = songs[num - 1];
    console.log(`Selected: ${selectedSong.name}`);
    playBasic(selectedSong.filePath);
  } else {
    console.log('Error: Invalid selection');
  }

  rl.close();
});

process.on('exit', () => {
  stopBasic();
});

process.on('SIGINT', () => {
  stopBasic();
  process.exit();
});
