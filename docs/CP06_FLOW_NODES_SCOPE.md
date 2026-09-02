# CP-06 — Flow / Nodes MVP Scope

Primary disposition: `EXTEND_EXISTING`

## User outcome

Murat can open a project architecture map, inspect a real node, filter entity
types and relationships, and see evidence and source conflicts without reading
multiple repositories manually.

## Included

- strict, source-attributed `NodeGraph` manifest contract;
- one factual Business Discovery graph as the first vertical slice;
- read-only React Flow canvas on desktop;
- project/type/relationship filters and safe visibility toggles;
- node inspector with source links and relationship summary;
- mobile list representation of the same manifest;
- explicit empty state and conflict/future semantics.

## Authority and safety

- every node and edge requires a `sourceId` and immutable evidence URL;
- the graph is derived presentation data and cannot write to repositories;
- controls only change local visibility/selection;
- no node executes, deploys, approves, edits or orchestrates work;
- divergent branch artifacts remain visibly `CONFLICT`.

## Excluded

- workflow runtime, task execution or cross-repository automation;
- graph editing/persistence and manual truth overrides;
- inferred relationships without repository evidence;
- portfolio-wide automatic graph extraction;
- history/reports, Cloudflare deployment and Codex App Server actions.

## Acceptance

1. Business Discovery opens with evidenced pipeline, documents, branches and stages.
2. Selecting a node opens a read-only inspector with its evidence link.
3. Type and relationship filters visibly change the graph and can be cleared.
4. Branch divergence and Auditor are visibly conflict-backed, not presented as main.
5. Mobile exposes the same nodes as a readable list without canvas dependence.
6. Tests reject missing evidence, dangling edges and invented node references.

## Edge clarity refinement

- every relationship type has a stable semantic color and visible text label;
- every edge has an arrowhead that identifies source-to-destination direction;
- selecting an edge highlights both endpoints, dims unrelated edges and opens a read-only relationship inspector;
- mobile exposes the same relationships as explicit `source → destination` rows.
