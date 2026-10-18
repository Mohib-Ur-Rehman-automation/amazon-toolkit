// Make exported workflows safe to publish. Run on COPIES in the repo, never on your live n8n.
// Usage: node tests/sanitize.js your@real.email YOUR_REAL_SHEET_ID
// Replaces your email and Sheet ID with placeholders, empties pinData, and keeps credential NAMES (no secrets are in exports)
// so importers can see which credential each node needs.
const fs = require('fs'), path = require('path');
const [email, sheetId] = process.argv.slice(2);
if (!email || !sheetId) { console.error('Usage: node tests/sanitize.js <your email> <your sheet id>'); process.exit(1); }
const root = path.join(__dirname, '..');
let files = 0, hits = 0;
for (const d of fs.readdirSync(root)) {
  const dir = path.join(root, d);
  if (d === 'node_modules' || d.startsWith('.') || !fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json'))) {
    const p = path.join(dir, f);
    let s = fs.readFileSync(p, 'utf8');
    const before = s;
    hits += s.split(email).length - 1 + s.split(sheetId).length - 1;
    s = s.split(email).join('you@example.com').split(sheetId).join('YOUR_SHEET_ID');
    const w = JSON.parse(s);
    w.pinData = {};
    delete w.meta?.instanceId;
    s = JSON.stringify(w, null, 2) + '\n';
    if (s !== before) { fs.writeFileSync(p, s); files++; }
  }
}
// Final check: nothing personal left anywhere
let left = 0;
for (const d of fs.readdirSync(root)) {
  const dir = path.join(root, d);
  if (d === 'node_modules' || d.startsWith('.') || !fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (!fs.statSync(p).isFile()) continue;
    const t = fs.readFileSync(p, 'utf8');
    if (t.includes(email) || t.includes(sheetId)) { console.log('STILL CONTAINS PERSONAL DATA:', p); left++; }
  }
}
console.log(`${hits} replacements in ${files} files; ${left ? left + ' files still need attention' : 'clean'}`);
process.exitCode = left ? 1 : 0;
