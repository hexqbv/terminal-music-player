const path = require('path');
const readline = require('readline');
const { discoverSongs } = require('./src/discover');

// The menu goes out through stdout and the user's choice comes back through stdin.
// By default, readline buffers input until Enter is pressed (cooked mode).
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
    rl.close();
    return;
  }

  const num = Number(trimmed);
  if (Number.isInteger(num) && num >= 1 && num <= songs.length) {
    const selectedSong = songs[num - 1];
    console.log(`Selected: ${selectedSong.name}`);
  } else {
    console.log('Error: Invalid selection');
  }

  rl.close();
});
