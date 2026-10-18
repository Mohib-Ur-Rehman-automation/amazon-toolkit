// Pull every Code node out of the exported workflow JSON into tests/code/<tool>__<Node_Name>.js
// Usage (from the repo root): node tests/extract.js   (expects i1-market-screener/*.json etc.)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(__dirname, 'code');
fs.mkdirSync(out, { recursive: true });
const files = [];
for (const d of fs.readdirSync(root)) {
  if (d === 'node_modules' || d.startsWith('.')) continue;
  const p = path.join(root, d);
  if (fs.statSync(p).isDirectory()) for (const f of fs.readdirSync(p)) if (f.endsWith('.json')) files.push(path.join(p, f));
}
let n = 0;
for (const f of files) {
  const w = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!w.nodes) continue;
  const tag = String(w.name).split('.')[0];
  for (const node of w.nodes) if (node.type === 'n8n-nodes-base.code') {
    fs.writeFileSync(path.join(out, `${tag}__${node.name.replace(/[^A-Za-z0-9]+/g, '_')}.js`), node.parameters.jsCode); n++;
  }
}
console.log(`${n} Code nodes extracted from ${files.length} workflows`);
