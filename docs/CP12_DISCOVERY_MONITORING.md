# CP-12 — Discovery Monitoring

Status: IMPLEMENTATION  
Decision: EXTEND_EXISTING  
Date: 2026-09-21

## Goal

Add one read-only Discovery view to Salamat Projects Dashboard so Murat can see whether search-engine and AI crawlers are reaching Murat House without opening Cloudflare for routine checks.

This remains portfolio/discovery monitoring. The dashboard does not control crawlers, edit robots.txt, submit URLs, change indexing, or execute SEO actions.

## Source path

```text
Cloudflare zone analytics
  -> read-only GraphQL collector in CI
  -> validated discovery-state.json
  -> Discovery view
```

Secrets stay in GitHub Actions environment and are never shipped to the browser.

## First source

Cloudflare GraphQL Analytics for:
- zone: `salamat-mebel.kz`
- hostname: `house.salamat-mebel.kz`
- rolling window: 24 hours

The 24-hour window is deliberate because Cloudflare AI Crawl Control on Free plans exposes a maximum 24-hour detailed analytics window.

Detection for this checkpoint uses self-identifying User-Agent strings and must be labelled as such. It is useful monitoring evidence, not cryptographic proof of crawler identity.

## Monitored crawlers

Search:
- Googlebot
- bingbot

AI / assistant / AI search:
- GPTBot
- OAI-SearchBot
- ChatGPT-User
- ClaudeBot
- Claude-SearchBot
- Claude-User
- PerplexityBot
- Perplexity-User
- other explicitly declared crawler definitions in the contract

## UI

One new primary read-only view: `Discovery`.

Show:
- total crawler requests in the current source window;
- search-engine requests;
- AI crawler/search/assistant requests;
- last observed Googlebot request;
- last observed Bingbot request;
- crawler/operator breakdown;
- top Murat House paths crawled;
- source timestamp and source-quality note;
- explicit UNAVAILABLE state if analytics access is missing or fails.

No fake zeros: source failure must render as unavailable, not as "no crawler visits".

## Google Search Console boundary

CP-12 does not claim Search Console Crawl Stats integration. Google documents Crawl Stats as a Search Console report, while the public Search Console API covers performance/sitemaps and related API data rather than a Crawl Stats export.

Cloudflare therefore provides the first crawler-observation source. A later bounded extension may add Search Console performance metrics (impressions/clicks) if credentials are connected.

## Refresh

Production deployment workflow refreshes the Cloudflare discovery snapshot:
- on every push to `main`;
- on manual dispatch;
- every 6 hours.

The UI remains static/read-only and only reads the deployed snapshot.

## Explicit exclusions

- no crawler allow/block controls;
- no robots.txt mutation;
- no search-engine submission controls;
- no SEO agent;
- no database;
- no Worker/backend;
- no browser-side Cloudflare token;
- no invented 7-day history when the source plan only exposes 24 hours.

## PASS

CP-12 passes when:
1. contract and normalization tests pass;
2. UI renders Discovery on desktop/mobile without execution controls;
3. source failure renders UNAVAILABLE honestly;
4. CI collector never exposes credentials to the browser;
5. production deploy serves a schema-valid `discovery-state.json`;
6. dashboard remains monitoring-only.
