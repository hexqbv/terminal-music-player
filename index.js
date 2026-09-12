const path = require('path');
const { discoverSongs } = require('./src/discover');
const { createApp } = require('./src/app');

const songsDir = path.join(__dirname, 'songs');
const songs = discoverSongs(songsDir);

createApp(songs);
