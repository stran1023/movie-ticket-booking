# CineBook — Quality Score

Tracks whether the codebase is getting stronger or weaker. Update after each significant feature or fix.

## Grading Scale

- `A` — verified, legible, stable, boundaries enforced
- `B` — working with minor gaps
- `C` — partially working, notable gaps or instability
- `D` — broken, unsafe, or structurally unclear

## Domain Health

| Domain | Grade | Verification | Agent Legibility | Test Stability | Key Gaps | Last Updated |
|--------|-------|-------------|-----------------|---------------|----------|-------------|
| `users` | B | Manual | Good — services.py well documented | Unknown | No test coverage tracked | 2026-06-25 |
| `movies` | B | Manual | Good | Unknown | No test coverage tracked | 2026-06-25 |
| `cinemas` | B | Manual | Good — Redis keys documented | Unknown | Concurrency tests not confirmed | 2026-06-25 |
| `bookings` | B | Manual | Good — Lua CAS documented | Unknown | Payment callback replay not tested | 2026-06-25 |
| `promotions` | B | Manual | Good | Unknown | FlatPricePromotion nightly task coverage unclear | 2026-06-25 |
| `concessions` | B | Manual | Adequate | Unknown | — | 2026-06-25 |
| `analytics` | C | Blocked | PDF generator in-progress | None yet | `analytics-001` active; no tests passing | 2026-06-25 |
| Frontend booking wizard | B | Manual (browser) | Good — step breakdown documented | N/A | WebSocket reconnect path not exercised in tests | 2026-06-25 |

## Architectural Layers

| Layer | Grade | Boundary Enforcement | Agent Legibility | Key Gaps | Last Updated |
|-------|-------|---------------------|-----------------|----------|-------------|
| Models / BaseModel | A | Enforced (soft delete, NotDeletedManager) | Good | — | 2026-06-25 |
| Services | B | Documented, not mechanically enforced | Good | No lint rule preventing business logic in views | 2026-06-25 |
| API Views (DRF) | B | permission_classes required per view | Good | — | 2026-06-25 |
| Frontend API Client | A | Modules in lib/api/; interceptor centralised | Good | — | 2026-06-25 |
| Frontend Components | B | Server-first rule documented | Good | ignoreBuildErrors masks type regressions | 2026-06-25 |

## Harness Health

| Date | Score | Bottleneck | Notes |
|------|-------|-----------|-------|
| 2026-06-25 | 100/100 | — | Harness bootstrapped this session |

## Simplification Log

| Date | Component Removed / Changed | Outcome | Decision |
|------|-----------------------------|---------|----------|
| — | — | — | — |
