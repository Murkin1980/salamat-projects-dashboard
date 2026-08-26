# ICON & NODE VISUAL RESEARCH — 2026-08-26

## Decision
### Primary system icon set: Tabler Icons
Why:
- very broad set (6,000+);
- consistent 24×24 grid and 2px stroke;
- outline + filled variants;
- MIT/open-source;
- strong current coverage for AI/infrastructure concepts (`ai-agent`, `ai-agents`, `ai-gateway`, `connection`, `serverless`, `database`, `code-ai`, `git-pull-request-conflict`, etc.);
- React integration and Figma support.

### Brand/service marks: Simple Icons
Use only for identifiable product/service brands (GitHub, Cloudflare, OpenAI, Figma, Notion, Supabase, WhatsApp etc.). Do not use brand logos for generic concepts.

### Node canvas: React Flow
Use for node/edge rendering, handles, selection, minimap, grouping, zoom and future safe configuration controls. It is NOT the workflow engine.

### Secondary reference: Lucide
Lucide is excellent and consistent and remains an acceptable fallback/reference. We do not mix Lucide and Tabler in the same base UI unless an icon is genuinely missing.

## Visual rules
- default node icon: Tabler outline, 24px, 2px stroke;
- selected/active node may use filled status background, not a different icon family;
- service nodes: brand mark + neutral node container;
- file nodes: file-specific Tabler icons;
- status is represented by badge/dot/border, not by changing the underlying semantic icon;
- never encode meaning by color alone;
- node type and operational state are separate dimensions.

## Node icon vocabulary v0
### Project & work
`folder`, `folder-code`, `briefcase`, `road`, `target-arrow`, `checklist`, `progress`

### Agents & AI
`ai-agent`, `ai-agents`, `ai-gateway`, `robot`, `brain`, `sparkles`, `code-ai`

### Data & infrastructure
`database`, `server`, `serverless`, `cloud`, `api`, `connection`, `network`, `webhook`

### Code & delivery
`brand-github`, `git-branch`, `git-pull-request`, `git-pull-request-conflict`, `code`, `terminal-2`, `rocket`

### Files & evidence
`file`, `file-text`, `file-code`, `file-description`, `file-report`, `photo`, `table`, `json`

### Control & governance
`shield-check`, `lock`, `user-check`, `alert-triangle`, `player-pause`, `ban`, `settings`, `adjustments`

### Triage
ACTION_NOW: `bolt`
BLOCKED: `lock`
READY: `rocket`
IN_PROGRESS: `loader-2` / `progress`
VALIDATION: `shield-check`
HOLD: `player-pause`
DONE: `circle-check`

## Brand nodes v0
GitHub, Cloudflare, OpenAI, Figma, Supabase, Notion, WhatsApp, Google, Slack (when applicable).

## Avoid
- emoji as production icons;
- mixing multiple outline families for the same semantic layer;
- oversized logos inside nodes;
- decorative 3D icons;
- color-only triage semantics;
- downloading/vendoring thousands of icons before the catalog is approved.
