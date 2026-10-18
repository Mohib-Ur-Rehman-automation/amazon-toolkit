// c1 core: bounds, determinism, fuzz, currency, edge pages
const { runNode, serpPage, rng } = require('./run');
const core = (searches, history = [], tool = 'i1') => runNode('c1__Analyze', { input: [{ tool, batch_id: '2026-10-18 02:30:00 PKT', searches, history, dropped: [] }] });
const S = (kw, page, mk = 'amazon.com', order = 1) => ({ order, keyword: kw, marketplace: mk, response: page });

(async () => {
  const out = [];
  // 1. Fuzz: 400 random pages, single keyword
  let bad = 0, failed = 0, crashed = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const r = rng(seed * 7);
    const page = serpPage('neck pillow', { seed, n: 5 + Math.floor(r() * 55), priceMid: 3 + r() * 80, sponsoredShare: r() * 0.6, badgeShare: r() });
    try {
      const [o] = await core([S('neck pillow', page)]);
      for (const k of o.keywords) {
        if (k.status === 'failed') { failed++; continue; }
        const sc = k.opportunity_score;
        if (!(Number.isInteger(sc) && sc >= 0 && sc <= 100)) { bad++; out.push(`BAD score ${sc} seed ${seed}`); }
        for (const [f, v] of Object.entries(k)) if (typeof v === 'number' && !Number.isFinite(v)) { bad++; out.push(`non-finite ${f} seed ${seed}`); }
        if (JSON.stringify(k).includes('NaN')) { bad++; out.push(`NaN text seed ${seed}`); }
      }
    } catch (e) { crashed++; out.push(`CRASH seed ${seed}: ${e.message.slice(0, 120)}`); }
  }
  console.log(`FUZZ 400 pages: invalid=${bad} failed-rows=${failed} crashes=${crashed}`);
  out.slice(0, 8).forEach(x => console.log('  ', x));

  // 2. Determinism
  const p = serpPage('neck pillow', { seed: 42 });
  const a = JSON.stringify(await core([S('neck pillow', p)]));
  const b = JSON.stringify(await core([S('neck pillow', p)]));
  console.log('DETERMINISTIC same input -> same output:', a === b);

  // 3. Currency: the same page priced in USD vs GBP (x0.79) vs CAD (x1.37)
  const conv = (pg, f) => ({ ...pg, organic_results: pg.organic_results.map(o => ({ ...o, extracted_price: Math.round(o.extracted_price * f * 100) / 100 })) });
  const base = serpPage('neck pillow', { seed: 7, priceMid: 18 });
  for (const [mk, f] of [['amazon.com', 1], ['amazon.co.uk', 0.79], ['amazon.ca', 1.37]]) {
    const [o] = await core([S('neck pillow', conv(base, f), mk)]);
    const k = o.keywords[0];
    const pr = k.score_breakdown.split(' | ').find(x => x.startsWith('price_room'));
    console.log(`CURRENCY ${mk.padEnd(13)} same products: score ${k.opportunity_score}  ${pr.slice(0, 60)}  revenue floor ${k.revenue_last_month_floor}`);
  }

  // 4. Edge pages
  const edge = {
    'empty page': { search_metadata: { processed_at: '2026-10-17 10:00:00 UTC' }, organic_results: [] },
    'all sponsored': serpPage('neck pillow', { seed: 3, sponsoredShare: 1 }),
    'serpapi error': { error: 'Your account has run out of searches.' },
    'no sales badges at all': serpPage('neck pillow', { seed: 5, badgeShare: 0 }),
    'only 6 listings': serpPage('neck pillow', { seed: 9, n: 6, sponsoredShare: 0 }),
    'all identical price': (() => { const pg = serpPage('neck pillow', { seed: 11, sponsoredShare: 0 }); pg.organic_results.forEach(o => (o.extracted_price = 19.99)); return pg; })(),
    'ratings missing': (() => { const pg = serpPage('neck pillow', { seed: 12, sponsoredShare: 0 }); pg.organic_results.forEach(o => delete o.rating); return pg; })(),
  };
  for (const [name, pg] of Object.entries(edge)) {
    try {
      const [o] = await core([S('neck pillow', pg), S('travel pillow', serpPage('travel pillow', { seed: 99 }), 'amazon.com', 2)]);
      const k = o.keywords[0];
      console.log(`EDGE ${name.padEnd(24)} -> status=${k.status} score=${k.opportunity_score ?? '-'} conf=${k.confidence ?? '-'} note=${String(k.note || k.confidence_notes || '').slice(0, 90)}`);
    } catch (e) { console.log(`EDGE ${name} -> THREW: ${e.message.slice(0, 120)}`); }
  }
  try { await core([S('neck pillow', edge['serpapi error'])]); } catch (e) { console.log('EDGE all keywords fail -> throws for e0:', e.message.slice(0, 100)); }

  // 5. Variant merge: same products under two keywords must merge; unrelated must not
  const pa = serpPage('resistance band', { seed: 21 });
  const pb = { ...pa, search_metadata: { processed_at: '2026-10-17 10:05:00 UTC' }, organic_results: pa.organic_results.map(o => ({ ...o, title: o.title.replace('band', 'bands') })) };
  const pc = serpPage('garlic press', { seed: 77 });
  const [m] = await core([S('resistance band', pa, 'amazon.com', 1), S('resistance bands', pb, 'amazon.com', 2), S('garlic press', pc, 'amazon.com', 3)]);
  console.log('MERGE markets:', m.markets.map(x => `${x.market} [${x.keywords}] ${x.opportunity_score}`).join(' ; '));

  // 6. Stability: cached copy detection and a real re-run
  const first = await core([S('neck pillow', p)]);
  const hist = first[0].listings;
  const [again] = await core([S('neck pillow', p)], hist);
  console.log('STABILITY identical re-run within cache ->', again.keywords[0].stability);
  const later = { ...p, search_metadata: { processed_at: '2026-10-18 10:00:00 UTC' } };
  const [rerun] = await core([S('neck pillow', later)], hist);
  console.log('STABILITY same products next day ->', rerun.keywords[0].stability, '|', rerun.keywords[0].stability_note);

  // 7. Sheets hands numbers back as text ("$17.99", "1,000"): history parsing
  const textHist = hist.map(h => ({ ...h, price: `$${h.price}`, reviews: Number(h.reviews).toLocaleString('en-US'), bought_last_month: h.bought_last_month == null ? '' : String(h.bought_last_month), relevant: String(h.relevant).toUpperCase() }));
  const [rerun2] = await core([S('neck pillow', later)], textHist);
  console.log('SHEETS-TEXT history parsed -> stability', rerun2.keywords[0].stability, 'score change', rerun2.keywords[0].score_change_vs_prev);
})();
