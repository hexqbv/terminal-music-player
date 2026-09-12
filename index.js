const path = require('path');
const { discoverSongs } = require('./src/discover');

// Node.js does not automatically know what files exist on disk.
// It must explicitly query the operating system via the 'fs' module.
const songsDir = path.join(__dirname, 'songs');
const songs = discoverSongs(songsDir);

songs.forEach((song, index) => {
  console.log(`${index + 1}. ${song.name}`);
});
