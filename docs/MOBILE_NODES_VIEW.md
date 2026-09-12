# Mobile Nodes View — dedicated structural branch

Decision: `EXTEND_EXISTING` (fix within the CP-06 Nodes surface).

## Why PR #6 did not solve the real-device defect

PR #6 (`fix(nodes): surface node list on mobile`) kept ONE shared DOM tree and
tried to fix mobile ordering with CSS:

- the mobile node/edge lists were reordered before `.nodes-layout`;
- below `760px` the React Flow canvas was hidden with `display: none`;
- the inspector stayed in the normal flow after the hidden canvas.

On a real smartphone this still failed (verified on the production deployment
`597b909f` and on `projects.salamat-mebel.kz`), because `display: none` only
hides the canvas — it does not stop React Flow from being mounted. React Flow
still initialises its viewport store, d3-zoom pane and ResizeObserver
measurements inside a zero-size hidden container. On real mobile browsers that
initialisation can throw or corrupt the commit of the surrounding subtree, so
the reordered mobile list never becomes usable. jsdom and static CSS/DOM-order
checks cannot observe any of this: they run no layout, no ResizeObserver and no
real browser viewport, which is exactly why the previous verification passed
while the phone failed.

## The fix: explicit responsive rendering decision

`NodeView` now chooses the structural branch in JavaScript via a small,
dependency-free `useMediaQuery` hook (`src/hooks/use-media-query.ts`) using
`window.matchMedia('(max-width: 760px)')`:

```tsx
isMobile
  ? <MobileNodesView ... />          // .nodes-mobile-view — no React Flow mounted
  : <div className="nodes-desktop-view">…React Flow canvas + inspector…</div>
```

Consequences:

- at `<= 760px` React Flow is **never mounted**; the mobile presentation is
  structurally independent of the canvas, not a hidden sibling of it;
- at `> 760px` the desktop branch renders exactly as before: canvas,
  inspector, MiniMap, Controls, layout and click behaviour unchanged;
- the two branches never coexist in the DOM, so no `display: none` switching
  is involved anywhere;
- both branches consume the SAME parsed graph, the SAME single
  `filterNodeGraph` result and the SAME `selectedId` / `selectedEdgeId`
  state owned by `NodeView`. There is no second data model and no duplicated
  filtering logic.

## Mobile hierarchy (<= 760px)

1. project selector (shared `NodesView` tablist, unchanged);
2. graph heading + `SOURCE …` state (shared toolbar);
3. compact filters — type chips scroll in one row, relationship select and
   reset share the second row; nothing is hidden;
4. relationship legend as a horizontally scrollable static row;
5. `Узлы · N` section with tappable node cards (icon/type, label, status
   badge, ~2-line detail, `min-height: 48px` tap target, visible selected
   state, no horizontal overflow);
6. compact selected-node detail card (name, type, status, detail, relations
   count, evidence link) placed AFTER the node cards — never a large empty
   inspector before them; existing auto-selection (auditor → PROJECT node)
   drives the first detail card;
7. `Связи · N` section;
8. relationship cards `source → target` with semantic color and type label.

Selecting a relationship card shows a compact edge detail (source → target,
type, evidence) in the same detail slot, mirroring desktop semantics.

## Verification

- deterministic viewport harness (`tests/nodes-viewport-branch.test.ts`):
  a stubbed `matchMedia` proves the MOBILE branch is mounted at 360 / 390 /
  760px (node cards present, zero `react-flow` markup) and the DESKTOP branch
  at 1440px (canvas + inspector present, zero mobile markup), both consuming
  the same graph data;
- jsdom interaction tests (`tests/nodes-mobile-interactions.test.ts`): a tap
  on a node card updates the selected detail; project switching re-renders
  the mobile cards from the selected graph;
- `npm test` and `npm run build` pass.

Real-device acceptance remains authoritative: this document records structure,
the owner verifies on the phone.
