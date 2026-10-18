# c1 · Toolkit Core

<p align="center">
<a href="../README.md">Toolkit</a> ·
<a href="../i1-market-screener/README.md">i1 Screener</a> ·
<a href="../i2-market-deep-dive/README.md">i2 Deep Dive</a> ·
<a href="../i3-competitor-targeting/README.md">i3 Targeting</a> ·
<a href="../i4-market-autopilot/README.md">i4 Autopilot</a> ·
<a href="../i5-next-keywords/README.md">i5 Next Keywords</a>
</p>

The shared analysis behind i1, i2, i3 and i4. It is a sub-workflow with one Code node, so a market scores the same whichever tool looks at it. No AI and no API calls: the same input always gives the same output.

## What goes in and out

**In:** one item from the calling tool, holding its raw SerpApi searches (or saved runs to reuse) plus the Listings history:

```
{ tool, batch_id, searches: [{ order, keyword, marketplace, response | listings }], history: [Listings rows], dropped: [] }
```

**Out:** one item with rows ready for the sheet, plus extra detail for the tools that need it:

```
{ keywords: [...], listings: [...], markets: [...], summary_text, details }
```

## What it does

1. **Cleans** each page. Sponsored results are dropped. Listings without the product word, accessories, bulk packs and price outliers are set aside, each with its reason written to Listings.
2. **Groups variations** that share a review count, rating and brand into one product family, so reviews are counted once.
3. **Scores** each keyword 0–100: sales to newcomers (35), brand openness (30), review moat (25) and price room (10), multiplied by demand. The full table is in the [i1 README](../i1-market-screener/README.md#how-it-works).
4. **Converts currency** before the price and demand checks: £1 = $1.32 and C$1 = $0.70 (fixed rates from 2 Oct 2026, set at the top of the code).
5. **Sets confidence** (high, medium or low) and writes out each reason it was lowered.
6. **Measures stability** against the previous run of the same keyword, and flags SerpApi's 1-hour cached copies.
7. **Merges variants.** Keywords that share 70%+ of their sales become one market. Sub-segments and overlaps are reported, not merged.
8. **Ranks markets.** It says whether each gap is bigger than run-to-run noise (3 points for stable, 8 for moderate, 12 for unstable, first-run or thin pages).

## Version history

Every Keywords row records the core version that scored it.

| Version | Change | Why |
|---|---|---|
| v2.0 | Variation families; sales-based concentration; score with a written breakdown | v1 counted shared reviews several times |
| v2.1 | Demand became a multiplier; brand openness uses the top 3 brands | `bonsai tools` scored 81 on ~$50K a month; one brand at 31% hid three brands at 82% |
| v2.5 | A big brand's own new listing is not a newcomer | Lodge's own low-review skillets lifted `cast iron skillet` |
| v2.6 | UK and Canadian prices are converted to dollars before scoring; reasons show prices in their own currency | The same products scored 52 / 57 / 61 on .co.uk / .com / .ca |

## Setup

**Import from File** → `c1-toolkit-core.json`. There's nothing to configure: no credentials, no sheet. Each tool's **Toolkit Core** node points here.
