# Terminal Music Player

A fully interactive command-line music player written in Node.js.
Built as a tour of core systems concepts: raw I/O, child processes, ANSI escapes, and signal handling.

---

## Setup

### 1. Install VLC

The player uses VLC as its audio engine via its **RC (remote control)** interface.

| Platform | Command / Download |
|---|---|
| macOS (Homebrew) | `brew install vlc` |
| Ubuntu / Debian | `sudo apt install vlc` |
| Windows / manual | https://www.videolan.org/vlc/ |

### 2. Drop audio files into `songs/`

```
music-player/
└── songs/
    ├── track01.mp3
    ├── track02.flac
    └── ...
```

Any `.mp3`, `.flac`, `.wav`, `.ogg`, or `.m4a` file is picked up automatically.

### 3. Run

```bash
npm start        # equivalent to: node index.js
```

If VLC is not on your PATH you will see a clear error with a download link and the process exits with code 1.
If `songs/` is empty you will see a message telling you where to put files.

---

## Controls

| Key | Action |
|---|---|
| `↑` / `↓` | Move cursor up / down |
| `Enter` | Play highlighted song |
| `p` or `Space` | Pause / resume |
| `n` | Next track (wraps around) |
| `b` | Back / previous track (wraps around) |
| `q` or `Ctrl-C` | Quit (restores terminal) |

---

## Architecture

Each source file is a focused demonstration of one systems concept.

### `src/discover.js` — filesystem I/O
Uses `fs.readdirSync` to scan the `songs/` directory and filter by audio extension.
Concept: reading the filesystem, path manipulation.

### `src/keys.js` — raw keyboard bytes
Decodes raw `Buffer` chunks from stdin into human-readable key names.
Arrow keys arrive as 3-byte ANSI escape sequences (`[27, 91, 65]` = up, etc.).
Control characters are single bytes (`3` = Ctrl-C, `13` = Enter, `32` = Space).
Concept: understanding that keyboard input is just bytes, not "keys".

### `src/app.js` — stdin in raw mode, child_process, state machine
Calls `process.stdin.setRawMode(true)` — the Node equivalent of `stty raw`.
This turns off line buffering so every keystroke is delivered immediately to the
`'data'` handler instead of only arriving after the user presses Enter.

The app state is a plain object:

| Field | Meaning |
|---|---|
| `songs` | Ordered list of discovered audio files |
| `cursor` | Index of the highlighted (but not necessarily playing) row |
| `currentIndex` | Index of the song currently being played by VLC |
| `player` | Reference to the VLC `ChildProcess` |
| `paused` | Whether VLC is currently paused |
| `duration` | Total track length in seconds (fetched once from VLC) |
| `elapsed` | Current playback position in seconds (polled every 500 ms) |
| `progressTimer` | The `setInterval` ID for the progress bar |

### `src/vlcPlayer.js` — child_process & two-way IPC
Spawns VLC with `stdio: ['pipe', 'pipe', 'pipe']` so all three streams are
available as Node streams. Commands are sent by writing to `vlc.stdin`; query
results are read from `vlc.stdout`.

**Why VLC instead of `afplay`?**
`afplay` has no stdin — it cannot receive commands after it starts.
Pausing it with `SIGSTOP` freezes the OS process, but the audio clock inside
macOS's audio subsystem keeps ticking, so resuming after a pause skips ahead.
VLC's RC interface is a genuine two-way protocol: VLC tracks its own position
and `get_time`/`get_length` always return accurate values.

### `src/render.js` — ANSI escape codes
A terminal is a grid of character cells, not a webpage — there is no DOM.
"Updating" the display means overwriting the same cells using ANSI sequences:

| Sequence | Meaning |
|---|---|
| `\x1b[<n>A` | Move cursor up *n* lines |
| `\x1b[2K` | Clear the entire current line |
| `\r` | Carriage return — move to column 0 of the **same** line |

`\r` without `\n` is the trick behind a live progress bar: write the bar,
then write `\r` before the next update to overwrite the same line in place.

---

## Signal handling and orphan-process cleanup

When the user quits (via `q`, `Ctrl-C`, `SIGINT`, or `SIGTERM`), `cleanupAndExit`
runs exactly one exit path:

1. Send VLC the `quit` command via its RC interface.
2. Send `SIGKILL` as a safety net after 100 ms so VLC cannot linger.
3. Call `process.stdin.setRawMode(false)` to restore normal terminal behaviour.
4. Call `process.stdin.pause()` to release the stdin stream.
5. Call `process.exit(0)`.

**Why is this necessary?**
Without cleanup, two things go wrong:

* **Orphaned child process** — the VLC process keeps running in the background
  with no parent to stop it. You would have to find it with `ps` and kill it
  manually: `kill -9 <pid>`.
* **Stuck raw mode** — the terminal stays in raw mode after the Node process exits.
  Input is no longer echoed, `Enter` no longer works, and the shell appears broken
  until you run `stty sane` or open a new window.

A "skip" (next/previous) is just stop + `spawnVlc` on a different file — there
is no special seek command. Stopping and starting a fresh process is simpler
and more reliable than seeking inside VLC over RC.

---

## Project layout

```
music-player/
├── index.js           Entry point — guards, discovers songs, starts app
├── songs/             Drop your audio files here
└── src/
    ├── app.js         Main interactive loop (raw mode, state, key handling)
    ├── discover.js    Filesystem scan for audio files
    ├── keys.js        Raw buffer → key name decoder
    ├── render.js      ANSI helpers (cursor, clear, progress bar)
    ├── vlcPlayer.js   VLC RC interface wrapper
    └── basicPlayer.js Legacy afplay wrapper (kept as reference, not used)
```
