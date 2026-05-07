# launch screenshots

Source assets for launch-day social media.

## `benchmark-output.txt`

Captured from a real benchmark run via:

```bash
CONFIG_PATH=./config.local.yml node benchmark/run.mjs > launch/screenshots/benchmark-output.txt 2>&1
```

This is the raw text the user pastes into [carbon.now.sh](https://carbon.now.sh) on launch day to generate `benchmark-screenshot.png` — the image attached to the lead tweet of `twitter-thread.md`.

## Workflow on launch day

1. Re-run the benchmark to refresh `benchmark-output.txt` if you want the most recent run (recall is deterministic, but latency drifts).
2. Open `benchmark-output.txt`, copy the contents.
3. Paste into carbon.now.sh.
4. Tweak theme to taste (suggested: a dark theme with monospaced font; keep the window controls so the screenshot reads as terminal output).
5. Export as PNG. Save as `benchmark-screenshot.png` in this directory.
6. Attach to the lead tweet.

## Why text and not PNG checked in

The PNG depends on the user's chosen carbon.now.sh styling, and freezing one rendering choice into the repo is the wrong default. The text is the source of truth; the user picks the visual treatment at post time.
