// Round 2 (3 Nov 2026): invariant fuzzing. Hostile Amazon pages through i1 (split -> pack -> c1 -> rows -> result page)
// and hostile form text through every tool's first node. Rules that must always hold, whatever comes back from Amazon.
// node tests/t6_fuzz.js [pages]   (default 300)
const { runNode, serpPage } = require('./run');
const NOW = '2026-11-03T08:00:00+05:00';
const PAGES = Number(process.argv[2] || 300);
let seed = 4242;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rnd() * a.length)];
const HOSTILE = ['<img src=x onerror=alert(1)>', '"><svg onload=alert(1)>', '=IMPORTXML("http://e.co","//a")', '+2 Pack', '-20%', '@home', 'constructor', '__proto__',
  '‮evil', '​', 'A'.repeat(3000), '', ' ', 'Schön & Co', 'محمد', 'Amazon Basics', 'null', '1e309', '-5'];
let fails = 0, checks = 0; const seen = new Map();
const rule = (name, ok, detail) => { checks++; if (ok) return; fails++; const k = seen.get(name) || 0; seen.set(name, k + 1); if (k < 2) console.log(`FAIL ${name}\n     ${String(detail).slice(0, 300)}`); };
const BASE_TAGS = new Set();

(async () => {
  for (let i = 0; i < PAGES; i++) {
    const kws = ['neck pillow', 'travel pillow'].slice(0, 1 + (i % 2));
    const split = await runNode('i1__Split_Keywords', { input: [{ Keywords: kws.join('\n'), Marketplace: pick(['amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'constructor', '=1+1']) }], now: NOW });
    const pages = split.map((s, k) => {
      const pg = serpPage(s.keyword, { seed: i * 7 + k, titleFn: (b, j) => (rnd() < 0.3 ? pick(HOSTILE) + ' ' : '') + `${b} pillow ${j}`, processedAt: '2026-11-03 02:00:00 UTC' });
      for (const r of pg.organic_results || []) {            // Amazon fields in odd shapes
        if (rnd() < 0.1) r.price = pick([undefined, null, 0, -1, 1e9, '19.99', 'NaN']);
        if (rnd() < 0.1) r.extracted_price = pick([undefined, null, 0, -1, 1e9, '19.99']);
        if (rnd() < 0.1) r.rating = pick([undefined, 0, 6, -1, '4.5', null]);
        if (rnd() < 0.1) r.reviews = pick([undefined, -3, 1e12, null]);   // SerpApi sends reviews as a number; text like "1,234" is a known limit (BREAK-TEST.md)
        if (rnd() < 0.1) r.bought_last_month = pick(['1K+ bought in past month', '50K+ bought', 'bought', '', null, 'constructor']);
        if (rnd() < 0.1) r.brand = pick(HOSTILE);
      }
      return rnd() < 0.05 ? { error: 'Google hasn\'t returned any results for this query.' } : pg;
    });
    let core, rows, html;
    try {
      const pack = await runNode('i1__Pack_for_Core', { nodes: { 'Split Keywords': split, 'Search Amazon (SerpApi)': pages, 'Read History': [{}] }, now: NOW });
      core = await runNode('c1__Analyze', { input: pack, now: NOW });
      const N = { 'Toolkit Core': core };
      rows = [...await runNode('i1__Listings_Rows', { nodes: N, now: NOW }), ...await runNode('i1__Keyword_Rows', { nodes: N, now: NOW }), ...await runNode('i1__Market_Rows', { nodes: N, now: NOW })];
      html = (await runNode('i1__Result_Page', { nodes: N, now: NOW }))[0].html;
    } catch (e) {
      // A run where every search failed is allowed to stop with a plain message (that's the tool's design); anything else is a crash.
      rule('F1 odd Amazon data never crashes a run', /keywords failed/i.test(e.message), e.message);
      continue;
    }
    rule('F1 odd Amazon data never crashes a run', true);
    rule('F2 marketplace is always one of the three', rows.every(r => !r.marketplace || ['amazon.com', 'amazon.co.uk', 'amazon.ca'].includes(r.marketplace)), [...new Set(rows.map(r => r.marketplace))].join(','));
    const scores = rows.filter(r => 'opportunity_score' in r).map(r => r.opportunity_score);
    rule('F3 every score is a number from 0 to 100', scores.every(s => s === '' || s === null || (Number.isFinite(s) && s >= 0 && s <= 100)), scores.join(','));
    const nan = rows.flatMap(r => Object.entries(r).filter(([, v]) => (typeof v === 'number' && !Number.isFinite(v)) || (typeof v === 'string' && /^NaN$|\bundefined\b|\[object Object\]/.test(v))).map(([k, v]) => `${k}=${String(v).slice(0, 40)}`));
    rule('F4 no NaN, undefined or [object Object] in any sheet cell', nan.length === 0, nan.slice(0, 4).join(' | '));
    const tags = [...String(html).matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g)].map(m => m[1].toLowerCase());
    if (i === 0) tags.forEach(t => BASE_TAGS.add(t));
    rule('F5 no HTML from Amazon reaches the result page', !/<img src=x|<svg onload/i.test(html), (html.match(/.{0,30}<(img src=x|svg onload).{0,20}/i) || [''])[0]);
  }
  // Form text through every tool's first node: no crash except the tools' own plain "nothing entered" messages
  const firsts = [['i1__Split_Keywords', f => ({ input: [{ Keywords: f, Marketplace: f }] })], ['i5__Plan_Ideas', f => ({ nodes: { 'Ideas form': [{ 'Seed keywords': f, Marketplace: f }] } })],
    ['i4__Plan_Ideas', f => ({ nodes: { 'Autopilot form': [{ 'Seed keyword': f, Marketplace: f, 'Search budget': f, 'Your price': f, 'Your rating': f, 'Your review count': f, 'Your brand or ASINs': f }] } })]];
  for (const [node, make] of firsts) for (let i = 0; i < 200; i++) {
    const f = pick([...HOSTILE, 'neck pillow', 'neck pillow\n=1+1\n+travel pillow', '9999', 'a'.repeat(200)]);
    try {
      const out = await runNode(node, { ...make(f), now: NOW });
      rule(`F6 ${node} keeps a legal marketplace and no formula-led keyword`, out.every(o => ['amazon.com', 'amazon.co.uk', 'amazon.ca'].includes(o.marketplace) && !/^[=+\-@]/.test(o.keyword || o.seed || '')), JSON.stringify(out[0]).slice(0, 160));
    } catch (e) { rule(`F6 ${node} only stops with its own plain message`, /No (seed )?keyword|keywords? entered|no letters/i.test(e.message), e.message); }
  }
  console.log(`\nToolkit fuzz (round 2): ${checks} checks, ${fails} failed (${PAGES} hostile page sets through i1, 600 hostile forms).`);
  for (const [k, v] of seen) console.log(`  ${v}x ${k}`);
  process.exit(fails ? 1 : 0);
})();
