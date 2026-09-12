/**
 * Decodes a raw Buffer from stdin into a friendly key name.
 *
 * @param {Buffer|number[]|string} buffer - Raw input buffer from stdin
 * @returns {string} Friendly key name (e.g., 'up', 'down', 'ctrl-c', 'enter', 'space', or lowercase character)
 */
function parseKey(buffer) {
  if (!buffer || buffer.length === 0) {
    return '';
  }

  if (typeof buffer === 'string') {
    buffer = Buffer.from(buffer);
  } else if (Array.isArray(buffer)) {
    buffer = Buffer.from(buffer);
  }

  // 3-byte ANSI escape sequences for arrow keys: ESC [ <letter>
  if (buffer.length === 3 && buffer[0] === 27 && buffer[1] === 91) {
    switch (buffer[2]) {
      case 65:
        return 'up';
      case 66:
        return 'down';
      case 67:
        return 'right';
      case 68:
        return 'left';
    }
  }

  // Single-byte control keys
  if (buffer.length === 1) {
    switch (buffer[0]) {
      case 3:
        return 'ctrl-c';
      case 13:
      case 10:
        return 'enter';
      case 32:
        return 'space';
    }
  }

  if (buffer.length === 2 && buffer[0] === 13 && buffer[1] === 10) {
    return 'enter';
  }

  // Fall back to raw lowercase character
  return buffer.toString('utf8').toLowerCase();
}

// Inline tests to demonstrate correct decoding
if (require.main === module) {
  console.log('Testing parseKey:');
  console.log('Arrow Up [27, 91, 65]    ->', parseKey(Buffer.from([27, 91, 65])));
  console.log('Arrow Down [27, 91, 66]  ->', parseKey(Buffer.from([27, 91, 66])));
  console.log('Arrow Right [27, 91, 67] ->', parseKey(Buffer.from([27, 91, 67])));
  console.log('Arrow Left [27, 91, 68]  ->', parseKey(Buffer.from([27, 91, 68])));
  console.log('Ctrl-C [3]               ->', parseKey(Buffer.from([3])));
  console.log('Enter [13]               ->', parseKey(Buffer.from([13])));
  console.log('Space [32]               ->', parseKey(Buffer.from([32])));
  console.log('Char "q"                 ->', parseKey(Buffer.from('q')));
  console.log('Char "Q"                 ->', parseKey(Buffer.from('Q')));
  console.log('Char "A"                 ->', parseKey(Buffer.from('A')));
}

parseKey.parseKey = parseKey;
parseKey.default = parseKey;
module.exports = parseKey;
