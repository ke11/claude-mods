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

A new creature is a skin file in `pixbar/skins/`; `clawd.sh` shows the format. Pull
requests go against `master`; keep `claude plugin test` passing.
