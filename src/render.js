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

/**
 * Formats seconds into "m:ss" string.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Renders a progress bar.
 * @param {number} elapsed
 * @param {number} duration
 * @param {number} [barWidth=30]
 * @returns {string}
 */
function renderProgressBar(elapsed, duration, barWidth = 30) {
  if (!duration || duration <= 0) {
    return '';
  }
  // Clamp the ratio to [0, 1]: VLC's get_time can slightly exceed get_length
  // near the end of a track, which would make `empty` negative and cause
  // String.repeat() to throw RangeError: Invalid count value.
  const ratio = Math.min(1, Math.max(0, elapsed / duration));
  // Second safety net: clamp filled to [0, barWidth] in case of float rounding.
  const filled = Math.min(barWidth, Math.max(0, Math.round(ratio * barWidth)));
  const empty = barWidth - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${formatTime(elapsed)} / ${formatTime(duration)}`;
}

/**
 * Writes a progress line in‑place without a trailing newline.
 * @param {string} text
 */
function writeProgressLine(text) {
  // \r returns to column 0 of the SAME line – that's the whole trick behind a live progress bar.
  process.stdout.write(`\r${clearLine()}${text}`);
}

module.exports = {
  moveCursorUp,
  clearLine,
  clearLines,
  formatTime,
  renderProgressBar,
  writeProgressLine,
};
