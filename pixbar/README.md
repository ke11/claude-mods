# PixBar

A pixel creature above your Claude Code prompt, or in a pane of its own: the whale in a
sea, or clawd skating on land. It moves with the turn, fills with your context, rises
with your five-hour usage window, and leaves litter on the floor until you commit.

Install, commands, skins and troubleshooting: the [main README](../README.md) and
[pixbar.dev](https://pixbar.dev).

## What it reads, writes and runs

PixBar makes no network calls and sends nothing anywhere.

**Reads**

- What Claude Code passes a mod: the working folder, the model name, context and
  rate-limit usage, and when a turn or a tool call starts and ends. It does not read
  your prompts, the replies or tool results.
- The `HOME` environment variable, to find `~/.claude/pixbar`. No other variable, and no
  credential.
- Your own skin files in `~/.claude/pixbar/skins/`. They are read as text for their pixel
  rows and colours, and never run. The shipped creatures are text inside the mod
  (`hooks/skins.ts`): it reads no file of its own.

**Writes** no file. Your theme and the theme setting last seen in `/plugin configure`
are kept in the mod's own store, which Claude Code holds for it. Versions before 0.5.4
wrote two one-line files, `~/.claude/pixbar/active` and `configured`; they are still read
when the store holds nothing, and never written.

**Runs** one program, every five seconds, in the session's working folder:

```
git status --porcelain=v1 -b
```

Its output gives the branch name and whether there is uncommitted work. It stays in the
mod.

**Hooks**

- `command.run` for its own `/pixbar` command only.
- `tool.call`, to add a bubble when a tool starts. It never changes or blocks a call.
- `ui.render`, to draw the band above the prompt, the pane and the spinner row.
- `ui.close`, to move the creature back to the band when its pane is closed.
- `session.start`, `session.measure`, `turn.start`, `turn.complete`, to follow the turn.
