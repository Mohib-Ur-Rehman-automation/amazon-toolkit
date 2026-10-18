// End-to-end chains for i1, i3, i4, i5 with mocked SerpApi + empty/seeded sheet.
// Checks: HTML injection from Amazon titles/brands, search accounting, tie-chain winner rule, own-brand exclusion.
const { runNode, serpPage } = require('./run');
const NOW = '2026-10-18T02:30:00+05:00';
const EVIL = '<img src=x onerror=alert(1)>';
const evilTitle = (brand, i) => (i % 3 === 0 ? `${EVIL}${brand} neck pillow memory foam ${i}` : `${brand} neck pillow ${i} "quoted" & co`);
const evilBrands = ['Napfun', 'Cabeau', `Evil${EVIL}`, 'Sarisun', 'Bcozzy', 'Urbanest'];

let serpCalls = 0;
const page = (kw, seed) => { serpCalls++; return serpPage(kw, { seed, titleFn: evilTitle, brandPool: evilBrands, processedAt: '2026-10-17 21:00:00 UTC' }); };
const lookup = asin => {
  serpCalls++;
  return {
    product_results: { brand: `Visit the Evil${EVIL} Store`, bought_last_month: '1K+ bought in past month', variants: [{ title: 'Color', items: [1, 2, 3] }] },
    product_details: { best_sellers_rank: [{ text: '#1,234 in Home & Kitchen (See Top 100)' }, { text: `#12 in Travel Pillows${EVIL}` }] },
    purchase_options: { buy_new: { sold_by: `Seller${EVIL}`, ships_from: 'Amazon' } },
    reviews_information: { summary: { text: `Customers say ${EVIL}`, customer_reviews: { '1 star': 9, '2 star': 7 }, insights: [
      { title: 'Durability', sentiment: 'mixed', mentions: { positive: 40, negative: 60, total: 100 }, summary: `Breaks ${EVIL}` },
      { title: 'Comfort', sentiment: 'positive', mentions: { positive: 90, negative: 10, total: 100 }, summary: 'Soft' }] } },
  };
};
const xss = (label, html) => {
  const raw = (html.match(/<img src=x onerror/g) || []).length;
  console.log(`XSS ${label.padEnd(26)} raw <img onerror> tags in output: ${raw}${raw ? '  <-- UNESCAPED' : ''}`);
};

(async () => {
  // ================= i1 =================
  {
    serpCalls = 0;
    const form = { Keywords: 'neck pillow\ntravel pillow', Marketplace: 'amazon.com' };
    const split = await runNode('i1__Split_Keywords', { input: [form], now: NOW });
    const responses = split.map((s, i) => page(s.keyword, 30 + i));
    const pack = await runNode('i1__Pack_for_Core', { nodes: { 'Split Keywords': split, 'Search Amazon (SerpApi)': responses, 'Read History': [{}] }, now: NOW });
    const core = await runNode('c1__Analyze', { input: pack, now: NOW });
    const html = (await runNode('i1__Result_Page', { nodes: { 'Toolkit Core': core }, now: NOW }))[0].html;
    xss('i1 result page', html);
  }

  // ================= i3 =================
  let i3 = {};
  {
    serpCalls = 0;
    const form = { Keywords: 'neck pillow\ntravel pillow\nairplane pillow', Marketplace: 'amazon.com', 'Your price': '24.99', 'Your rating': '4.3', 'Your review count': '200', 'Your brand or ASINs': 'Napfun Pro' };
    const nodes = { 'Targeting form': [form], 'Read History': [{}], 'Read Products': [{}], 'Read Keywords': [{}] };
    nodes['Plan Run'] = await runNode('i3__Plan_Run', { nodes, now: NOW });
    nodes['Split Searches'] = await runNode('i3__Split_Searches', { nodes, now: NOW });
    nodes['Search Amazon (SerpApi)'] = nodes['Split Searches'].map((s, i) => page(s.keyword, 40 + i));
    const pack = await runNode('i3__Pack_for_Core', { nodes, now: NOW });
    nodes['Toolkit Core'] = await runNode('c1__Analyze', { input: pack, now: NOW });
    nodes['Rank Competitors'] = await runNode('i3__Rank_Competitors', { nodes, now: NOW });
    const rk = nodes['Rank Competitors'][0];
    nodes['Split Lookups'] = await runNode('i3__Split_Lookups', { nodes, now: NOW });
    nodes['Look Up Product (SerpApi)'] = nodes['Split Lookups'].map(l => lookup(l.asin));
    nodes['Extract Products'] = await runNode('i3__Extract_Products', { nodes, now: NOW });
    nodes['Judge Targets'] = await runNode('i3__Judge_Targets', { nodes, now: NOW });
    nodes['Run Summary'] = await runNode('i3__Run_Summary', { nodes, now: NOW });
    const html = (await runNode('i3__Result_Page', { nodes, now: NOW }))[0].html;
    xss('i3 result page', html);
    const rs = nodes['Run Summary'][0];
    console.log(`I3 accounting: mocked SerpApi calls=${serpCalls}, reported searches_used=${rs.searches_used}`);
    console.log(`I3 own brand "Napfun Pro" -> own_excluded=${rk.own_excluded} (brand "Napfun" is a different company in this test)`);
    const rows = nodes['Judge Targets'][0].rows;
    const unitsSummedBug = rows.some(r => typeof r.units_floor === 'number' && r.units_floor > 10000 * 1);
    console.log(`I3 targets listed=${rows.length}, priorities: ${['High', 'Medium', 'Low'].map(p => p + '=' + rows.filter(r => r.ad_priority === p).length).join(' ')}, max units ${Math.max(...rows.map(r => +r.units_floor || 0))} (badge max is 10,000 per listing family child)`);
    i3 = nodes;
  }

  // ================= i4 Plan Run: transitive tie chain =================
  {
    const mk = (rank, market, score, confidence, vs) => ({ rank, market, keywords: market, opportunity_score: score, confidence, vs_next: vs });
    const markets = [
      mk(1, 'travel pillow', 70, 'medium', 'ahead of "neck pillow" by only 7; scores move up to 8 points between runs, so treat these two as tied'),
      mk(2, 'neck pillow', 63, 'medium', 'ahead of "neck pillow for car" by only 7; scores move up to 8 points between runs, so treat these two as tied'),
      mk(3, 'neck pillow for car', 56, 'high', 'ahead of "x" by 20 (more than the 8-point run-to-run movement)'),
      mk(4, 'x', 36, 'high', ''),
    ];
    const out = await runNode('i4__Plan_Run', { nodes: {
      'Plan Ideas': [{ batch_id: 'b', marketplace: 'amazon.com', budget: 20, you: {}, own_asins: [], own_brands: [] }],
      'Plan Screen': [{ pages: [], notes: [], used_after_pages: 5, keywords: [] }],
      'Toolkit Core': [{ markets }],
    }, now: NOW });
    console.log(`I4 TIE CHAIN: #1 travel pillow 70 (medium), #3 neck pillow for car 56 (high) -> winner = "${out[0].winner}" (${out[0].winner_score}) | ${out[0].why_winner}`);
  }
})().catch(e => console.error('HARNESS ERROR', e));
