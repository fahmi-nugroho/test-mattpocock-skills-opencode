## Agent skills

### Issue tracker

Issues live as local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout. See `docs/agents/domain.md`.

## Git commits

Commit under the user's configured git identity — the one `git config user.name` and `git config user.email` report. Run a plain `git commit`, with no `-c user.name` / `-c user.email` flags, so every commit is attributed to the user.
