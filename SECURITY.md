# Security

PixBar runs inside Claude Code on your machine. It reads what Claude Code passes it and
your local `git status`, writes one file (`~/.claude/pixbar/active`), and makes no
network calls.

If you find a security problem, report it privately through
[GitHub's private vulnerability reporting](https://github.com/ke11/claude-mods/security/advisories/new)
rather than in a public issue. You'll get a reply within a few days.
