# Git Rules
## 1) Branch Naming (Trunk-from-Develop)
 
**Format:** 
```
<type>/<optional-scope>-<short-kebab-desc>
```

**Types (branch):** `feat | fix | chore`

**Examples:** `feat/booking-wizard`, `fix/auth-token-refresh`

Scopes (from SRS, optional): auth, movies, showtimes, booking, pos, admin, promotions, employees, rooms, seed

**Examples:**
```
feat/booking-wizard
fix/auth-token-refresh
chore/seed-demo-data
```
🔎 Tips
- Keep branches **short‑lived** (ideally < 2–3 days).
- One task = one branch = one MR.

## 2) Commit Messages (Conventional Commits)
 
**Format:** 
```
<type>(optional-scope): <short description>
```

**Types (commit):** `feat | fix | chore`

**Examples:**
 
```
feat(movies): list & detail with showtimes by date
fix(booking): prevent double-booking on confirm
chore(seed): add demo data for rooms and employees
```
🔎 Quick remember:
**feat** (new capability), **fix** (bug), **chore** (non-feature: config, deps, scripts)
 
## 3) Workflow: develop → feature branch → MR → review → merge
 
**Branch/commit types:** feat | fix | chore

**MR target:** develop (protected)

**Never push directly** to main or develop.
 
### 3.1 Create a feature branch from develop
 
```bash
# Sync local develop with remote (fast-forward only to avoid stray merges)
git checkout develop
git fetch origin && git merge --ff-only origin/develop

# Create short-lived branch
git checkout -b feat/booking-wizard
# other examples:
# git checkout -b fix/auth-token-refresh
# git checkout -b chore/seed-demo-data
```
 
- (Optional, one-time) safer defaults:
 
```bash
git config --global pull.rebase true       # prefer rebase when pulling
git config --global rebase.autoStash true  # stash/restore changes during rebase
git config --global pull.ff only           # only fast-forward on shared branches
```
 
### 3.2 Keep your branch up to date
 
```bash
git fetch origin
git rebase origin/develop

# if the branch was pushed before:
git push --force-with-lease
```
 
### 3.3 Open Merge Request (target: develop)
 
- Source: your branch (e.g., feat/booking-wizard)
- Target: develop
- Title: Conventional Commit style (short, clear)
- Assignees/Reviewers: ≥ 1 reviewer
- Options: enable Squash commits and Delete source branch after merge
 
**MR description (paste & fill):**
```
## Context
- Why / user story / SRS mapping

## Scope of change
- BE: endpoints/logic
- DB/Migrations: yes/no
- Docs: Swagger/README updated

## Test
- Manual steps / screenshots (FE)
- Example curl / expected response (BE)

## Checklist
- [ ] FE: npm ci && npm run build OK / lint OK
- [ ] BE: tests/lint OK (black/ruff or equivalent)
- [ ] Migrations created/applied (if any)
- [ ] Swagger/schema/README updated (if any)
- [ ] No console.log / dead/commented code
- [ ] No unrelated files in diff (e.g., lockfile unless deps changed)
```
 
### 3.4 Merge & cleanup
 
```bash
# In GitLab UI: Squash & Merge, delete source branch

# Update local & prune stale refs
git checkout develop
git fetch origin && git merge --ff-only origin/develop
git fetch -p
```
 
### 3.5 Resolve conflicts (rebasing)
 
```bash
git checkout feat/booking-wizard
git fetch origin
git rebase origin/develop
# resolve conflicts -> test/lint
git add .
git rebase --continue
git push --force-with-lease
```

## 4) Quick Command Cheatsheet
```
# Start a task
git checkout develop
git fetch origin && git merge --ff-only origin/develop
git checkout -b feat/<scope>-<desc>

# Commit
git add .
git commit -m "feat(<scope>): <short description>"

# Sync with develop
git fetch origin
git rebase origin/develop
git push --force-with-lease   # only for your feature branch

# Open MR -> target: develop (squash + delete source)

# After merge, refresh local
git checkout develop
git fetch origin && git merge --ff-only origin/develop
git fetch -p
```