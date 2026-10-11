# Changelog

Releases of the mods in this marketplace. Versions follow each mod's `plugin.json`.

## pixbar

### 0.5.2 (2026-10-11)

- A hint after `/pixbar` as you type it: every theme you can pick, then the layouts.

### 0.5.1 (2026-10-11)

- `skins/whale.sh`: the whale as a skin file next to clawd, and the simplest example of the format. The built-in whale is still the fallback, and a check keeps the two identical.
- The whale is named `whale`; `whaleagent`, its old name, still loads.
- README: previews of both creatures, every skin field, troubleshooting.

### 0.5.0 (2026-10-11)

- `/pixbar theme whale|clawd` picks the creature; `/pixbar layout band|pane` picks where it lives.
- A bare `/pixbar` shows a menu: the current theme and layout, and the command to change each.
- Clearer replies: `✓` when a change lands, `✗` with the right command when it doesn't.
- `/pixbar clawd` and `/pixbar pane` still work as shortcuts.

### 0.4.0 (2026-10-09)

- Clawd skates on its board while answering.
- Uncommitted work leaves plants and litter on the floor; a commit clears it.
- One scene layout for both creatures, with the context window by category beside it (`c` hides it).

### 0.3.0 (2026-10-09)

- Renamed from `pixbar-whale` to `pixbar`.
- Clawd ships with it, on land: the five-hour window moves the moon across the sky.
- Skin files: drop one in `~/.claude/pixbar/skins/` and it can be picked. A skin without `HABITAT` takes it from the shipped skin (0.3.1).

### 0.2.0 (2026-10-09)

- Full-width band, or a pane of its own (`placement` in `/config`).
- Context measured against the session's own limit, as `/context` reports it.
- Layout and sky fixes (0.2.1 to 0.2.3).

### 0.1.0 (2026-10-09)

- The whale in a small sea above the prompt.
