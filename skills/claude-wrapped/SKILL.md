---
name: claude-wrapped
description: 'Build a Spotify-Wrapped-style "Claude Wrapped" year in review from the local Claude Code transcripts, with a generated soundtrack. Use for "claude wrapped", "my year with Claude", "wrap my Claude usage" or a shareable usage recap. Works for anyone: stats come from ~/.claude/projects, the story lines come from you.'
---

# Claude Wrapped

A 16-slide story page (first session, monthly crescendo, busiest day, streak, peak hour, tools,
models, projects, spotlights, receipt) with a soundtrack the browser plays itself: one track per
slide, Web Audio only, no audio files. Slides with no data drop out and the rest renumber.

## 1. Count (script, no judgment)

```bash
python -I scripts/wrapped_stats.py --out <scratch>/stats.json [--since 2026-01-01] [--root <dir>/projects]
```

It reads every `projects/**/*.jsonl` under `$CLAUDE_CONFIG_DIR` and `~/.claude` (add `--root` for
another machine's copy) and prints the counts. It never writes outside `--out`.
Read `stats.json` before writing anything: every number on the page comes from it.
If `top_word` is boilerplate a hook or tool types for the person (e.g. "left" from "You left this
undone"), rerun with `--ignore-prompt "^You left this undone"` until it is a word they typed.
Transcripts older than Claude Code's `cleanupPeriodDays` are gone; `range` says what was counted.

## 2. Write the story (you)

Write `<scratch>/story.json`. Every key is optional; leave out what you cannot back up.

| Key | What goes in it |
|---|---|
| `name`, `org` | The person and, if they want it, their company: on slide 1 and the receipt |
| `intro` | One line for slide 1, e.g. "From a pilot to an agent fleet that ships its own PRs." |
| `month_notes` | `{"2026-09": "what got built that month"}`; 4 to 8 words each, from session titles |
| `built` | Up to 6 `{title, when: "OCT 2026", what}` cards: the things they made |
| `systems_built` | A count, only if they keep one (a registry, a repo list) |
| `eras` | `[{date, label}]` highlight rows for the skill-ramp timeline, e.g. "Agents on a schedule" |
| `switch` | `{date, title, caption, label}` for a turning point, e.g. moving from chat to Claude Code |
| `extra_firsts` | `[{date, label}]` rows for slide 1, e.g. a first session in another app |
| `project_names` | `{"folder-name": "Display Name"}` when a repo folder name reads badly |
| `source_note` | A line for the receipt footer, e.g. "Some projects left out." |

Find the material in `stats.json` (titles, projects, months) and, if the user wants more, by
reading session titles in the transcripts. Never invent a number; say "estimate" where it is one.
Ask the user before naming a client, a coworker or private work on a page others will see.

## 3. Render, check, publish

```bash
python -I scripts/render.py <scratch>/stats.json <scratch>/story.json -o <scratch>/wrapped.html
```

Open it at 390 px wide and check: no slide is empty, the sound pill reads "Tap for sound", and a
tap starts "02 · ..." (headless: `--autoplay-policy=no-user-gesture-required`). Then publish the
page as a private artifact (or hand over the HTML file) and give the link. Sharing it is the
user's call.

## Soundtrack

`assets/music.js` holds the engine (`window.wrappedMusic`); `slides.js` builds the slides and
`story.js` runs paging, counters and copy. `render.py` inlines all three into `template.html`. Tracks are keyed by the
`data-slide` names: change a track's title, tempo, root note, chords or intensity in the `T`
table. Browsers block sound until a tap, so the first tap or key starts it; the pill mutes it and
remembers the choice.

## Checks

`python -I scripts/wrapped_stats.py --selftest` and `python -I scripts/render.py --selftest`.
