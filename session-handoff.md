# CineBook — Session Handoff

<!-- Fill this out at the end of every session before stopping. -->

## Verified Now

- What is currently working:
- What verification actually ran (commands + output summary):

## Changed This Session

- Code or behavior added/changed:
- Harness or config changes:
- Migration files created (list names):

## Broken or Unverified

- Known defect:
- Unverified path:
- Risk for the next session:

## Next Best Step

- Active feature (from feature_list.json):
- Why it is next:
- What counts as passing (copy from feature_list.json verification steps):
- What must not change during that step:

## Commands

- Startup: `./init.sh`
- Backend tests: `cd backend && uv run python manage.py test`
- Frontend type check: `cd frontend && pnpm run type-check`
- Focused debug: `cd backend && uv run python manage.py test <app>.tests.<module>`
