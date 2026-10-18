<img src="../assets/banner-i1.svg" alt="i1 · Market Screener: up to 10 keywords in; markets ranked by opportunity score, variants merged" width="100%">

<p align="center">
<a href="../README.md">Toolkit</a> ·
<b>i1 Screener</b> ·
<a href="../i2-market-deep-dive/README.md">i2 Deep Dive</a> ·
<a href="../i3-competitor-targeting/README.md">i3 Targeting</a> ·
<a href="../i4-market-autopilot/README.md">i4 Autopilot</a> ·
<a href="../i5-next-keywords/README.md">i5 Next Keywords</a>
</p>

## What it does

You paste up to 10 keywords and pick a marketplace (amazon.com, .co.uk or .ca). For each keyword the Screener reads Amazon's page 1 and works out four things: who sells, how much, at what price, and against how many reviews. It then ranks the keywords as markets from 0 to 100 and writes out why each one scored what it did.

Keywords that are really the same market, like `resistance band` and `resistance bands`, are merged into one, and the differences between them are shown.

No AI is involved. The results go to the **Markets** and **Keywords** tabs, and every listing behind them goes to **Listings**.

## What it replaces

| By hand | Screener |
|---|---|
| Search each keyword on Amazon, scroll page 1 | 1 search per keyword |
| Count reviews, note prices, guess who dominates | Prices, review moat, brand shares and newcomer sales measured per keyword |
| Notice that two keywords show the same products | Keywords sharing 70%+ of their sales merged into one market |
| Rank by gut feeling | Score 0–100 with the breakdown written out, and a warning when two scores are too close to call |

## How it works

```mermaid
%%{init: {'theme':'base','themeVariables':{'fontFamily':'Georgia, serif','lineColor':'#9C7A3C','textColor':'#1f2328','edgeLabelBackground':'#f7f5f2'}}}%%
flowchart LR
  A["Up to 10 keywords<br/>(form)"] --> B["Search<br/>page 1 of each"]
  B --> C["History<br/>previous runs from Listings"]
  C --> D["Core c1<br/>clean · group · score"]
  D --> E["Evidence first<br/>Listings saved"]
  E --> F["Keywords + Markets<br/>rows saved"]
  classDef step fill:#1B3A6B,stroke:#9C7A3C,color:#ffffff;
  classDef io fill:#0D1B2A,stroke:#9C7A3C,color:#ffffff;
  class A,F io;
  class B,C,D,E step;
```

**1. Search.** One SerpApi search per keyword. Anything over 10 keywords is skipped and written to the sheet as "run it in the next batch", never silently dropped.

**2. History.** The Listings tab is read once, so each keyword can be compared with its previous run (stability).

**3. Core (`c1 · toolkit-core`).** This is the shared analysis every tool uses.
- **Clean.** Listings without the product word in the title, accessories, bulk packs and price outliers are set aside, each with its reason written in Listings.
- **Group.** Variations of one product share a review count, so they are grouped and counted once.
- **Score** from 0 to 100:

| Part | Weight | Full marks when |
|---|---|---|
| Sales to newcomers (under 1,000 reviews, from brands with no established product on the page) | 35 | 20%+ of page-1 sales |
| Brand openness (top 3 brands' share of sales) | 30 | 30% or less (80%+ = zero) |
| Review moat (median product's reviews) | 25 | 1,000 or less (31,600+ = zero) |
| Price room (median price) | 10 | $20+ ($8 or less = zero) |
| × Demand (page-1 revenue, badge floors) | multiplier | $10M+/month = ×1.0, $10K or less = ×0.2 |

Price room and demand are judged in US dollars. amazon.co.uk and amazon.ca prices are converted first (£1 = $1.32, C$1 = $0.70, fixed rates from 2 Oct 2026), so the same products score the same on every marketplace (core v2.6).

- **Confidence** (high, medium or low) drops for a sale event, a thin page, missing sales data, a weak keyword match, or mostly unknown brands. Each drop is written out.
- **Stability.** The share of sales sitting on products that were also on page 1 last time. If SerpApi served a cached copy (it caches identical searches for 1 hour), the row says so instead of pretending it's a new measurement.
- **Ranking.** Each market says how far ahead of the next one it is, and whether that gap is bigger than run-to-run noise (3 points for a stable market, 8 for moderate, 12 for unstable or first-run).

**4. Evidence first.** Listings are saved before any summary, so no score exists without the page behind it.

## What it handles

| Situation | What happens |
|---|---|
| More than 10 keywords | The extra ones get a `skipped` row: "Over the 10-keyword limit per run" |
| A keyword with no usable listings (typo, nonsense) | A `failed` row with the reason; the other keywords carry on |
| A page with too few usable listings | Stops that keyword and names the word to drop ("try the keyword without it") |
| Same keyword re-run within the hour | Detected as SerpApi's cached copy, marked `cached copy`, not a new measurement |
| Plural and singular forms | Merged as one market, with what each one shows on its own |
| A brand's own new listing under 1,000 reviews | Not counted as a newcomer (fixed after Lodge's own skillets lifted "cast iron skillet") |
| Real products named differently ("Dawn" for dish soap) | If they hold 15%+ of page-1 sales, the score they would give is shown next to the real one |
| Two runs at once | Queued by n8n, no rows lost |

## How it was tested

- **Live batches** on amazon.com, amazon.co.uk and amazon.ca, 16–17 Oct 2026: 10-keyword batches, merged variants, a deliberate nonsense keyword (`xqzvbnmplk`), an 11th keyword over the limit, and a re-run inside SerpApi's 1-hour cache.
- **Stability measured live:** `resistance band` re-run 15 hours later kept 98.1% of its sales on the same products. Its score moved by 1 point.
- **Currency checked live (core v2.6), 18 Oct 2026:** an amazon.co.uk batch scored `resistance bands` 58 and `yoga mat` 38. Every part was recomputed by hand from the row, including the £ → $ conversion. Before v2.6, both scored about 4 points lower because pounds were read as dollars.
- **The scoring changed because of live results, and each change is in the code comments:**
  - `bonsai tools` scored 81 in v2.0 with only ~$50K a month of sales on page 1. Demand became a multiplier, so a market nobody buys from can't top the list.
  - One brand at 31% looked "open" while three brands held 82%. Brand openness now uses the top 3 brands.
  - The "named differently" check was run on 15 markets. The tier never changed, and the score moved 0–5 points.

## Sample output

Batch of 17 Oct 2026, amazon.com, 10 keywords (an 11th, `phone case`, was skipped as over the limit).

| # | Market | Score | Confidence | Median price | Bought last month (floor) | Top brand | vs next |
|---|---|---|---|---|---|---|---|
| 1 | silicone ice cube tray | **64** | high | $9.99 | 147,600+ | DOQAUS 21% | ahead by 1, **treat as tied** |
| 2 | kids' water bottle | 63 | high | $19.88 | 63,400+ | Owala 22.1% | ahead by 12 |
| 3 | mouse pad | 51 | high | $9.85 | 149,000+ | MROCO 13.8% | ahead by 2, tied |
| 4 | garlic press | 49 | high | $14.78 | 50,350+ | Zulay 21.3% | ahead by 4, tied |
| 5 | shower caddy | 45 | high | $16.99 | 187,200+ | YASONIC 25.1% | ahead by 1, tied |
| … | | | | | | | |
| 8 | cast iron skillet | 40 | high | $29.90 | 46,800+ | Lodge 75.6% | ahead by 8, tied |
| 9 | left handed bonsai scissors | 32 | **low** | $17.99 | 12,150+ | VIVOSUN 57.6% | ahead by 11, tied |
| 10 | dog poop bags | 21 | high | $16.74 | 434,500+ | Earth 40.7% | |

**Why #1 scored 64**, as written in the sheet:

```
low_review_sales 33.7/35  19.2% of sales go to products under 1,000 reviews
brand_openness   24.8/30  top 3 brands (DOQAUS, WIBIMEN, ChefAide) hold 38.6% of sales
review_moat      20.4/25  median product has 1,900 reviews
price_room        1.7/10  median price 9.99
openness 80.5/100 x demand 0.79  (at least $1.62M in sales last month on page 1)
```

This batch ran on core v2.4. Later that day, v2.5 stopped counting a big brand's new listings as newcomers (Lodge's own low-review skillets had been lifting `cast iron skillet`), which lowers markets like that one. When [i2](../i2-market-deep-dive/README.md) re-scored the same `left handed bonsai scissors` page with v2.5, it dropped from 32 to 25. Every row records the core version that scored it. Core v2.6 (18 Oct) only changes amazon.co.uk and amazon.ca scores; amazon.com scores like these stay the same.

`dog poop bags` sells the most units on this list, but it comes last: one brand ("Earth") takes 40.7% of sales, and newcomers get 1.1%.

![i1 Markets tab](../assets/i1-sheet.png)

## Setup

1. Have the toolkit sheet, `c1 · toolkit-core` and `e0 · error-alerts` ready (see the [toolkit README](../README.md#setup-order)).
2. **Workflows → ⋯ → Import from File** → `i1-market-screener.json`.
3. **Search Amazon (SerpApi)** → your SerpApi credential. **Read History**, **Save Listings**, **Save Keywords** and **Save Markets** → your Google credential and the toolkit sheet.
4. **Toolkit Core** → `c1 · toolkit-core`. **⋯ → Settings → Error workflow** → `e0 · error-alerts`.
5. **Save**, then **Publish**. Open the form node and copy its Production URL.

## Known limitations

- **Sales are floors** from Amazon's "bought in past month" badges, never estimates. Badges are rarer on amazon.ca, so its markets look smaller.
- **No search volume, fees, profit, trend or product age.** Every Markets row lists these under `cannot_tell`.
- **Brands are guessed from titles.** `top_brand` can be a generic first word (`Earth`, `Kitchen`, `Ultra`). i3 and i4 correct this for their targets; this tab does not.
- **One snapshot.** A first run has no stability measure, so its noise band is the widest (12 points).
- **Thin pages** (under 30 listings) lower confidence.
- **Exchange rates are fixed,** so UK and Canadian scores drift slightly as real rates move. They are set at the top of the core and should be updated a few times a year.
- **The weights are a judgement call.** They're written out so they can be argued with, and changing them means editing the core.
