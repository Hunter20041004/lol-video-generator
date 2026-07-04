# TDD Rollout

This project uses vertical TDD: each feature line gets tests before or alongside the implementation, then the tested surface expands only as that feature changes.

The enforceable source of truth is `config/tdd-coverage.json`. A feature is not considered TDD-covered until its production files and tests are registered there.

## Test Commands

- `npm test`: run all project tests.
- `npm run test:unit`: run unit tests only.
- `npm run test:coverage`: run the active vertical slice with 80% minimum line, branch, and function coverage.
- `npm run test:watch`: watch mode while working on one feature.
- `npm run tdd:doctor`: validate the TDD manifest.
- `npm run verify`: validate the TDD manifest, run coverage-gated tests, then run `next build`.

## Coverage Gate

Every TDD vertical slice must keep at least:

- 80% line coverage
- 80% branch coverage
- 80% function coverage

The active coverage include list starts with the tested publishing OAuth/config slice:

- `utils/publishing/accounts.js`
- `utils/publishing/metaAuth.js`

When the next vertical slice is moved into TDD, add a new slice to `config/tdd-coverage.json`. Do not edit the coverage command in `package.json`; it is generated from the manifest.

## Vertical Slice Order

1. Publishing OAuth and account config.
2. Publishing adapters and queue state transitions.
3. Render routing and bilingual payload normalization.
4. Patch/item/rune analysis payload validation.
5. Riot localization and Data Dragon asset resolution.
6. Remotion pure view-model helpers.
7. Frontend API integration state transitions.

## Working Rule

For each new feature or bug:

1. Add or update the smallest failing test that captures the behavior.
2. Implement the narrowest fix.
3. Run the feature test first.
4. Add or update the vertical slice in `config/tdd-coverage.json`.
5. Run `npm run verify` before considering the slice done.

Avoid broad snapshot tests for Remotion visuals unless the layout is stable. Prefer testing the pure helper that builds the scene data, then use still/video review for final visual QA.

## New Feature Gate

Every new feature must land as one vertical slice:

- API behavior: route helper/parser/schema tests first.
- Remotion behavior: pure data/view-model tests first, visual QA second.
- Frontend behavior: payload validation/state transition tests first, browser QA second.
- Bug fix: regression test first, then the fix.

Target coverage for every registered slice is at least 80% lines, branches, and functions. If a file is too UI-heavy to test directly, extract the decision logic into a helper and register that helper in the slice.
