// Minimal n8n Code-node runtime: enough of $, $input, $now, $json to execute the exported jsCode unchanged.
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const CODE_DIR = path.join(__dirname, 'code');
const code = name => fs.readFileSync(path.join(CODE_DIR, name + '.js'), 'utf8');

function items(arr) { return (arr || []).map(j => ({ json: j })); }

async function runNode(file, { nodes = {}, input = [], now } = {}) {
  const store = {};
  for (const [k, v] of Object.entries(nodes)) store[k] = items(v);
  const $ = name => {
    if (!(name in store)) {
      return { get isExecuted() { return false; }, first() { throw new Error(`Node '${name}' hasn't been executed`); }, all() { throw new Error(`Node '${name}' hasn't been executed`); } };
    }
    return { isExecuted: true, first: () => store[name][0], all: () => store[name], item: store[name][0] };
  };
  const inp = items(input);
  const $input = { first: () => inp[0], all: () => inp, item: inp[0] };
  const $now = (now ? DateTime.fromISO(now) : DateTime.now()).setZone('Asia/Karachi');
  const fn = new AsyncFunction('$', '$input', '$now', '$json', 'DateTime', code(file));
  const out = await fn($, $input, $now, inp[0]?.json, DateTime);
  return out.map(o => o.json);
}

// ---------- Synthetic SerpApi amazon page (shape from SerpApi's Amazon Search API docs) ----------
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
const BRANDS = ['Napfun', 'Sareider', 'Bcozzy', 'Purroch', 'Cabeau', 'Maliton', 'Dot&Dot', 'Explorebliss', 'Sarisun', 'Urbanest', 'Lodge', 'Amazon'];
function serpPage(keyword, { seed = 1, n = 48, priceMid = 20, marketplace = 'amazon.com', titleFn, brandPool = BRANDS, sponsoredShare = 0.15, processedAt = '2026-10-17 10:00:00 UTC', badgeShare = 0.7 } = {}) {
  const r = rng(seed);
  const organic = [];
  for (let i = 0; i < n; i++) {
    const brand = brandPool[Math.floor(r() * brandPool.length)];
    const reviews = Math.floor(10 ** (1 + r() * 4));
    const price = Math.round(priceMid * (0.5 + r()) * 100) / 100;
    const sold = r() < badgeShare ? [50, 100, 200, 500, 1000, 2000, 3000, 5000, 10000][Math.floor(r() * 9)] : null;
    const title = titleFn ? titleFn(brand, i) : `${brand} ${keyword} premium edition model ${i}`;
    organic.push({
      position: i + 1,
      asin: 'B0' + String(seed * 1000 + i).padStart(8, '0'),
      title,
      link: `https://www.${marketplace}/${brand}-${keyword.replace(/ /g, '-')}/dp/B0${String(seed * 1000 + i).padStart(8, '0')}`,
      link_clean: `https://www.${marketplace}/dp/B0${String(seed * 1000 + i).padStart(8, '0')}`,
      extracted_price: price,
      rating: Math.round((3.5 + r() * 1.5) * 10) / 10,
      reviews,
      bought_last_month: sold === null ? undefined : (sold >= 1000 ? `${sold / 1000}K+ bought in past month` : `${sold}+ bought in past month`),
      badges: [],
      sponsored: r() < sponsoredShare,
    });
  }
  return {
    search_metadata: { processed_at: processedAt },
    search_information: { total_results: 2000 },
    organic_results: organic,
    related_searches: [{ query: `${keyword} for kids` }, { query: `${keyword} cover` }],
    filters: { popular_shopping_ideas: [{ name: 'with handles' }, { name: 'memory foam' }] },
  };
}

module.exports = { runNode, serpPage, rng, code };
