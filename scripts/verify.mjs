#!/usr/bin/env node
/* Verifies the site in headless Chrome. No dependencies (Node 22+ and Google Chrome).
 *
 *   node scripts/verify.mjs                  starts scripts/serve.py itself and checks it
 *   node scripts/verify.mjs https://…        checks a deployed URL instead
 *   node scripts/verify.mjs --shots=DIR      also saves screenshots of the key states into DIR
 *
 * Checks: layout against the design numbers (1440 and 390), the pinned head's flip across the whole
 * scroll range (clip vs. the dark section's rendered edges), the phone menu, short viewports,
 * horizontal overflow at many widths, and console / Content-Security-Policy errors.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = [process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'
].find((p) => p && existsSync(p));
if (!CHROME) { console.error('Chrome not found. Set CHROME_PATH.'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const children = [];
const cleanup = () => { for (const c of children) try { c.kill(); } catch {} };
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));

/* ---------- start the server + browser ---------- */
const args = process.argv.slice(2);
const shotsDir = (args.find((a) => a.startsWith('--shots=')) || '').slice(8);
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
let base = args.find((a) => !a.startsWith('--'));
if (!base) {
  const port = 4300 + Math.floor(Math.random() * 400);
  const srv = spawn('python3', [path.join(ROOT, 'scripts/serve.py'), String(port)], { stdio: 'ignore' });
  children.push(srv);
  base = `http://localhost:${port}/`;
  for (let i = 0; i < 40; i++) { try { await fetch(base); break; } catch { await sleep(100); } }
}
if (!base.endsWith('/')) base += '/';

const dbgPort = 9300 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(path.join(tmpdir(), 'ahr-verify-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${dbgPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
children.push(chrome);
process.on('exit', () => { try { rmSync(profile, { recursive: true, force: true }); } catch {} });

let target;
for (let i = 0; i < 80 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${dbgPort}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  if (!target) await sleep(150);
}
if (!target) { console.error('Could not reach headless Chrome.'); process.exit(2); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
let nextId = 0; const pending = new Map(); const listeners = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  else if (m.method) listeners.forEach((l) => l(m));
});
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++nextId; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
const waitFor = (method) => new Promise((res) => { const l = (m) => { if (m.method === method) { listeners.splice(listeners.indexOf(l), 1); res(m); } }; listeners.push(l); });

const problems = [];                       // console errors / warnings / CSP violations
listeners.push((m) => {
  if (m.method === 'Runtime.exceptionThrown') problems.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) problems.push(`${m.params.entry.level}: ${m.params.entry.text} ${m.params.entry.url || ''}`.trim());
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) problems.push(`console.${m.params.type}: ` + m.params.args.map((a) => a.value ?? a.description).join(' '));
});
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');

async function evaluate(expression) {
  const r = await Promise.race([
    send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }),
    sleep(90000).then(() => { throw new Error('evaluate timed out'); })
  ]);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

async function open(width, height, dpr = 2, { mobile = false } = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
  const loaded = waitFor('Page.loadEventFired');
  await send('Page.navigate', { url: base });
  await loaded;
  await evaluate('document.fonts.ready.then(() => new Promise(r => setTimeout(r, 400)))');
  await evaluate(HELPERS);
}

async function shot(name, y = 0) {
  if (!shotsDir) return;
  await evaluate(`__v.jump(${y})`);
  await sleep(700);                                   // let the reveal fades finish
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(shotsDir, name + '.png'), Buffer.from(r.data, 'base64'));
}

/* ---------- helpers that run inside the page ---------- */
const HELPERS = `window.__v = {
  frame: () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))),
  async jump(y) { scrollTo({ top: y, left: 0, behavior: 'instant' }); dispatchEvent(new Event('scroll')); await this.frame(); },
  parse(s) {
    const m = s.match(/inset\\(([^)]+)\\)/); if (!m) return { raw: s };
    const v = m[1].trim().split(/\\s+/);
    const [t, r, b, l] = v.length === 1 ? Array(4).fill(v[0]) : v.length === 2 ? [v[0], v[1], v[0], v[1]] : v.length === 3 ? [v[0], v[1], v[2], v[1]] : v;
    return { top: t === '100%' ? '100%' : parseFloat(t), bottom: b === '100%' ? '100%' : parseFloat(b) };
  },
  async sweep() {
    const head = document.querySelector('.watcher'), paper = head.querySelector('.watcher__paper'), dark = document.getElementById('what-we-do');
    const tol = 0.5 / devicePixelRatio + 0.02;
    await this.jump(0);
    const r0 = head.getBoundingClientRect(), d0 = dark.getBoundingClientRect();
    const darkAbs = d0.top + scrollY, darkH = d0.height, max = document.documentElement.scrollHeight - innerHeight;
    const pos = new Set([0, max]);
    for (let y = 0; y <= max; y += 9) pos.add(y);
    for (const edge of [darkAbs, darkAbs + darkH]) for (const line of [r0.top, r0.bottom]) for (const d of [-1, -0.5, 0, 0.5, 1]) pos.add(Math.min(max, Math.max(0, Math.round(edge - line + d))));
    const states = { ink: 0, splitTop: 0, fullPaper: 0, splitBottom: 0 };
    let worst = 0, n = 0; const bad = [];
    for (const y of [...pos].sort((a, b) => a - b)) {
      await this.jump(y);
      const r = head.getBoundingClientRect(), d = dark.getBoundingClientRect(), H = r.height;
      const t = Math.max(0, d.top - r.top), b = Math.min(H, d.bottom - r.top);
      const overlap = b > t + 0.001, got = this.parse(paper.style.clipPath);
      let ok, err = 0;
      if (!overlap) ok = got.top === '100%';
      else if (typeof got.top !== 'number') ok = false;
      else { err = Math.max(Math.abs(got.top - t), Math.abs((H - got.bottom) - b)); ok = err <= tol; }
      worst = Math.max(worst, err); n++;
      if (!ok) bad.push({ y, clip: paper.style.clipPath, expectTop: +t.toFixed(2), expectBottom: +b.toFixed(2) });
      if (!overlap) states.ink++; else if (t > 0.5 && b > H - 0.5) states.splitTop++; else if (t < 0.5 && b > H - 0.5) states.fullPaper++; else states.splitBottom++;
    }
    await this.jump(0);
    return { positions: n, mismatches: bad.length, worstErrPx: +worst.toFixed(4), firstBad: bad.slice(0, 3), states };
  }
};`;

/* ---------- reporting ---------- */
let failed = 0;
const rows = [];
const check = (name, ok, detail = '') => { rows.push([ok ? 'PASS' : 'FAIL', name, detail]); if (!ok) failed++; };
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

/* ---------- 1. desktop 1440 x 900 ---------- */
await open(1440, 900, 2);
const d = await evaluate(`(() => {
  const R = (s) => document.querySelector(s).getBoundingClientRect();
  const x = (s) => +R(s).left.toFixed(2), h = (s) => +R(s).height.toFixed(2);
  const rows = [...document.querySelectorAll('.dna__row')].map((r) => r.getBoundingClientRect().height);
  const cs = (s, p) => getComputedStyle(document.querySelector(s))[p];
  return {
    header: h('.site-header'), hero: h('.hero'), who: h('.who'), wwd: h('.wwd'), dna: h('.dna'), contact: h('.contact'), page: document.documentElement.scrollHeight,
    nav: [...document.querySelectorAll('.nav a')].map((a) => +a.getBoundingClientRect().left.toFixed(1)),
    cols: ['.hero__tag', '.who .label', '.who__text', '.wwd .label', '.wwd__text', '.dna .label', '.dna__num', '.contact .label', '.contact__links li', '.contact__sign p'].map(x),
    dnaTitle: x('.dna__title'), measure: +R('.who__text').width.toFixed(1), wordmark: x('.hero__title'),
    sideARight: +R('.hero__side').right.toFixed(1), endRight: +R('.contact__end').right.toFixed(1),
    equalRows: new Set(rows.map((v) => Math.round(v))).size === 1,
    head: [R('.watcher').width, R('.watcher').height, R('.watcher').left, R('.watcher').bottom, cs('.watcher', 'pointerEvents'), innerHeight],
    overflow: document.documentElement.scrollWidth > innerWidth,
    font: document.fonts.check('700 20px "Overpass Mono"') && document.fonts.check('400 20px "Overpass Mono"'),
    type: [cs('.hero__title', 'fontSize'), cs('.who__text', 'fontSize') + '/' + cs('.who__text', 'lineHeight'), cs('.wwd__text', 'fontSize') + '/' + cs('.wwd__text', 'lineHeight'), cs('.dna__title', 'fontSize') + '/' + cs('.dna__title', 'lineHeight')]
  };
})()`);
check('1440: header 104 + hero 796 = one screen', near(d.header, 104, 0.5) && near(d.hero, 796, 0.5), `${d.header} + ${d.hero}`);
// Reference heights are 639 / 710 / 948 / 598; "line-height: normal" rounds a pixel or two differently per rendering environment.
check('1440: section heights match the design (±3px)', near(d.who, 639, 3) && near(d.wwd, 710, 3) && near(d.dna, 948, 3) && near(d.contact, 598, 3), `who ${d.who} · wwd ${d.wwd} · dna ${d.dna} · contact ${d.contact}`);
check('1440: nav starts at x=626, gap 48', d.nav.join() === '626,700.9,838.7,913.6', d.nav.join(' '));
check('1440: every text block on the 626 column', d.cols.every((v) => near(v, 626, 0.1)), d.cols.join(' '));
check('1440: DNA titles at 706, measure 718', near(d.dnaTitle, 706, 0.1) && near(d.measure, 718, 0.1), `${d.dnaTitle} · ${d.measure}`);
check('1440: wordmark shifted -0.05em (619.6)', near(d.wordmark, 619.6, 0.1), String(d.wordmark));
check('1440: right-hand notes end on the 1344 margin', near(d.sideARight, 1344, 0.1) && near(d.endRight, 1344, 0.1), `${d.sideARight} · ${d.endRight}`);
check('1440: DNA rows equal height', d.equalRows);
check('1440: head 516x620, flush bottom-left, click-through', near(d.head[0], 516, 0.05) && near(d.head[1], 620, 0.5) && d.head[2] === 0 && d.head[3] === d.head[5] && d.head[4] === 'none', `${d.head[0]}x${d.head[1].toFixed(1)}`);
check('1440: type tokens', d.type.join(' | ') === '128px | 26px/40px | 19px/32px | 34px/40px', d.type.join(' | '));
check('1440: Overpass Mono loaded (400 + 700)', d.font);
check('1440: no horizontal overflow', !d.overflow);

const sd = await evaluate('__v.sweep()');
check(`1440: flip matches the section edges at all ${sd.positions} scroll positions`, sd.mismatches === 0, `worst ${sd.worstErrPx}px · ${JSON.stringify(sd.states)}`);
check('1440: sweep reached all four states', Object.values(sd.states).every((v) => v > 0));
if (sd.mismatches) console.log(JSON.stringify(sd.firstBad));
await shot('d1-hero', 0); await shot('d2-flip-who-to-dark', 900); await shot('d3-flip-dark-to-dna', 1650);
await shot('d4-dna', 2320); await shot('d5-contact', 99999); await shot('d1-hero', 0);

/* ---------- 2. phone 390 x 844 ---------- */
await open(390, 844, 2, { mobile: true });
const p = await evaluate(`(() => {
  const R = (s) => document.querySelector(s).getBoundingClientRect();
  const h = (s) => +R(s).height.toFixed(2);
  return { header: h('.site-header'), hero: h('.hero'), who: h('.who'), wwd: h('.wwd'), dna: h('.dna'), contact: h('.contact'),
    left: ['.hero__tag', '.who .label', '.who__text', '.dna .label', '.contact .label', '.contact__links li'].map((s) => +R(s).left.toFixed(1)),
    wordmark: +R('.hero__title').left.toFixed(2), head: [R('.watcher').width, R('.watcher').height],
    menuBtn: getComputedStyle(document.querySelector('.menu-btn')).display, nav: getComputedStyle(document.querySelector('.nav')).display,
    overflow: document.documentElement.scrollWidth > innerWidth };
})()`);
check('390: header 80 + hero 764 = one screen', near(p.header, 80, 0.5) && near(p.hero, 764, 0.5), `${p.header} + ${p.hero}`);
check('390: section heights match the design', near(p.who, 430, 1.5) && near(p.wwd, 521, 1.5) && near(p.dna, 779, 2) && near(p.contact, 571, 2), `who ${p.who} · wwd ${p.wwd} · dna ${p.dna} · contact ${p.contact}`);
check('390: text on the 24px margin; wordmark -0.05em (21.1)', p.left.every((v) => near(v, 24, 0.1)) && near(p.wordmark, 21.1, 0.1), `${p.left.join(' ')} · ${p.wordmark}`);
check('390: head 158x190', near(p.head[0], 158, 0.05) && near(p.head[1], 190, 0.5), `${p.head[0]}x${p.head[1].toFixed(1)}`);
check('390: Menu button shown, desktop nav hidden', p.menuBtn !== 'none' && p.nav === 'none');
check('390: no horizontal overflow', !p.overflow);
const sp = await evaluate('__v.sweep()');
check(`390: flip matches the section edges at all ${sp.positions} scroll positions`, sp.mismatches === 0, `worst ${sp.worstErrPx}px · ${JSON.stringify(sp.states)}`);

const menu = await evaluate(`(async () => {
  await __v.jump(0);
  const btn = document.querySelector('.menu-btn'), panel = document.getElementById('menu'), paper = document.querySelector('.watcher__paper');
  const before = paper.style.clipPath;
  btn.click(); await __v.frame();
  const open = { hidden: panel.hidden, expanded: btn.getAttribute('aria-expanded'), clip: paper.style.clipPath, locked: document.documentElement.classList.contains('menu-open'), focusInside: panel.contains(document.activeElement) };
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await __v.frame();
  const closed = { hidden: panel.hidden, expanded: btn.getAttribute('aria-expanded'), clip: paper.style.clipPath, locked: document.documentElement.classList.contains('menu-open'), focusBack: document.activeElement === btn };
  btn.click(); await __v.frame();
  panel.querySelector('a[href="#dna"]').click(); await __v.frame();
  const afterLink = { hidden: panel.hidden, locked: document.documentElement.classList.contains('menu-open') };
  return { before, open, closed, afterLink };
})()`);
check('menu: opens, locks scroll, moves focus in, head turns fully paper', !menu.open.hidden && menu.open.expanded === 'true' && menu.open.locked && menu.open.focusInside && /^inset\(0(px)? 0(px)? 0(px)?\)$|^inset\(0px\)$/.test(menu.open.clip), JSON.stringify(menu.open));
check('menu: Escape closes, returns focus, head back to ink', menu.closed.hidden && menu.closed.expanded === 'false' && !menu.closed.locked && menu.closed.focusBack && menu.closed.clip === menu.before, JSON.stringify(menu.closed));
check('menu: following a link closes it', menu.afterLink.hidden && !menu.afterLink.locked);
if (shotsDir) {
  await shot('p1-hero', 0); await shot('p2-flip', 525);
  await evaluate(`document.querySelector('.menu-btn').click()`); await shot('p3-menu-open', 525);
  await evaluate(`document.querySelector('.menu__close').click()`);
}

/* ---------- 3. short and odd viewports ---------- */
for (const [w, hgt] of [[1366, 650], [1440, 700], [1280, 600]]) {
  await open(w, hgt, 1);
  const s = await evaluate(`(() => { const hd = document.querySelector('.site-header').getBoundingClientRect(), w = document.querySelector('.watcher').getBoundingClientRect();
    return { headTop: +w.top.toFixed(1), headerBottom: +hd.bottom.toFixed(1), head: [+w.width.toFixed(1), +w.height.toFixed(1)] }; })()`);
  await shot(`v-${w}x${hgt}`, 0);
  check(`${w}x${hgt}: the head stays below the header`, s.headTop >= s.headerBottom - 0.5, `head ${s.head.join('x')} starts at ${s.headTop}, header ends at ${s.headerBottom}`);
}
for (const [w, hgt] of [[320, 640], [390, 844], [600, 900], [810, 1080], [1000, 800], [1024, 768], [1280, 720], [1440, 900], [1920, 1080], [2560, 1300]]) {
  await open(w, hgt, 1);
  const s = await evaluate(`(() => { const t = document.querySelector('.hero__title').getBoundingClientRect(), vw = document.documentElement.clientWidth;
    const hd = document.querySelector('.brand__name'), nav = document.querySelector('.nav');
    let navClear = true;
    if (getComputedStyle(nav).display !== 'none') navClear = hd.getBoundingClientRect().right < nav.getBoundingClientRect().left;
    return { overflowX: document.documentElement.scrollWidth - vw, titleRight: +t.right.toFixed(1), vw, navClear }; })()`);
  if ([810, 1280, 1920].includes(w)) { await shot(`v-${w}x${hgt}`, 0); if (w === 810) await shot(`v-${w}x${hgt}-flip`, 1500); }
  check(`${w}x${hgt}: no horizontal overflow, wordmark and header fit`, s.overflowX <= 0 && s.titleRight <= s.vw && s.navClear, `title ends ${s.titleRight} of ${s.vw}`);
}

if (shotsDir) { await open(1200, 630, 1); await shot('og', 0); }

/* ---------- 4. console / CSP ---------- */
check('console: no errors, warnings or CSP violations', problems.length === 0, problems.slice(0, 5).join(' | '));

/* ---------- report ---------- */
console.log(`\nChecked ${base}\n`);
for (const [status, name, detail] of rows) console.log(`${status}  ${name}${detail ? '\n        ' + detail : ''}`);
console.log(`\n${rows.length - failed}/${rows.length} passed`);
ws.close(); cleanup();
process.exit(failed ? 1 : 0);
