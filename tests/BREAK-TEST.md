# Break test (3 Nov 2026)

Two rounds against the five tools and the core, run outside n8n on the workflows' own code. No SerpApi searches were spent; the fixes were then sandbox-tested inside n8n with pinned data before publishing.

```
node tests/t5_attacks.js     # round 1: targeted attacks, exits 1 if any gets through
node tests/t6_fuzz.js [300]  # round 2: invariant fuzzing, exits 1 if any rule breaks
```

## Round 1: targeted attacks (`t5_attacks.js`)

Who can reach the tools: anyone with a form URL, and Amazon itself (titles, brands and review text are written by sellers and shoppers).

| # | Attack | Before | Fix |
|---|---|---|---|
| A1 | A formula typed as the marketplace (`=1+1`) | Breaks: n8n doesn't check dropdown values on the server, so it reached the sheet. With a real SerpApi call it fails the search instead, and every submission sends an e0 email | Every tool's first node accepts only `amazon.com`, `amazon.co.uk`, `amazon.ca`; anything else counts as `amazon.com` |
| A2 | Marketplace `constructor` | Breaks: `USD_PER['constructor']` is Object's built-in, so the score came out NaN | Same allowlist |
| A2b | Marketplace `amazon.de` | Breaks: searched, then scored as if euros were dollars | Same allowlist |
| A5 | Amazon titles starting with `+ - = @` ("+2 Pack", "-20% off") | Breaks: Google Sheets ran them as formulas (128 cells in one generated run) | All 19 Save nodes write `RAW` |
| A6 | Review text steers i2's AI into adding a link to an angle | Breaks: the number filter caught digits, not `claim-refund.com` | Validate & Write drops any angle carrying a link or web address |
| A7 | A seller whose brand is "Constructor" (found by round 2) | Breaks: the brand tally was a plain object, so the brand dropped out of the ranking and the score was wrong without looking wrong (in the test page the real top brand, with 29% of sales, vanished and 59 became 71), or NaN when it did sort into the top 3 | c1's brand maps are `Object.create(null)` |
| A8 | Review text steers i2's AI into naming theme `constructor` as must-match | Breaks: the theme lookup handed back Object's built-in and the run crashed into e0 | i2's theme lookup is `Object.create(null)` |

7 of 7 broke before the fixes, 0 after. A6 also has a control (a normal angle must still be kept), so the filter isn't passing by dropping everything.

Not testable in code, fixed in setup: the forms are public by default. With no sign-in, a stranger who finds a URL can spend the month's 250 searches (about 13 Autopilot runs). Turn on authentication on every Form Trigger (see the main README's setup order).

## Round 2: invariant fuzzing (`t6_fuzz.js`)

Instead of guessing attacks, generate hostile input and check rules that must always hold:

- 300 page sets through the whole i1 chain (split, pack, c1, sheet rows, result page). Each page carries hostile titles (HTML, formulas, `constructor`, `__proto__`, right-to-left marks, 3,000-character strings, `1e309`) and Amazon fields in odd shapes (missing, null, negative, zero, huge, strings), plus failed searches on two-keyword runs
- 600 hostile form submissions through the first node of i1, i4 and i5

| Rule | Before | After |
|---|---|---|
| F1 odd Amazon data never crashes a run | held | held |
| F2 marketplace is always one of the three | 148 broke | 0 |
| F3 every score is a number from 0 to 100 | 54 broke | 0 |
| F4 no NaN, undefined or [object Object] in any sheet cell | 54 broke | 0 |
| F5 no HTML from Amazon reaches the result page | held | held |
| F6 first nodes keep a legal marketplace and no formula-led keyword | 501 broke | 0 |

The F3/F4 failures were A7: a listing whose brand was "constructor". It only showed when that brand sorted into the top 3, so it slipped past one-field-at-a-time checks. Also clean on seeds 777 and 31337, and on a 2,000-page run (10,396 checks).

## Known limits

- **`reviews` sent as text** ("1,234") gives a NaN score. SerpApi documents `reviews` as a number and every saved response so far has it as one, so this isn't guarded.
- **Keyword-keyed maps in i3, i4 and i5 planning nodes** (`fresh`, `latest`, `ideas` and similar) are still plain objects. Only a keyword that is exactly "constructor" could misroute them, and with the forms behind sign-in only the owner types keywords. i3 Plan Run's map was fixed because that node was being changed anyway.
- **Review themes keyed by name** in i2 Build Evidence: same pattern, keys are Amazon's own review-aspect names.
- **c1 core version** stays `core v2.6`. The A7 fix only changes output on a page with a brand literally named "Constructor".
