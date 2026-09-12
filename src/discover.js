const fs = require('fs');
const path = require('path');

/**
 * Reads the songs directory and returns an array of { name, filePath }
 * for every .mp3 file, sorted alphabetically.
 *
 * @param {string} [songsDir] - Path to the songs directory
 * @returns {{ name: string, filePath: string }[]}
 */
function discoverSongs(songsDir = path.join(__dirname, '..', 'songs')) {
  if (!fs.existsSync(songsDir)) {
    return [];
  }

  const entries = fs.readdirSync(songsDir);

  return entries
    .filter(file => {
      if (path.extname(file).toLowerCase() !== '.mp3') {
        return false;
      }
      try {
        return fs.statSync(path.join(songsDir, file)).isFile();
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.localeCompare(b))
    .map(file => ({
      name: file,
      filePath: path.join(songsDir, file),
    }));
}

discoverSongs.discoverSongs = discoverSongs;
discoverSongs.default = discoverSongs;
module.exports = discoverSongs;
