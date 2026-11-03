# Tests

Runs the workflows' own Code-node JavaScript outside n8n, unchanged, with a small stand-in for `$()`, `$input` and `$now`. SerpApi pages are generated in SerpApi's documented shape; no searches are spent.

```
npm install luxon@3
node tests/extract.js        # pulls every Code node out of the workflow JSON into tests/code/
node tests/t1_core.js        # c1: 400-page fuzz, determinism, edge pages, variants, stability, currency
node tests/t2_pipeline.js    # i1 + i3 chains: HTML escaping, search accounting, own-brand rule, tie rule
node tests/t3_more.js        # i4 chain, budgets, i2 AI guardrails, e0, i5
node tests/t4_regressions.js # bugs found on 18 Oct 2026; exits 1 while any is unfixed
node tests/t5_attacks.js     # break test round 1: 8 targeted attacks; exits 1 if any gets through
node tests/t6_fuzz.js [300]  # break test round 2: hostile pages and forms against 6 rules; exits 1 if any breaks
node tests/sanitize.js you@real.email REAL_SHEET_ID  # before every commit: swaps in placeholders
```

What the break test found and fixed: [BREAK-TEST.md](BREAK-TEST.md).

Not covered: real SerpApi payloads, Google Sheets typing, n8n's form and sub-workflow runtime, the LLM nodes.
