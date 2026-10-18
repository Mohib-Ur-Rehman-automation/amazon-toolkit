<img src="assets/banner-toolkit.svg" alt="Amazon Toolkit: five n8n workflows that judge Amazon markets from real page-1 data" width="100%">

Five n8n workflows that answer the questions a new Amazon seller asks before spending money: *which market, how crowded is it, and who should I aim my ads at?* They answer them from Amazon's own page 1: prices, reviews, ratings and "bought in past month" badges. The answers are written to a Google Sheet, where every number can be recomputed from the listings behind it.

## The tools

| | Tool | You give it | You get | Searches |
|---|---|---|---|---|
| <img src="assets/dot-i1.svg" width="14"> | [**i1 · Market Screener**](i1-market-screener/README.md) | up to 10 keywords | markets ranked 0–100, variants merged, reasons written out | 1 per keyword |
| <img src="assets/dot-i2.svg" width="14"> | [**i2 · Market Deep Dive**](i2-market-deep-dive/README.md) | 1 keyword | top sellers looked up, review complaints turned into product angles | up to 5 |
| <img src="assets/dot-i3.svg" width="14"> | [**i3 · Competitor Targeting**](i3-competitor-targeting/README.md) | 2–5 keywords + your product | every page-1 competitor ranked and judged as an ad target | up to 13 |
| <img src="assets/dot-i4.svg" width="14"> | [**i4 · Market Autopilot**](i4-market-autopilot/README.md) | 1 seed keyword | ideas → screened markets → winner → ad targets, in one emailed report | up to 20 |
| <img src="assets/dot-i5.svg" width="14"> | [**i5 · Next Keywords**](i5-next-keywords/README.md) | up to 3 seeds, or none | fresh keyword ideas, grouped and ready to paste into i1 | 1 per seed |

A page or product looked up in the last 24 hours is reused by every tool for 0 searches, so running i2 or i3 right after i4 is mostly free.

## How they fit together

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Georgia, serif','lineColor':'#9C7A3C','textColor':'#1f2328','edgeLabelBackground':'#f7f5f2'}}}%%
flowchart LR
  I5["i5 · Next Keywords"] -- ideas --> I1["i1 · Market Screener"]
  I1 -- best market --> I2["i2 · Market Deep Dive"]
  I1 -- its keywords --> I3["i3 · Competitor Targeting"]
  I4["i4 · Market Autopilot<br/>i5 + i1 + i3 in one run"]
  C1[("c1 · toolkit-core<br/>shared scoring")]
  I1 -.-> C1
  I2 -.-> C1
  I3 -.-> C1
  I4 -.-> C1
  classDef i1 fill:#1B3A6B,stroke:#9C7A3C,color:#fff;
  classDef i2 fill:#0F3D3E,stroke:#9C7A3C,color:#fff;
  classDef i3 fill:#8B4E34,stroke:#9C7A3C,color:#fff;
  classDef i4 fill:#4A1F3D,stroke:#9C7A3C,color:#fff;
  classDef i5 fill:#214235,stroke:#9C7A3C,color:#fff;
  classDef core fill:#0D1B2A,stroke:#9C7A3C,color:#fff;
  class I1 i1; class I2 i2; class I3 i3; class I4 i4; class I5 i5; class C1 core;
```

Two support workflows sit underneath:
- **c1 · toolkit-core** is the shared analysis: grouping variations, scoring, stability and merging variants. Every tool that reads a search page calls it, so a market scores the same whichever tool looks at it.
- **e0 · error-alerts** emails you when any tool fails.

## Rules every tool follows

- **AI never writes a number.** Only i2 uses AI, and only to suggest product angles from review themes. Code writes every figure, and anything the AI returns with a digit in it is dropped.
- **Sales are floors.** "1K+ bought in past month" counts as 1,000. Sales are never added up across keywords, because the same product shows up on several pages.
- **Evidence first.** Listings are saved before any summary row, so no score exists without the page behind it.
- **Reasons are written out.** Every score has its breakdown, and every confidence level says what lowered it.
- **A brand name describes a brand, not a market.** Brand keywords are set aside, not screened.
- **Nothing is paid for twice.** Pages and lookups are reused for 24 hours, and failed keywords are skipped for 24 hours.
- **One scale for every marketplace.** The price and demand thresholds are in US dollars, so amazon.co.uk and amazon.ca prices are converted first: £1 = $1.32 and C$1 = $0.70 (fixed rates from 2 Oct 2026). The same products score the same on any marketplace.

## The sheet

One Google Sheet holds everything. Each tool writes with *append or update* on `row_id`, so re-running never duplicates rows.

| Tab | Written by | One row is |
|---|---|---|
| **Listings** | i1–i4 | one listing on one search page: the evidence |
| **Products** | i2, i3, i4 | one product page lookup (BSR, seller, real brand, review themes) |
| **Keywords** | i1, i3, i4 | one keyword's page-1 statistics |
| **Markets** | i1, i4 | one market (merged keywords) with its score and reasons |
| **Deep Dive** | i2 | one deep dive: evidence table and angles |
| **Targets** | i3, i4 | one competitor judged as an ad target |
| **Target Runs** | i3 | one targeting run |
| **Autopilot Runs** | i4 | one Autopilot report |
| **Keyword Ideas** | i5 | one keyword idea |
| **Idea Runs** | i5 | one ideas run |

Times: `checked_at` in Listings, Keywords, Markets and Deep Dive is **UTC**, SerpApi's own time for when the page was fetched. Run times (`batch_id`, and `checked_at` in the run tabs) are **Pakistan time**, ending in `PKT`. Each header carries a note saying which.

The header row for every tab is in [`sheet/headers.txt`](sheet/headers.txt). [`sheet/format_toolkit.gs`](sheet/format_toolkit.gs) is an Apps Script that applies the colours, number formats and status highlights. Run it once from **Extensions → Apps Script**.

## Free stack, honest costs

| Piece | Used for | Cost |
|---|---|---|
| n8n Community Edition (self-hosted, Docker) | the workflows | free |
| SerpApi free tier | Amazon search pages, product pages, autocomplete | 250 searches/month |
| Google Sheets | storage and the readable output | free |
| OpenRouter free models | i2's angles only | free |
| Gmail SMTP | Autopilot report, error alerts | free |

On the free tier, one full Autopilot run can use 20 of the 250 monthly searches. Real client use would mean a paid SerpApi plan.

## Tested and rejected

**Google Trends as a demand check.** It was tested with 2 searches and dropped:
- Long-tail keywords returned zeros.
- `kitchen sponges` showed close to 0 on Google while its Amazon page 1 showed 464,500+ units bought last month.
- Unrelated keywords showed the same synchronized spike from 22 Mar to 16 May 2026, which points to a data artifact rather than demand.

Amazon's own badges measure Amazon demand better than Google does.

## Setup order

1. Make the Google Sheet with the tabs and headers above.
2. Import **e0**, set its SMTP credential, and replace `you@example.com` with your own From and To addresses.
3. Import **c1**.
4. Import the tools you want. In each one, pick your credentials, point every Google Sheets node at your own sheet (the exports say `YOUR_SHEET_ID`), point its **Toolkit Core** node at c1, and set **Settings → Error workflow** to e0.
5. Run n8n with `N8N_CONCURRENCY_PRODUCTION_LIMIT=1` so runs queue instead of colliding.
6. **Save** and **Publish** each workflow. Forms run the published version.

Each tool's README has its own steps.

## Repository

```
├── README.md                     this page
├── assets/                       banners and images
├── sheet/                        tab headers + formatting script
├── c1-toolkit-core/              shared analysis (sub-workflow): README + .json
├── e0-error-alerts/              failure emails: README + .json
├── i1-market-screener/           README + workflow .json
├── i2-market-deep-dive/
├── i3-competitor-targeting/
├── i4-market-autopilot/
├── i5-next-keywords/
├── tests/                        runs the workflows' own code outside n8n
└── LICENSE
```

## Tests

[`tests/`](tests/README.md) runs every Code node's JavaScript outside n8n, unchanged, against generated Amazon pages, so no searches are spent. It covers:

- a 400-page fuzz of the core: every score stays within 0–100, with no blank or broken values
- the same input always giving the same output
- HTML escaping on every result page and email
- searches counted against searches made
- the AI checks in i2
- one regression check for each bug found in review

`node tests/t4_regressions.js` exits with an error while any of those bugs is back.
