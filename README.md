# devlove

Count how many times you've been kind to your coding agents.

`devlove` scans your local agent session storage and tallies the nice things
you've said — `thanks`, `please`, `great work`, `bro`, `sorry`, `love`, and
friends. It's the friendly cousin of [`devrage`](https://github.com/gricha/devrage),
which counts the opposite.

## Install

```bash
npx devlove
```

Or globally:

```bash
npm install -g devlove
```

## Usage

```bash
devlove          # scan everything
devlove scan     # same thing
devlove scan --agent claude          # one agent
devlove scan --since 2026-01-01      # date range
```

## Example output

```
  devlove report
  ──────────────────────────────

  messages scanned    13239
  total kind words    1375

  by agent
    claude        6 in 953 messages (0.6%)
    codex        66 in 550 messages (12.0%)
    cursor       12 in 95 messages (12.6%)
    opencode   1291 in 11639 messages (11.1%)

  top words
    please        650 (pls 79, plz 1)
    great         226 (nice 47, amazing 15, awesome 7, solid 7, excellent 3, lifesaver 1, fantastic 1, brilliant 1, incredible 1)
    sorry         195 (mb 132, my bad 8, oops 5)
    bro           150 (mate 43, friend 23, legend 14, buddy 5, boss 2, goated 2, pal 1, boss man 1, gang 1, gng 1, goat 1)
    thanks        109 (ty 19, thank you 13, cheers 13)
    great work     29 (great job 10, well done 7, good work 2, good job 2, good stuff 1, nice job 1, nice work 1)
    love           14 (ily 1, kiss 1)
    yay             2

  your agents felt the love. 1375 times over.
```

## Supported agents

Reads from local session storage for:

- **Claude** (Claude Code)
- **Codex**
- **Cursor**
- **OpenCode**
- **Amp**
- **Cline** (VS Code / Cursor extension)
- **Zed**

All scanning is local — nothing leaves your machine.

## Credits

- Forked from [`gricha/devrage`](https://github.com/gricha/devrage) — the
  original profanity-counting version. All session adapters and the core
  detection architecture come from there.
- Cursor adapter contributed by [@danperks](https://github.com/danperks) in
  [gricha/devrage#4](https://github.com/gricha/devrage/pull/4).

## License

MIT — see [LICENSE](./LICENSE).
