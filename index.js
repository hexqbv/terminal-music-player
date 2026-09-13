const path = require('path');
const { discoverSongs } = require('./src/discover');
const createApp = require('./src/app');
const { isVlcInstalled } = require('./src/vlcPlayer');

// 1. Guard: VLC must be installed.
if (!isVlcInstalled()) {
  console.error('Error: VLC is not found on your PATH.');
  console.error('Install it from https://www.videolan.org/vlc/ then try again.');
  process.exit(1);
}

const songsDir = path.join(__dirname, 'songs');
const songs = discoverSongs(songsDir);

// 2. Guard: songs/ folder must not be empty.
if (!songs || songs.length === 0) {
  console.error(`No audio files found in ${songsDir}.`);
  console.error('Drop some .mp3 (or .flac/.wav) files into the songs/ folder and run again.');
  process.exit(1);
}

createApp(songs);
