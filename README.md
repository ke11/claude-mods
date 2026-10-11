# claude-mods

Claude Code mods: plugins of function hooks that draw inside the terminal.
The folder is a marketplace, so each mod installs by name.

## Install

At the Claude Code prompt:

```
/plugin marketplace add ke11/claude-mods
/plugin install pixbar@claude-mods
```

Pick the **user** scope to have it in every folder, then start a new session. Nothing
showing? Trust the folder when Claude Code asks: it loads no mods in an untrusted one.

Working on a mod from a clone: see [CONTRIBUTING.md](CONTRIBUTING.md).

## Mods

### pixbar

A pixel creature in a small world, in the band above the prompt. Two ship with it:
the whale, in a sea, and clawd, skating on land.

```
/pixbar                  # the menu: current theme and layout, and how to change them
/pixbar theme clawd      # pick a creature; kept for the next session
/pixbar theme whale
/pixbar layout pane      # a pane of its own, beside the transcript
/pixbar layout band      # back above the prompt
```

`/pixbar clawd` and `/pixbar pane` still work as shortcuts.

| Signal | In the sea | On land |
| --- | --- | --- |
| Context used | its colour, filling from the belly up, one pixel row per tenth | the same |
| Five-hour window | how high it swims: 100% at the surface, 0% on the seabed | the time of night: the moon crosses the sky and sets as it runs out |
| Uncommitted work | seagrass and litter on the seabed; committed, a clean floor | tufts and litter on the grass; committed, a clean floor |
| Idle | parked, blinking now and then | parked, its skateboard leaning beside it |
| Thinking | bobs, sonar arcs from the snout | stands still, eyes open, blinking |
| Tool use | swims fast, bubbles on every tool call | stands still with the wand out and its sparks, dust on every tool call |
| Responding | a spout at the surface, bubbles below it | skates, jumping once a beat |

Beside it: context in tokens against the session's limit (the compaction window,
as `/context` measures it), each rate-limit window with its reset time, and the
context window by category (`c` hides it).

**Band or pane.** `placement` in `/config` sets where it lives: `band` (above the
prompt, the default) or `pane` (a pane of its own, docked beside the transcript in
fullscreen; opened unasked it needs a terminal 144 columns wide). Closing the pane
sends it back to the band.

**Creatures.** The whale is built in; the others are skin files in `pixbar/skins/`,
the same format [pixbar.dev](https://pixbar.dev) uses — add one there and it is
pickable. Skins under `~/.claude/pixbar/skins/` are found too. A skin with
`HABITAT='land'` walks on grass instead of swimming. The choice lives in
`~/.claude/pixbar/active`.

## Develop

```bash
claude plugin validate pixbar
claude plugin test pixbar
```

## Changes and issues

What changed in each release: [CHANGELOG.md](CHANGELOG.md). Bugs and ideas:
[issues](https://github.com/ke11/claude-mods/issues). Security problems: [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE). An independent project, not affiliated with Anthropic.
