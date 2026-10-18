/**
 * Amazon Toolkit — sheet formatting (free, Google Apps Script).
 * Run formatToolkit() once. Safe to run again any time: it replaces its own
 * formatting, banding and conditional colours instead of stacking them.
 * It never changes header text, so no n8n Sheets node needs a Refresh.
 * The only values it changes: numbers stored as text (old imported Listings rows)
 * become real numbers. Same value, so the tools read them the same way.
 */

// Each tab: its own deep header colour (paired tabs share a hue family, one shade apart)
// and the column a reader looks at first, shown bold in that colour.
const TABS = {
  'Listings':       { colour: '#0D1B2A', key: ['keyword'] },                  // Midnight: the raw page
  'Products':       { colour: '#4F5D75', key: ['asin', 'real_brand'] },       // Steel blue: one product up close
  'Keywords':       { colour: '#1B3A6B', key: ['keyword'] },                  // Cobalt: i1, each search
  'Markets':        { colour: '#142B50', key: ['market'] },                   // Deep cobalt: i1, searches joined into markets
  'Deep Dive':      { colour: '#4E6B64', key: ['keyword'] },                  // Sage teal: i2 (lighter than i2's Deep Teal so it never looks like a "high" cell)
  'Targets':        { colour: '#8B4E34', key: ['competitor_asin', 'brand'] }, // Rust: i3, who to aim at
  'Target Runs':    { colour: '#6A3B27', key: ['keywords'] },                 // Deep rust: i3, the log
  'Autopilot Runs': { colour: '#4A1F3D', key: ['winner'] },                   // Magenta (dark plum): i4, the pick it lands on
  'Keyword Ideas':  { colour: '#214235', key: ['idea'] },                     // Deep green: i5, new ground
  'Idea Runs':      { colour: '#182F26', key: ['seeds'] },                    // Darker green: i5, the log
};
const BRASS = '#9C7A3C'; // one shared accent: the line under every header

const PRICE = ['price', 'old_price', 'price_p25', 'price_median', 'price_p75', 'low_review_price_median',
  'unique_price_median', 'your_price', 'market_price_median'];
const WHOLE = ['reviews', 'median_reviews', 'units_last_month_floor', 'revenue_last_month_floor', 'bought_last_month',
  'units_floor', 'units_family_on_page', 'total_results', 'your_reviews', 'market_reviews_median'];
const RATING = ['rating', 'avg_rating', 'low_review_avg_rating', 'your_rating', 'market_rating_median'];
const SIGNED = ['score_change_vs_prev'];
const SCORES = ['opportunity_score', 'winner_score', 'last_score', 'relevance'];
const LONG_TEXT = ['title', 'score_breakdown', 'confidence_notes', 'cannot_tell', 'variant_note', 'related_markets',
  'vs_next', 'stability_note', 'note', 'notes', 'reason', 'relevance_breakdown', 'weak_spots', 'compared_with',
  'products_inspected', 'angles', 'must_match', 'themes_table', 'ai_warnings', 'review_themes', 'review_summary',
  'screened', 'pages', 'top_targets', 'why_winner', 'related_searches', 'shopping_ideas', 'unique_top_titles',
  'paste_into_i1', 'suggested_under', 'same_as', 'saved_keywords_used', 'related_keywords', 'keywords',
  'market_keywords', 'winner_keywords', 'keywords_ranked_on', 'url', 'row_id', 'run_id'];

// Affirmative / medium-or-unconfirmed / denied: solid fill, white bold text (contrast 9.7 / 16.0 / 5.0)
const GREEN = { bg: '#014D4E', fg: '#ffffff' }; // affirmative (deep teal)
const AMBER = { bg: '#301934', fg: '#ffffff' }; // medium or unconfirmed (dark purple)
const RED = { bg: '#DC143C', fg: '#ffffff' };   // denied (crimson)
const GREY = { bg: null, fg: '#8a8f98' };       // neutral: cached copy, no previous run, screened

// Text colours: column -> [[value, colour], ...]  (match ignores case)
const LEVEL = [['high', GREEN], ['medium', AMBER], ['low', RED]];
const TEXT_RULES = {
  confidence: LEVEL, last_confidence: LEVEL, winner_confidence: LEVEL,
  ad_priority: [['high', GREEN], ['medium', AMBER], ['low', GREY]], // Low priority is "less worth it", not a warning
  stability: [['stable', GREEN], ['moderate', AMBER], ['unstable', RED], ['cached copy', GREY], ['no previous run', GREY]],
  lookup_status: [['ok', GREEN], ['failed', RED]],
  newcomer: [['yes', GREEN]],
};
const STATUS_BY_TAB = {
  'Keywords': [['ok', GREEN], ['failed', RED], ['skipped', AMBER]],
  'Keyword Ideas': [['new', GREEN], ['page saved, not scored', AMBER], ['screened', GREY]],
};

const PKT_NOTE = 'Pakistan time (UTC+5): when you ran the tool. New rows end in "PKT"; rows from before 17 Oct 2026 have no label.';
const UTC_NOTE = 'UTC: when SerpApi fetched the Amazon page (SerpApi\'s own clock). Add 5 hours for Pakistan time.';
const NOTES = {
  'Listings': { batch_id: PKT_NOTE, checked_at: UTC_NOTE },
  'Keywords': { batch_id: PKT_NOTE, checked_at: UTC_NOTE },
  'Markets': { batch_id: PKT_NOTE, checked_at: UTC_NOTE },
  'Deep Dive': { checked_at: UTC_NOTE },
  'Targets': { checked_at: PKT_NOTE },
  'Target Runs': { checked_at: PKT_NOTE },
  'Autopilot Runs': { checked_at: PKT_NOTE },
  'Keyword Ideas': { checked_at: PKT_NOTE, last_checked: UTC_NOTE },
  'Idea Runs': { checked_at: PKT_NOTE },
};

function formatToolkit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const done = [], missing = [];
  for (const [name, cfg] of Object.entries(TABS)) {
    const sh = ss.getSheetByName(name);
    if (!sh) { missing.push(name); continue; }
    formatTab_(sh, name, cfg.colour, cfg.key);
    done.push(name);
  }
  startHere_(ss);
  ss.toast(`Formatted: ${done.join(', ')}${missing.length ? ` | not found: ${missing.join(', ')}` : ''}`, 'Amazon Toolkit', 10);
}

// A "Start Here" tab for anyone opening the sheet. No workflow reads it; it is rebuilt on every run.
const ABOUT = [
  ['Listings', 'i1-i4', 'One listing on one Amazon search page: the evidence everything else is computed from'],
  ['Products', 'i2, i3, i4', 'One product page lookup: best-seller rank, seller, real brand, review themes'],
  ['Keywords', 'i1, i3, i4', "One keyword's page-1 statistics"],
  ['Markets', 'i1, i4', 'One market (keywords merged) with its 0-100 score and the reasons'],
  ['Deep Dive', 'i2', 'One deep dive: review evidence table, angles, must-match'],
  ['Targets', 'i3, i4', 'One competitor judged as an ad target (High / Medium / Low)'],
  ['Target Runs', 'i3', 'One targeting run: searches used, counts, notes'],
  ['Autopilot Runs', 'i4', 'One Autopilot report: winner, why, targets'],
  ['Keyword Ideas', 'i5', 'One keyword idea, grouped and marked new or screened'],
  ['Idea Runs', 'i5', 'One ideas run, with the paste-ready list for i1'],
];
function startHere_(ss) {
  let sh = ss.getSheetByName('Start Here');
  if (!sh) sh = ss.insertSheet('Start Here', 0);
  sh.clear(); sh.clearConditionalFormatRules(); sh.getBandings().forEach(b => b.remove());
  ss.setActiveSheet(sh); ss.moveActiveSheet(1);
  sh.setTabColor(BRASS); sh.setHiddenGridlines(true);
  sh.setColumnWidth(1, 24); sh.setColumnWidth(2, 28); sh.setColumnWidth(3, 170); sh.setColumnWidth(4, 110); sh.setColumnWidth(5, 560);
  const dark = '#0D1B2A';
  sh.getRange('B2:E2').merge().setValue('Amazon Toolkit').setFontFamily('Georgia').setFontSize(24).setFontColor('#ffffff').setBackground(dark).setVerticalAlignment('middle');
  sh.getRange('B3:E3').merge().setValue('Five n8n workflows that judge Amazon markets from real page-1 data. Every number recomputes from the Listings tab.')
    .setFontColor('#D8CBB8').setBackground(dark).setFontSize(11);
  sh.setRowHeight(2, 52); sh.setRowHeight(3, 28);
  sh.getRange('B4:E4').setBackground(BRASS); sh.setRowHeight(4, 4);
  sh.getRange('C6:E6').setValues([['Tab', 'Written by', 'One row is']]).setFontWeight('bold').setFontColor('#3d434a').setBackground('#f7f5f2');
  ABOUT.forEach(([tab, by, what], i) => {
    const r = 7 + i;
    sh.getRange(r, 2).setBackground((TABS[tab] || {}).colour || '#cccccc');
    sh.getRange(r, 3, 1, 3).setValues([[tab, by, what]]);
    sh.getRange(r, 3).setFontWeight('bold').setFontColor((TABS[tab] || {}).colour || '#1f2328');
  });
  const end = 6 + ABOUT.length;
  sh.getRange(6, 3, ABOUT.length + 1, 3).setBorder(true, true, true, true, false, true, '#e2ddd5', SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment('middle');
  for (let r = 6; r <= end; r++) sh.setRowHeight(r, 26);
  let r = end + 2;
  sh.getRange(r, 3).setValue('Colours in the tabs').setFontWeight('bold').setFontColor('#3d434a');
  [['high · ok · stable · new', GREEN], ['medium · moderate · skipped · page saved', AMBER], ['low · failed · unstable', RED]].forEach(([t, s], i) => {
    sh.getRange(r + 1 + i, 3).setValue(t.split(' · ')[0]).setBackground(s.bg).setFontColor(s.fg).setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(r + 1 + i, 4, 1, 2).merge().setValue(t).setFontColor('#3d434a');
    sh.setRowHeight(r + 1 + i, 24);
  });
  r += 5;
  sh.getRange(r, 3).setValue('Times').setFontWeight('bold').setFontColor('#3d434a');
  sh.getRange(r + 1, 3, 1, 3).merge().setValue('checked_at in Listings, Keywords, Markets and Deep Dive is UTC (when SerpApi fetched the page). Run times end in PKT (Pakistan time, UTC+5). Hover a header to see which.').setWrap(true).setFontColor('#3d434a');
  sh.setRowHeight(r + 1, 36);
  sh.getRange(r + 3, 3, 1, 3).merge().setValue('Sales are floors: "1K+ bought in past month" counts as 1,000. No AI writes any number in this sheet.').setFontColor('#5f6670').setFontStyle('italic');
  sh.getRange('A1:F40').setFontFamily('Arial');
  sh.getRange('B2').setFontFamily('Georgia');
}

function formatTab_(sh, name, colour, keyCols) {
  const lastCol = sh.getLastColumn();
  if (lastCol < 1) return;
  if (sh.getMaxRows() < 2) sh.insertRowsAfter(1, 1);
  const maxRows = sh.getMaxRows();
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const width = headers.reduce((w, h, i) => (h ? i + 1 : w), 0); // up to the last named column
  if (!width) return;
  const col = h => headers.indexOf(h) + 1; // 0 = not in this tab
  const letter = c => sh.getRange(1, c).getA1Notation().replace(/\d+/g, '');
  const body = sh.getRange(2, 1, maxRows - 1, width);
  const colBody = c => sh.getRange(2, c, maxRows - 1, 1);

  // 1. Tab colour, header, frozen header, clean grid
  sh.setTabColor(colour);
  sh.setFrozenRows(1);
  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, 1, width)
    .setBackground(colour).setFontColor('#ffffff').setFontWeight('bold')
    .setVerticalAlignment('middle').setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  sh.setRowHeight(1, 30);
  body.setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setVerticalAlignment('middle').setFontColor('#1f2328');
  // Thin warm lines between cells, a dark line under the header
  body.setBorder(true, true, true, true, true, true, '#e2ddd5', SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(1, 1, 1, width).setBorder(null, null, true, null, null, null, BRASS, SpreadsheetApp.BorderStyle.SOLID_THICK);
  // Every data row one line high, even when a cell holds line breaks
  sh.setRowHeightsForced(2, maxRows - 1, 21);
  // row_id only joins other columns together (n8n matches on it); hidden, not removed. Unhide: click the arrows above column B.
  if (col('row_id')) sh.hideColumns(col('row_id'));

  // Key column: bold, in this tab's colour
  keyCols.forEach(h => { if (col(h)) colBody(col(h)).setFontColor(colour).setFontWeight('bold'); });

  // 2. Alternating rows (replace any earlier banding)
  sh.getBandings().forEach(b => b.remove());
  body.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false)
    .setFirstRowColor('#ffffff').setSecondRowColor('#f7f5f2'); // warm paper tint

  // 3. Numbers stored as text -> real numbers (only in number columns)
  const numeric = headers.map((h, i) => (isNumberCol_(h) ? i + 1 : 0)).filter(Boolean);
  const lastRow = sh.getLastRow();
  if (lastRow >= 2) {
    for (const c of numeric) {
      const rng = sh.getRange(2, c, lastRow - 1, 1);
      const vals = rng.getValues();
      let changed = 0;
      for (const row of vals) {
        if (typeof row[0] === 'string' && /^-?\d+(\.\d+)?$/.test(row[0].trim())) { row[0] = Number(row[0].trim()); changed++; }
      }
      if (changed) rng.setValues(vals);
    }
  }

  // 4. Number formats
  headers.forEach((h, i) => {
    const c = i + 1;
    let f = null;
    if (PRICE.includes(h)) f = '#,##0.00';
    else if (WHOLE.includes(h)) f = '#,##0';
    else if (RATING.includes(h)) f = '0.0#';
    else if (SIGNED.includes(h)) f = '+0;-0;0';
    else if (/_pct$/.test(h)) f = '0.0"%"';
    else if (SCORES.includes(h)) f = '0';
    if (f) colBody(c).setNumberFormat(f).setHorizontalAlignment('right');
  });

  // 5. Column widths: long text wide, everything else compact
  headers.forEach((h, i) => {
    if (!h) return;
    sh.setColumnWidth(i + 1, LONG_TEXT.includes(h) ? 260 : Math.max(90, Math.min(160, h.length * 8 + 24)));
  });

  // 6. Conditional colours (this tab's rules are replaced, not stacked)
  const rules = [];
  const textRule = (c, value, style) => {
    const L = letter(c);
    let b = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=LOWER(TRIM($${L}2&""))="${value}"`)
      .setRanges([colBody(c)]).setFontColor(style.fg).setBold(style !== GREY);
    if (style.bg) b = b.setBackground(style.bg);
    rules.push(b.build());
  };
  for (const [h, list] of Object.entries(TEXT_RULES)) if (col(h)) list.forEach(([v, s]) => textRule(col(h), v, s));
  if (STATUS_BY_TAB[name] && col('status')) STATUS_BY_TAB[name].forEach(([v, s]) => textRule(col('status'), v, s));
  if (col('ai_status')) {
    const L = letter(col('ai_status'));
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=LEFT(LOWER($${L}2&""),6)="failed"`)
      .setRanges([colBody(col('ai_status'))]).setBackground(RED.bg).setFontColor(RED.fg).build());
  }
  // Listings left out of the stats: whole row greyed
  if (name === 'Listings' && col('in_stats')) {
    const L = letter(col('in_stats'));
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(`=UPPER($${L}2&"")="FALSE"`)
      .setRanges([body]).setFontColor('#9aa0a6').setItalic(true).build());
  }
  // Scores 0-100: sand -> white -> pale teal (light, so the dark score text stays readable)
  for (const h of SCORES) {
    if (!col(h)) continue;
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .setGradientMinpointWithValue('#e8d5bb', SpreadsheetApp.InterpolationType.NUMBER, '0')
      .setGradientMidpointWithValue('#ffffff', SpreadsheetApp.InterpolationType.NUMBER, '50')
      .setGradientMaxpointWithValue('#b3d2cf', SpreadsheetApp.InterpolationType.NUMBER, '100')
      .setRanges([colBody(col(h))]).build());
  }
  sh.setConditionalFormatRules(rules);

  // 7. Header notes saying which clock each time column uses
  for (const [h, note] of Object.entries(NOTES[name] || {})) if (col(h)) sh.getRange(1, col(h)).setNote(note);
}

function isNumberCol_(h) {
  return PRICE.includes(h) || WHOLE.includes(h) || RATING.includes(h) || SIGNED.includes(h) || SCORES.includes(h) ||
    /_pct$/.test(h) || ['position', 'rank', 'order'].includes(h);
}
