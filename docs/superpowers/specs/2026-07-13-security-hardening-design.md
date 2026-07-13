# LoL Video Generator Security Hardening Design

## Context

The render boundary currently accepts request-controlled fields and builds a shell command with `child_process.exec`. Because schema normalization preserves unknown fields, a caller can inject a `compositionId` that becomes shell syntax. The public API also exposes expensive render and publishing operations without an operator boundary.

This repository is a portfolio project. Its interface and local authoring workflow must remain demonstrable, while production deployments must fail closed around compute-intensive or account-mutating actions.

## Goals

- Remove shell command construction from the render path.
- Select Remotion compositions only from the existing `dataType` mapping.
- Protect expensive render and publishing operations in production with an operator token.
- Preserve the current local development workflow and render output contract.
- Explain the security boundary in the README so interviewers can evaluate the design.

## Non-goals

- Redesigning the content factory or video templates.
- Adding user accounts, roles, or a database-backed identity system.
- Changing output filenames, video URLs, bilingual rendering, or publishing adapters.

## Design

### Shell-free rendering

`utils/render/renderService.js` will execute Remotion with `execFile` (or an injected equivalent) and a discrete argument array. No request value will be interpolated into a command string, and execution will use `shell: false`.

The composition identifier will be derived exclusively from `DATA_TYPE_TO_COMPOSITION` after `assertSupportedDataType` succeeds. A request-provided `compositionId` will not override this mapping. The render service's injectable test boundary will receive the executable plus arguments so tests can verify exact values without starting Remotion.

### Operator-only production mutations

A small server-side guard will protect every exported `POST` handler under `app/api/`, covering analysis, scans, renders, queue/store writes, insights writes, and social publishing. In production, the guard will require a constant-time match against `PORTFOLIO_OPERATOR_TOKEN`. Missing configuration will fail closed. Read-only `GET` handlers and OAuth provider callbacks retain their existing contracts.

Loopback development remains usable without a token when `NODE_ENV` is not `production`. Read-only portfolio pages and data previews remain accessible. In portfolio production mode, controls backed by protected POST routes are disabled and accompanied by a short explanation plus the existing demo media, so interviewers do not encounter unexplained 401 responses. The token is never placed in a `NEXT_PUBLIC_*` variable, logged, committed, or returned to the browser.

### Errors

- Invalid or retired `dataType`: HTTP 400 with the existing unsupported-type message.
- Missing or incorrect production operator token: HTTP 401 with a generic error.
- Render process failure: retain the existing failure response without exposing the token or a shell command.

## Data flow

1. A request reaches a protected mutation route.
2. The production guard authorizes the operator token; local development bypasses only in non-production mode.
3. The request payload is normalized and its `dataType` is validated.
4. The service maps the validated type to a fixed Remotion composition.
5. Remotion is launched with an executable and argument array, without a shell.
6. The existing response shape returns generated video metadata.

## Testing strategy

Every behavior change follows one Red → Green → Refactor slice:

1. Add a regression test proving a malicious `compositionId` cannot enter executable arguments; observe the current test fail.
2. Replace shell execution and fixed-map the composition; verify the regression and existing render tests pass.
3. Add a route-guard test proving production requests without a token return 401; observe failure, then implement the minimal guard.
4. Add a companion test proving valid operator access and non-production local rendering still work.
5. Run the complete Node test suite, coverage gate, Next production build, `npm audit`, secret scan, and a local render-service smoke test with an injected process runner.

## Portfolio documentation

The README will include a concise Security Design section covering shell-free process execution, composition allowlisting, production operator authorization, secret handling, and the commands used to verify the project.

## Acceptance criteria

- No `exec(commandString)` remains on the request-to-render path.
- Request input cannot select an arbitrary Remotion composition or add process arguments.
- Production mutation routes fail closed without the operator token.
- Existing local authoring and bilingual-render tests remain green.
- The production build and dependency audit complete successfully.
