# Leaguepedia safe diagnostics implementation plan

**Goal:** Record enough safe evidence to distinguish HTTP rejection from a MediaWiki error without retaining arbitrary response text or credentials.
**Architecture:** Cargo response → fixed-field diagnostic → existing server log. No new storage schema, UI, dependencies, or retry policy.
**Execution:** Inline vertical TDD; preserve original workspace and cooldown.

- [x] Add one test in `tests/unit/leaguepediaDiagnostics.test.js`: real local HTTP 429 response through existing cargoQuery records status, rate-limit signal and numeric Retry-After, excludes injected secrets and does not retry. Run red, implement allowlisted diagnostic in `utils/leaguepediaApi.js`, run green.
- [x] Add one test for HTTP 200 MediaWiki rate-limit JSON: distinguish transport status from payload error code; only known codes/signals permitted. Run red, minimal implementation, green.
- [x] Test ordinary HTTP rejection and unknown JSON code, ensuring arbitrary text cannot enter diagnostics; test existing cooldown emits no upstream diagnostic. Refactor only if needed.
- [x] Run full coverage, doctor, build, audit and existing render/browser gates on branch. 635 total / 629 pass / 6 skip, audit zero, render 6/6, browser 5/5. No frontend changes or new screenshots required.
- [x] After real cooldown expires, perform exactly one controlled Cargo request for 2026-09-02; allow necessary login but intercept a second Cargo request before transmission. Do not manually clear cooldown or claim current success explains the earlier response. Result: fresh login and Cargo HTTP 200, one request and one row; normal successful-query cooldown clearing only.
- [ ] Review, commit, integrate main, rerun gates, push and verify original URL. Update HANDOFF with measured evidence and any remaining blocker; no publishing or new site.

Main integration is local at fe1e964; main tests/build/render/browser pass. Push is blocked on npm audit service 503/timeout (not an advisory); see HANDOFF. Do not repeat the completed live Cargo probe without new authorization.

Diagnostic fields: timestamp; stage (`http` or `mediawiki`); HTTP status; known error code or `other`; boolean rate-limit phrase; content type category; numeric Retry-After or null. Never retain body excerpts, URLs, cookies, headers wholesale, account names, token/password values, or arbitrary error codes. Use existing console output rather than another file store. Controlled request outputs fixed metadata only.
