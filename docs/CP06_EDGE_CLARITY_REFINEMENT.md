# CP-06 — Edge Clarity Refinement

Primary disposition: `EXTEND_EXISTING`

## Outcome

Murat can distinguish relationship types without decoding dash patterns and can
select any edge to see its source, destination, meaning and immutable evidence.

## Included

- stable semantic color for every relationship type;
- arrowheads on all relationships;
- a labelled color legend that does not rely on color alone;
- selected-edge focus that dims unrelated edges and highlights both endpoints;
- read-only relationship inspector with `source → destination` and evidence;
- mobile relationship list using the same graph manifest.

## Boundaries

- no graph editing, execution or persistence;
- no new relationships and no inferred responsibility;
- manifest IDs, evidence and source-of-truth rules remain unchanged.
