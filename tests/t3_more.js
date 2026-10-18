const { runNode, serpPage } = require('./run');
const NOW = '2026-10-18T02:30:00+05:00';
const EVIL = '<img src=x onerror=alert(1)>';
const xss = (label, html) => { const raw = (String(html).match(/<img src=x onerror/g) || []).length; console.log(`XSS ${label.padEnd(26)} raw tags: ${raw}${raw ? '  <-- UNESCAPED' : ''}`); };
const evilTitle = (brand, i) => (i % 3 === 0 ? `${EVIL}${brand} neck pillow ${i}` : `${brand} neck pillow ${i}`);
let calls = 0;
const page = (kw, seed) => { calls++; return serpPage(kw, { seed, titleFn: evilTitle, processedAt: '2026-10-17 21:00:00 UTC' }); };
const lookup = () => { calls++; return { product_results: { brand: `Visit the X${EVIL} Store` }, product_details: { best_sellers_rank: [{ text: `#12 in Pillows${EVIL}` }] }, purchase_options: { sold_by: `S${EVIL}` }, reviews_information: { summary: { text: EVIL, insights: [
  { title: `Durability${EVIL}`, mentions: { positive: 40, negative: 60, total: 100 }, summary: `Breaks ${EVIL}` },
  { title: 'Comfort', mentions: { positive: 90, negative: 10, total: 100 }, summary: 'Soft' }] } } }; };

(async () => {
  // ===== i4 full chain =====
  calls = 0;
  const n = { 'Autopilot form': [{ 'Seed keyword': 'neck pillow', Marketplace: 'amazon.com', 'Search budget': '', 'Your price': '24.99', 'Your rating': '4.3', 'Your review count': '200' }],
    'Read History': [{}], 'Read Products': [{}], 'Read Keywords': [{}], 'Read Autopilot Runs': [{}] };
  n['Plan Ideas'] = await runNode('i4__Plan_Ideas', { nodes: n, now: NOW });
  calls++;
  n['Amazon Autocomplete (SerpApi)'] = [{ suggestions: ['neck pillow for travel', 'neck pillow for sleeping', `neck pillow ${EVIL}`, 'neck pillow for car', 'neck pillow airplane', 'neck pillow memory foam', 'neck pillow kids'].map(v => ({ value: v, type: 'KEYWORD' })) }];
  n['Collect Ideas'] = await runNode('i4__Collect_Ideas', { nodes: n, now: NOW });
  n['Plan Screen'] = await runNode('i4__Plan_Screen', { nodes: n, now: NOW });
  n['Split Searches'] = await runNode('i4__Split_Searches', { nodes: n, now: NOW });
  n['Search Amazon (SerpApi)'] = n['Split Searches'].map((s, i) => page(s.keyword, 60 + i));
  const pack = await runNode('i4__Pack_for_Core', { nodes: n, now: NOW });
  n['Toolkit Core'] = await runNode('c1__Analyze', { input: pack, now: NOW });
  n['Plan Run'] = await runNode('i4__Plan_Run', { nodes: n, now: NOW });
  n['Rank Competitors'] = await runNode('i4__Rank_Competitors', { nodes: n, now: NOW });
  n['Split Lookups'] = await runNode('i4__Split_Lookups', { nodes: n, now: NOW });
  n['Look Up Product (SerpApi)'] = n['Split Lookups'].map(lookup);
  n['Extract Products'] = await runNode('i4__Extract_Products', { nodes: n, now: NOW });
  n['Judge Targets'] = await runNode('i4__Judge_Targets', { nodes: n, now: NOW });
  n['Report'] = await runNode('i4__Report', { nodes: n, now: NOW });
  const rep = n['Report'][0];
  console.log(`I4 budget 20: SerpApi calls made=${calls}, reported searches_used=${rep.searches_used}, screened=${n['Plan Screen'][0].keywords.length} pages, winner=${rep.winner}`);
  xss('i4 result page', (await runNode('i4__Result_Page', { nodes: n, now: NOW }))[0].html);
  xss('i4 email', (await runNode('i4__Email_Page', { nodes: n, now: NOW }))[0].html);
  console.log('I4 email subject:', rep.email_subject);

  // Budget floor: budget 6 must not spend more than 6
  for (const b of ['6', '7', '3', 'abc', '500']) {
    const m = { ...n, 'Autopilot form': [{ ...n['Autopilot form'][0], 'Search budget': b }] };
    m['Plan Ideas'] = await runNode('i4__Plan_Ideas', { nodes: m, now: NOW });
    m['Plan Screen'] = await runNode('i4__Plan_Screen', { nodes: m, now: NOW });
    const pages = m['Plan Screen'][0].pages.filter(p => !p.reuse).length;
    const lookupsAllowed = Math.min(8, m['Plan Ideas'][0].budget - m['Plan Screen'][0].used_after_pages);
    console.log(`I4 budget "${b}" -> budget ${m['Plan Ideas'][0].budget}: 1 autocomplete + ${pages} pages + up to ${lookupsAllowed} lookups = max ${1 + pages + lookupsAllowed}`);
  }

  // ===== i2 AI output injection + validation =====
  const core = n['Toolkit Core'];
  const prods = n['Extract Products'].slice(0, 3);
  const ev = await runNode('i2__Build_Evidence', { nodes: { 'Extract Products': prods, 'Toolkit Core': core }, now: NOW });
  const ai = { output: { angles: [
    { theme_ids: ['T1'], angle: `Stronger seams ${EVIL}`, why: 'Customers say it breaks' },
    { theme_ids: ['T9'], angle: 'Invented theme', why: 'x' },
    { theme_ids: ['T1'], angle: 'Lasts 3x longer', why: 'numbers' },
    { theme_ids: ['T2'], angle: 'Softer', why: 'praised theme only' }], must_match: ['T2', 'T1'] } };
  const vw = await runNode('i2__Validate_Write', { nodes: { 'Build Evidence': ev, 'Extract Products': prods, 'Toolkit Core': core, 'Write Angles (AI)': [ai] }, now: NOW });
  console.log('I2 ai_status:', vw[0].ai_status);
  console.log('I2 warnings:', vw[0].ai_warnings.split(' | ').map(w => w.slice(0, 70)).join('\n   '));
  xss('i2 result page', (await runNode('i2__Result_Page', { nodes: { 'Validate & Write': vw }, now: NOW }))[0].html);
  // AI node failed (continueRegularOutput gives {error})
  const vf = await runNode('i2__Validate_Write', { nodes: { 'Build Evidence': ev, 'Extract Products': prods, 'Toolkit Core': core, 'Write Angles (AI)': [{ error: { message: 'Provider returned 429' } }] }, now: NOW });
  console.log('I2 AI failure path ->', vf[0].ai_status, '| themes_table kept:', vf[0].themes_table !== 'no review summaries found');

  // ===== e0 =====
  const e0 = await runNode('e0__Build_Alert', { nodes: { 'Error Trigger': [{ workflow: { name: `i3. competitor-targeting${EVIL}` }, execution: { id: '1', url: 'http://localhost:5678/x', mode: 'webhook', lastNodeExecuted: 'Judge Targets', error: { message: `Cannot read properties of undefined (reading 'token') ${EVIL}` } } }] }, now: NOW });
  xss('e0 alert email', e0[0].html);
  console.log('E0 hint for a plain JS bug mentioning "token":', (e0[0].html.match(/Check first:<\/b> ([^<]+)/) || [])[1]);

  // ===== i5 result page =====
  const i5n = { 'Ideas form': [{ 'Seed keywords': 'neck pillow', Marketplace: 'amazon.com' }], 'Read Keywords': [{}], 'Read Listings': [{}], 'Read Products': [{}] };
  i5n['Plan Ideas'] = await runNode('i5__Plan_Ideas', { nodes: i5n, now: NOW });
  i5n['Amazon Autocomplete (SerpApi)'] = n['Amazon Autocomplete (SerpApi)'];
  i5n['Collect Ideas'] = await runNode('i5__Collect_Ideas', { nodes: i5n, now: NOW });
  i5n['Run Summary'] = await runNode('i5__Run_Summary', { nodes: i5n, now: NOW });
  xss('i5 result page', (await runNode('i5__Result_Page', { nodes: i5n, now: NOW }))[0].html);
})().catch(e => console.error('HARNESS ERROR', e.stack));
