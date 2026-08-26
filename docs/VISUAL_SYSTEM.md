# VISUAL SYSTEM — CP-01

Status: APPROVED

## 1. Purpose
The dashboard must remain readable when the portfolio grows. Visual meaning is therefore deterministic: icon = entity type, status treatment = triage state, brand mark = external service identity.

## 2. Icon libraries
- System, node, file, state and control icons: **Tabler Icons**.
- External service and product logos: **Simple Icons** where an official recognizable mark is appropriate.
- Graph canvas implementation target: **React Flow**. It is a presentation/control layer only and must not become a workflow runtime.

## 3. Canonical entity icons
| Entity | Tabler icon |
|---|---|
| Project / repository | `folder-code` |
| AI agent | `ai-agent` |
| Agent group | `ai-agents` |
| AI router / gateway | `ai-gateway` |
| Codex / AI code execution | `code-ai` |
| Connection / integration | `connection` |
| API | `api` |
| Plugin / tool | `plug-connected` |
| Database | `database` |
| Serverless / Worker | `serverless` |
| Server / runtime | `server` |
| Git branch | `git-branch` |
| Pull request | `git-pull-request` |
| Document / spec | `file-text` |
| Evidence | `file-check` |
| Report / analytics | `report-analytics` |
| History | `history` |
| Decision / gate | `route` |
| Human approval | `user-check` |
| Security / permission | `shield-check` |
| Settings | `settings` |

## 4. Canonical triage icons
| Triage state | Icon | Meaning |
|---|---|---|
| ACTION_NOW | `bolt` | immediate attention required |
| BLOCKED | `alert-triangle` | cannot proceed until blocker resolves |
| READY | `circle-check` | next action is defined and can start |
| IN_PROGRESS | `player-play` | active execution |
| VALIDATION | `flask` | testing / pilot / evidence gathering |
| HOLD | `player-pause` | consciously paused |
| DONE | `rosette-discount-check` | target checkpoint or outcome achieved |

## 5. Color semantics
Color expresses **state**, not entity type. A GitHub node remains GitHub by logo; a red border means it is blocked. Entity categories are distinguished by icon, label and shape treatment, not arbitrary permanent colors.

Recommended semantic tokens:
- `action-now`: urgent accent
- `blocked`: error / danger
- `ready`: success
- `in-progress`: active / informational
- `validation`: experimental / review
- `hold`: muted
- `done`: completed / neutral-success

Exact palette values are implementation tokens and may be adjusted for accessibility without changing semantics.

## 6. Node anatomy
Every node must support, when relevant:
1. canonical icon or brand mark;
2. primary name;
3. entity type;
4. status badge;
5. optional secondary detail (stage, model, provider, repo, environment);
6. ports / handles only when a real relationship exists;
7. warning/blocker indicator when needed.

## 7. Service nodes
Use recognizable brand marks for services such as GitHub, Cloudflare, OpenAI, Figma, Supabase, Notion and WhatsApp. Do not replace a recognizable external service logo with a generic system icon unless brand assets are unavailable or inappropriate.

## 8. File nodes
File nodes use semantic file icons rather than extensions alone. High-value governance files such as FOUNDATION.md, AGENTS.md, ROADMAP.md, PROJECT_STATUS.md and CHECKPOINTS.md must remain visually distinguishable by label and role.

## 9. Accessibility
- Never encode status by color alone.
- Status always includes text and icon.
- Contrast must meet normal UI accessibility expectations.
- Node labels remain readable at default zoom.
- Icons are decorative when adjacent text already provides the entity name.

## 10. Guardrails
- No emoji as production node icons.
- No mixed icon libraries on the same semantic layer without an explicit exception.
- No icon may imply a capability the node does not actually have.
- No node toggle may execute irreversible or privileged actions without a separate permission/confirmation design.
- React Flow does not own workflow truth, project truth, approvals or runtime execution.

## CP-01 Exit
PASS when this vocabulary and token contract are committed and the project registry fixture is ready for CP-02 static UI work.
