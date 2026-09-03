# CP-09 — Codex App Server Experiment Scope (Baseline)

Primary disposition: `EXTEND_EXISTING`

## New Idea Filter

1. Existing overlap: CP-00 through CP-08 established a read-only operational portfolio dashboard with verifiable source evidence.
2. Reuse: extend existing `ProjectState` and UI cards with a strict, exportable `TaskPacket` contract instead of building an external agent manager or parallel orchestrator.
3. Duplicate infrastructure: no background worker, database, daemon, or persistent orchestrator is introduced.
4. Outcome: operator can generate, validate, preview, and export a standardized Task Packet for `salamat-projects-dashboard` without giving execution authority to the dashboard.
5. Smallest validation: strict Zod schema, allowlist gating (restricted exclusively to `Murkin1980/salamat-projects-dashboard`), secret detection heuristics, one-shot stdio validation harness, and a read-only UI preview with safe cancellation.
6. Priority: safe evaluation baseline for CP-09 Codex App Server integration without breaking any Foundation invariants.
7. Deep-change risk: low; the dashboard remains a strict read-only visibility/control layer with zero execution authority.

## Included

- strict, versioned `TaskPacket` contract (`1.0.0`) defined in `src/contract/task-packet.ts`;
- fail-closed schema validation with `.strict()` rejection of unknown properties;
- strict allowlist gating allowing ONLY repository `Murkin1980/salamat-projects-dashboard` and project `salamat-projects-dashboard`;
- safe field schema: `schemaVersion`, `taskId`, `projectId`, `repo`, `checkpoint`, `triageState`, `nextAction`, `objective`, `scope` (`included`, `excluded`), `acceptanceCriteria`, `createdAt`, `evidenceRef`;
- sensitive data and secret pattern scanner rejecting tokens, API keys, private keys, passwords, cookies, and local absolute filesystem paths;
- read-only UI Task Packet preview modal with syntax-highlighted JSON, clipboard copy, JSON download export, and safe cancellation;
- one-shot stdio harness (`scripts/task-packet-harness.ts`) for CLI generation and validation;
- comprehensive automated negative and positive test suite (`tests/task-packet.test.ts`).

## Excluded

- cross-repository task execution or write-back;
- calling `turn/start` or any dynamic agent execution from the dashboard;
- persistent orchestrator, background daemon, Worker, or database;
- storing or transmitting private keys, tokens, session cookies, or secrets;
- raw GitHub artifact content persistence;
- modifying production Cloudflare Pages, DNS records, or live domains.

## Security and Invariants

- **Fail-Closed Validation:** any unknown field, missing required property, unsupported triage state, or unapproved repository fails validation immediately.
- **Strict Allowlist:** creation and export of Task Packets are strictly restricted to `Murkin1980/salamat-projects-dashboard`. All other repositories are rejected.
- **Secret Scanning:** automated heuristic detection catches GitHub PATs, Bearer tokens, cloud provider keys, and absolute filesystem paths (`/home/`, `/Users/`, `C:\`, etc.).
- **Read-Only Dashboard:** the UI does not trigger execution or modify remote repositories; modal cancellation is completely side-effect free.
- **One-Shot Harness:** the stdio harness executes in-memory validation/formatting and exits immediately (exit code 0 on success, exit code 1 on validation error).

## Acceptance Criteria

1. Strict Zod schema enforces all safe fields and rejects unknown properties.
2. Only `Murkin1980/salamat-projects-dashboard` is accepted by the repository allowlist.
3. Secret patterns and local absolute paths cause immediate schema validation failure.
4. Dashboard UI renders read-only preview and export for allowlisted project cards with explicit cancellation.
5. Stdio harness provides one-shot CLI validation and generation conforming to the approved schema without background processes.
6. `npm test` and `npm run build` pass with 0 errors.
