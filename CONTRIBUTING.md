# Contributing

Bug reports and ideas are welcome as [issues](https://github.com/ke11/claude-mods/issues).
For a bug, say which Claude Code version, terminal and OS you use, and whether you are on
a Claude subscription or an API key.

To work on a mod from a clone:

```bash
claude plugin marketplace add ./claude-mods   # the path to your clone
claude plugin install pixbar@claude-mods
claude plugin validate pixbar
claude plugin test pixbar
```

`claude --plugin-dir ./pixbar` loads a mod for one session without installing it.

A new creature is a skin file in `pixbar/skins/`; the README's "Make your own creature"
lists the fields, and `whale.sh` is the simplest example. The whale is also built into
`pixbar/hooks/scene.ts`: change both together, and `bun scripts/check-whale.ts` checks
they still match (CI runs it). Pull requests go against `master`; keep
`claude plugin test` passing.
