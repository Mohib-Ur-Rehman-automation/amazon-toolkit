// Regression checks for the bugs found on 18 Oct 2026. Each FAILS until its fix is in the workflow.
const { runNode, serpPage } = require('./run');
const NOW = '2026-10-18T02:30:00+05:00';
let fails = 0; const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  (got: ${got})`}`); if (!ok) fails++; };
(async () => {
  const mk = (rank, market, score, confidence, vs) => ({ rank, market, keywords: market, opportunity_score: score, confidence, vs_next: vs });
  const T = s => `ahead of "x" by only ${s}; scores move up to 8 points between runs, so treat these two as tied`;
  const nodes = m => ({ 'Plan Ideas': [{ batch_id: 'b', marketplace: 'amazon.com', budget: 20, you: {}, own_asins: [], own_brands: [] }], 'Plan Screen': [{ pages: [], notes: [], used_after_pages: 5, keywords: [] }], 'Toolkit Core': [{ markets: m }] });
  const w1 = (await runNode('i4__Plan_Run', { nodes: nodes([mk(1, 'A', 70, 'medium', T(7)), mk(2, 'B', 63, 'medium', T(7)), mk(3, 'C', 56, 'high', 'ahead by 20 (more than)')]), now: NOW }))[0].winner;
  check('i4 tie rule: 56 cannot beat 70 through a chain of ties', w1 !== 'C', w1);
  const w2 = (await runNode('i4__Plan_Run', { nodes: nodes([mk(1, 'A', 70, 'medium', T(4)), mk(2, 'B', 66, 'high', 'ahead by 30 (more than)')]), now: NOW }))[0].winner;
  check('i4 tie rule: a real tie still goes to higher confidence', w2 === 'B', w2);
  for (const t of ['i3', 'i4']) {
    const plan = { keywords: ['neck pillow'], marketplace: 'amazon.com', own_asins: [], own_brands: ['napfunpro'], you: {}, lookup_budget: 8 };
    const pg = serpPage('neck pillow', { seed: 40, brandPool: ['Napfun', 'Cabeau'] });
    const core = await runNode('c1__Analyze', { input: [{ tool: t, batch_id: 'b', searches: [{ order: 1, keyword: 'neck pillow', marketplace: 'amazon.com', response: pg }], history: [], dropped: [] }], now: NOW });
    const rk = (await runNode(`${t}__Rank_Competitors`, { nodes: { 'Plan Run': [plan], 'Toolkit Core': core, 'Read Products': [{}], 'Read Keywords': [{}] }, now: NOW }))[0];
    check(`${t} own brand "Napfun Pro" does not hide "Napfun"`, rk.own_excluded === 0, `${rk.own_excluded} excluded`);
  }
  const e = await runNode('e0__Build_Alert', { nodes: { 'Error Trigger': [{ workflow: { name: 'i1. x' }, execution: { error: { message: "Cannot read properties of undefined (reading 'token')" } } }] }, now: NOW });
  check('e0: a plain JS error does not get the Google sign-in hint', !/Google sign-in/.test(e[0].html), 'sign-in hint');
  // core v2.6: the same products priced in local currency score the same on every marketplace
  const conv = (pg, f) => ({ ...pg, organic_results: pg.organic_results.map(o => ({ ...o, extracted_price: Math.round(o.extracted_price * f * 100) / 100 })) });
  const basePg = serpPage('neck pillow', { seed: 7, priceMid: 18 });
  const sc = [];
  for (const [mk, f] of [['amazon.com', 1], ['amazon.co.uk', 1 / 1.32], ['amazon.ca', 1 / 0.70]]) {
    const [o] = await runNode('c1__Analyze', { input: [{ tool: 'i1', batch_id: 'b', searches: [{ order: 1, keyword: 'neck pillow', marketplace: mk, response: conv(basePg, f) }], history: [], dropped: [] }], now: NOW });
    sc.push(o.keywords[0].opportunity_score);
  }
  check('c1 currency: same products score the same on .com / .co.uk / .ca', Math.max(...sc) - Math.min(...sc) <= 1, sc.join(' / '));
  process.exitCode = fails ? 1 : 0;
})();
