/**
 * ANSI Terminal Rendering Helpers
 *
 * A terminal is a grid of character cells, not a webpage — there's no DOM,
 * so "updating" means overwriting the same cells using ANSI cursor escape codes.
 */

/**
 * Returns the ANSI escape sequence to move the cursor up by n lines.
 *
 * @param {number} [n=1] - Number of lines to move up
 * @returns {string} ANSI escape sequence
 */
function moveCursorUp(n = 1) {
  return `\x1b[${n}A`;
}

/**
 * Returns the ANSI escape sequence to clear the entire current line.
 *
 * @returns {string} ANSI escape sequence
 */
function clearLine() {
  return '\x1b[2K';
}

/**
 * Clears and moves the cursor back up over the last-printed menu block.
 *
 * @param {number} count - Number of lines to clear and move up
 * @returns {string} ANSI escape sequences applied
 */
function clearLines(count) {
  if (!count || count <= 0) {
    return '';
  }

  let seq = '';
  for (let i = 0; i < count; i++) {
    seq += moveCursorUp(1) + clearLine() + '\r';
  }

  if (process.stdout && typeof process.stdout.write === 'function') {
    process.stdout.write(seq);
  }

  return seq;
}

module.exports = {
  moveCursorUp,
  clearLine,
  clearLines,
};
