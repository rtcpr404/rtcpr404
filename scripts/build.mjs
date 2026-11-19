#!/usr/bin/env node
// Builds the artwork for this profile README:
//   assets/hero.svg   the name on a keyboard, with a typing-test intro
//   assets/stack.svg  the stack as a keycap set
//   assets/pulse.svg  contribution activity for the last 30 days
//
// No dependencies. Every letter is drawn from outlines in glyphs.json, so the
// artwork looks the same on every device and needs no web fonts.
//
//   node scripts/build.mjs                    hero + stack, and pulse when GITHUB_TOKEN is set
//   node scripts/build.mjs --data file.json   pulse from a saved calendar (local previews)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = JSON.parse(await readFile(path.join(ROOT, 'scripts/glyphs.json'), 'utf8'));

// ── What the profile says. Edit here, then run the script. ───────────────────
const PROFILE = {
  handle: 'rtcpr404',
  motto: '404: limits not found',
  intro: 'i build full-stack things with typescript, go and python.',
  stack: [
    { name: 'languages', keys: ['TypeScript', 'JavaScript', 'Go', 'Python', 'Dart', 'Java', 'PHP', 'SQL'] },
    { name: 'frameworks and libraries', keys: ['Next.js', 'React', 'Express', 'Flutter', 'Firebase', 'OpenCV', 'Echo', 'GORM'] },
    { name: 'data and tools', keys: ['MySQL', 'Docker', 'Git', 'GitHub Actions'] },
  ],
};

// ── Colour and type ──────────────────────────────────────────────────────────
const C = {
  matTop: '#1a1d5c', matBottom: '#121440',   // the desk mat every panel sits on
  frame: '#2c38e0', frameLip: '#1a2296',     // keyboard case
  well: '#0a0c2c',                           // plate under the keys
  ink: '#151848',                            // legends
  text: '#f3eee2', muted: '#a5acf8', dim: '#4a52ad',
  caret: '#f4f05a',
  rule: '#2a2f7a',
  series: '#8089ee', peak: '#f25140',        // chart marks, checked for contrast and colour-blind separation on the mat
};
const CAPS = {
  bone: { top: '#f3eee2', side: '#c5bda9' },
  peri: { top: '#99a1f6', side: '#636cc9' },
  coral: { top: '#ff5f4e', side: '#c13a2e' },
};
const GLOW = ['#3cf0ff', '#42c6ff', '#5b9dff', '#8a7bff', '#b866ff', '#e455f0', '#ff4fc4', '#ff5f9e']; // light under the keys, cool to pink
const DISPLAY = 'd', MONO = 'm', MONO_MEDIUM = 'b';

const W = 880;
const n = (v) => String(+v.toFixed(2));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// ── A sheet is one SVG file ──────────────────────────────────────────────────
class Sheet {
  constructor(height, label) {
    this.h = height;
    this.label = label;
    this.glyphs = new Map();
    this.defs = [];
    this.css = [];
    this.body = [];
    this.defs.push(
      `<linearGradient id="mat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.matTop}"/><stop offset="1" stop-color="${C.matBottom}"/></linearGradient>`,
    );
    this.body.push(`<rect width="${W}" height="${height}" rx="22" fill="url(#mat)"/>`);
  }

  // Lay out a run of text. Returns its width in px and the <use> elements, in font units.
  run(str, font, size, each) {
    const f = FONTS[font];
    const scale = size / f.upm;
    let x = 0;
    let inner = '';
    [...str].forEach((ch, i) => {
      const cp = ch.codePointAt(0);
      const g = f.g[cp];
      if (!g) throw new Error(`glyphs.json has no "${ch}" for font "${font}"`);
      if (g[1]) {
        const id = `${font}${cp}`;
        if (!this.glyphs.has(id)) this.glyphs.set(id, `<path id="${id}" d="${g[1]}"/>`);
        inner += `<use href="#${id}"${x ? ` x="${x}"` : ''}${each ? each(i) : ''}/>`;
      }
      x += g[0];
    });
    return { width: x * scale, scale, inner, font: f };
  }

  // Place a run with the left end of its baseline at (x, y).
  place(run, x, y, fill, attrs = '') {
    return `<g transform="translate(${n(x)} ${n(y)}) scale(${run.scale} -${run.scale})" fill="${fill}"${attrs}>${run.inner}</g>`;
  }

  text(str, font, size, x, y, fill, attrs) {
    const run = this.run(str, font, size);
    this.body.push(this.place(run, x, y, fill, attrs));
    return run.width;
  }

  // A keycap: a darker base, and a top face (with its legend) that can travel when pressed.
  keycap({ x, y, w, h, cap, legend, size, depth = 11, faceAttrs = '' }) {
    const { top, side } = CAPS[cap];
    const fx = x + 4, fy = y + 2, fw = w - 8, fh = h - depth - 2;
    const run = this.run(legend, DISPLAY, size);
    const tall = legend.length > 1 || /[0-9A-Z]/.test(legend); // centre on cap height, else on x-height
    const glyphHeight = (tall ? run.font.cap : run.font.x) * run.scale;
    const lx = fx + (fw - run.width) / 2;
    const ly = fy + fh / 2 + glyphHeight / 2;
    return (
      `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="10" fill="${side}"/>` +
      `<g${faceAttrs}>` +
      `<rect x="${n(fx)}" y="${n(fy)}" width="${n(fw)}" height="${n(fh)}" rx="8" fill="${top}"/>` +
      `<rect x="${n(fx + 7)}" y="${n(fy + 3)}" width="${n(fw - 14)}" height="2" rx="1" fill="#fff" opacity=".5"/>` +
      this.place(run, lx, ly, C.ink) +
      `</g>`
    );
  }

  // The keyboard case: a lip for thickness, the frame, and the dark plate the keys sit in.
  frame(x, y, w, h) {
    return (
      `<rect x="${x}" y="${y + 9}" width="${w}" height="${h}" rx="18" fill="${C.frameLip}"/>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${C.frame}"/>` +
      `<rect x="${x + 20}" y="${y + 3}" width="${w - 40}" height="2" rx="1" fill="#fff" opacity=".16"/>` +
      `<rect x="${x + 12}" y="${y + 12}" width="${w - 24}" height="${h - 24}" rx="12" fill="${C.well}"/>`
    );
  }

  render() {
    const css = this.css.length
      ? `<style>${this.css.join('')}@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>\n`
      : '';
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${this.h}" width="${W}" height="${this.h}" role="img" aria-label="${esc(this.label)}">\n` +
      `<title>${esc(this.label)}</title>\n` +
      `<defs>${[...this.glyphs.values()].join('')}${this.defs.join('')}</defs>\n` +
      css +
      this.body.join('\n') +
      `\n</svg>\n`
    );
  }
}

// ── Hero: the handle on eight keys, then a typing test that introduces it ────
function hero() {
  const s = new Sheet(330, `${PROFILE.handle}. ${PROFILE.motto}. ${PROFILE.intro}`);
  const LOOP = 14; // seconds
  const pct = (t) => `${n((t / LOOP) * 100)}%`;

  // Keys
  const keys = [...PROFILE.handle];
  const firstDigit = keys.findIndex((k) => /\d/.test(k));
  const frame = { x: 30, y: 28, w: 820, h: 126 };
  const kw = 88, kh = 84, gap = 9, split = firstDigit > 0 ? 14 : 0;
  const rowWidth = keys.length * kw + (keys.length - 1) * gap + split;
  let kx = frame.x + (frame.w - rowWidth) / 2;
  const ky = frame.y + (frame.h - kh) / 2;
  const KEY_START = 0.35, KEY_STEP = 0.17;

  s.defs.push(
    `<filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="7"/></filter>`,
    `<filter id="softer" x="-10%" y="-300%" width="120%" height="700%"><feGaussianBlur stdDeviation="13"/></filter>`,
    `<linearGradient id="under" x1="0" y1="0" x2="1" y2="0">${GLOW.map((c, i) => `<stop offset="${n(i / (GLOW.length - 1))}" stop-color="${c}"/>`).join('')}</linearGradient>`,
    `<linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${GLOW[7]}" stop-opacity="0"/><stop offset=".3" stop-color="${GLOW[6]}"/><stop offset=".5" stop-color="#fff"/><stop offset=".7" stop-color="${GLOW[0]}"/><stop offset="1" stop-color="${GLOW[0]}" stop-opacity="0"/></linearGradient>`,
    `<clipPath id="plate"><rect x="${frame.x + 12}" y="${frame.y + 12}" width="${frame.w - 24}" height="${frame.h - 24}" rx="12"/></clipPath>`,
  );

  // Light spilling from under the case onto the mat
  s.body.push(`<rect x="${frame.x + 40}" y="${frame.y + frame.h + 2}" width="${frame.w - 80}" height="14" rx="7" fill="url(#under)" filter="url(#softer)" opacity=".5"/>`);
  s.body.push(s.frame(frame.x, frame.y, frame.w, frame.h));

  let glows = '', caps = '';
  keys.forEach((k, i) => {
    if (i === firstDigit && i > 0) kx += split;
    const v = ` style="--i:${i}"`;
    glows += `<rect class="glow"${v} x="${n(kx - 3)}" y="${n(ky - 3)}" width="${kw + 6}" height="${kh + 6}" rx="13" fill="${GLOW[i % GLOW.length]}"/>`;
    caps += s.keycap({ x: kx, y: ky, w: kw, h: kh, cap: /\d/.test(k) ? 'coral' : 'bone', legend: k, size: 42, depth: 12, faceAttrs: ` class="face"${v}` });
    kx += kw + gap;
  });
  const sweep = `<rect class="sweep" x="${frame.x - 260}" y="${frame.y + 12}" width="260" height="${frame.h - 24}" fill="url(#beam)"/>`;
  s.body.push(`<g clip-path="url(#plate)" filter="url(#soft)">${glows}${sweep}</g>`);
  s.body.push(caps);

  // Typing test: untyped text sits dim; each letter lights as the caret passes it.
  const x0 = 34;
  const lines = [
    { str: PROFILE.motto, font: MONO_MEDIUM, size: 40, y: 236, bright: C.text, step: 0.045 },
    { str: PROFILE.intro, font: MONO, size: 23, y: 286, bright: C.muted, step: 0.032 },
  ];
  let t = KEY_START + keys.length * KEY_STEP + 0.25;
  for (const line of lines) {
    line.count = [...line.str].length;
    line.start = t;
    line.end = t + line.count * line.step;
    line.advance = (FONTS[line.font].g[32][0] / FONTS[line.font].upm) * line.size;
    t = line.end + 0.3;
  }
  const RESET = LOOP - 0.8, FADE = 0.25;

  lines.forEach((line, li) => {
    const c = 'ab'[li];
    const first = line.start + line.step, last = line.end;
    // How long each letter stays lit. It must outlast the fade-out and be dark again
    // before its line comes back, because every letter runs the same keyframes on its own delay.
    const lit = (RESET + FADE - first + (LOOP - (last - first) - 0.1)) / 2;
    s.body.push(s.place(s.run(line.str, line.font, line.size), x0, line.y, C.dim));
    s.body.push(s.place(s.run(line.str, line.font, line.size, (i) => ` style="--i:${i + 1}"`), x0, line.y, line.bright, ` class="line-${c}"`));
    s.css.push(
      `.line-${c}{animation:show-${c} ${LOOP}s linear infinite}` +
      `.line-${c} use{animation:lit-${c} ${LOOP}s linear infinite both;animation-delay:calc(${n(line.start)}s + var(--i)*${n(line.step * 1000)}ms)}` +
      `@keyframes lit-${c}{0%{opacity:0}.01%,${pct(lit)}{opacity:1}${n((lit / LOOP) * 100 + 0.01)}%,to{opacity:0}}` +
      `@keyframes show-${c}{0%,${pct(first - 0.05)}{opacity:0}${pct(first - 0.04)},${pct(RESET)}{opacity:1}${pct(RESET + FADE)},to{opacity:0}}`,
    );
  });

  // Caret: an underline that steps one letter at a time, line by line, then returns to the start.
  const [a, b] = lines;
  const k = b.size / a.size;
  const at = (line, chars, scale) => `transform:translate(${n(x0 + chars * line.advance)}px,${line.y}px) scale(${n(scale)})`;
  s.body.push(`<g class="caret"><rect class="blink" x="1" y="7" width="${n(a.advance - 2)}" height="5" rx="2.5" fill="${C.caret}"/></g>`);
  let blink = '', on = true;
  for (let rest = b.end + 0.6; rest < RESET; rest += 0.55) blink += `${pct(rest)}{opacity:${(on = !on) ? 1 : 0}}`;
  s.css.push(
    `.caret{${at(b, b.count, k)};animation:caret ${LOOP}s infinite}` +
    `.blink{animation:blink ${LOOP}s step-end infinite}` +
    `@keyframes blink{${blink}${pct(RESET)}{opacity:1}}` +
    `@keyframes caret{` +
    `0%{${at(a, 0, 1)};animation-timing-function:step-end}` +
    `${pct(a.start)}{${at(a, 0, 1)};animation-timing-function:steps(${a.count},end)}` +
    `${pct(a.end)}{${at(a, a.count, 1)};animation-timing-function:step-end}` +
    `${pct(b.start - 0.12)}{${at(b, 0, k)};animation-timing-function:step-end}` +
    `${pct(b.start)}{${at(b, 0, k)};animation-timing-function:steps(${b.count},end)}` +
    `${pct(b.end)}{${at(b, b.count, k)};animation-timing-function:step-end}` +
    `${pct(RESET + FADE)},to{${at(a, 0, 1)}}}`,
  );

  // Key travel and the light under each key, one after another
  const delay = `animation-delay:calc(${KEY_START}s + var(--i)*${n(KEY_STEP * 1000)}ms)`;
  s.css.push(
    `.face{animation:press ${LOOP}s cubic-bezier(.2,.8,.3,1) infinite;${delay}}` +
    `.glow{opacity:.34;animation:glow ${LOOP}s ease-out infinite;${delay}}` +
    `.sweep{opacity:0;animation:sweep ${LOOP}s linear infinite}` +
    `@keyframes sweep{0%,${pct(b.end + 0.25)}{opacity:.9;transform:translateX(0)}${pct(b.end + 1.15)}{opacity:.9;transform:translateX(${frame.w + 260}px)}${n(((b.end + 1.15) / LOOP) * 100 + 0.01)}%,to{opacity:0;transform:translateX(0)}}` +
    `@keyframes press{0%,1.7%,to{transform:translateY(0)}.5%{transform:translateY(7px)}}` +
    `@keyframes glow{0%,6%,to{opacity:.34}.6%{opacity:1}}`,
  );
  return s.render();
}

// ── Stack: a keycap set, coloured by what each key is for ────────────────────
function stack() {
  const groups = PROFILE.stack;
  const capOf = ['bone', 'peri', 'coral'];
  const list = groups.map((g) => `${g.name}: ${g.keys.join(', ')}`).join('. ');
  const SIZE = 19, KH = 58, GAP = 8, PAD_X = 20;
  const frame = { x: 30, y: 28, w: 820 };
  const inner = frame.w - 24 - 16; // plate width minus its padding

  const probe = new Sheet(0, '');
  const keys = groups.flatMap((g, gi) => g.keys.map((legend) => ({ legend, cap: capOf[gi % capOf.length], min: probe.run(legend, DISPLAY, SIZE).width + PAD_X * 2 + 8 })));

  // Fill rows greedily against a target width, raising it until the rows come out even.
  const total = keys.reduce((sum, key) => sum + key.min + GAP, 0);
  const rowCount = Math.ceil(total / inner);
  let rows;
  for (let target = total / rowCount; ; target += 4) {
    rows = [[]];
    let used = 0;
    for (const key of keys) {
      const row = rows[rows.length - 1];
      if (row.length && used + key.min > Math.min(target, inner)) { rows.push([key]); used = key.min + GAP; }
      else { row.push(key); used += key.min + GAP; }
    }
    if (rows.length <= rowCount || target >= inner) break;
  }

  const plateHeight = rows.length * KH + (rows.length - 1) * GAP + 16;
  frame.h = plateHeight + 24;
  const legendY = frame.y + frame.h + 9 + 40;
  const s = new Sheet(legendY + 24, `Stack. ${list}.`);
  s.defs.push(
    `<linearGradient id="lit" x1="0" y1="0" x2="1" y2="1">${GLOW.map((c, i) => `<stop offset="${n(i / (GLOW.length - 1))}" stop-color="${c}"/>`).join('')}</linearGradient>`,
  );
  s.body.push(s.frame(frame.x, frame.y, frame.w, frame.h));
  s.body.push(`<rect x="${frame.x + 12}" y="${frame.y + 12}" width="${frame.w - 24}" height="${frame.h - 24}" rx="12" fill="url(#lit)" opacity=".24"/>`);

  let caps = '';
  rows.forEach((row, ri) => {
    const natural = row.reduce((sum, key) => sum + key.min, 0) + (row.length - 1) * GAP;
    const extra = (inner - natural) / row.length; // justify: every row spans the plate
    let x = frame.x + 12 + 8;
    const y = frame.y + 12 + 8 + ri * (KH + GAP);
    for (const key of row) {
      const w = key.min + extra;
      caps += s.keycap({ x, y, w, h: KH, cap: key.cap, legend: key.legend, size: SIZE, depth: 9 });
      x += w + GAP;
    }
  });
  s.body.push(caps);

  // Key: which colour means what
  let x = frame.x + 6;
  groups.forEach((g, gi) => {
    const cap = CAPS[capOf[gi % capOf.length]];
    s.body.push(`<rect x="${n(x)}" y="${legendY - 15}" width="18" height="18" rx="5" fill="${cap.top}"/>`);
    x += 28;
    x += s.text(g.name, MONO, 19, x, legendY, C.muted) + 34;
  });
  return s.render();
}

// ── Pulse: the last 30 days of contributions ─────────────────────────────────
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const dayLabel = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`;

function pulse(days) {
  const recent = days.slice(-30);
  const total = recent.reduce((sum, d) => sum + d.count, 0);
  const peak = recent.reduce((best, d) => (d.count > best.count ? d : best), recent[0]);
  // A streak runs up to today, or up to yesterday when today has nothing yet.
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) streak++;
    else if (i < days.length - 1 || streak) break;
  }
  const figure = total.toLocaleString('en-US');
  const busiest = peak.count ? ` Busiest day: ${peak.count}.` : '';
  const s = new Sheet(252, `${figure} contributions in the last 30 days. ${streak}-day streak.${busiest}`);

  // The figure, what it counts, and the streak
  let size = 88;
  while (size > 48 && s.run(figure, DISPLAY, size).width > 420) size -= 4; // keep a long figure clear of the plot
  s.text(figure, DISPLAY, size, 32, 112, C.text);
  s.text('contributions in the last 30 days', MONO, 21, 34, 152, C.muted);
  const value = s.text(String(streak), MONO_MEDIUM, 21, 34, 208, C.text);
  s.text('-day streak', MONO, 21, 34 + value, 208, C.muted);

  // Bars: one per day, thin, rounded at the data end, square on the baseline
  const left = 486, right = 846, base = 176, tallest = 112;
  const slot = (right - left) / recent.length;
  const bw = Math.min(24, slot - 2);
  let bars = '';
  recent.forEach((d, i) => {
    if (!d.count) return; // an empty day draws nothing; the baseline shows it was there
    const h = Math.max(4, (d.count / peak.count) * tallest);
    const bx = left + i * slot + (slot - bw) / 2;
    const r = Math.min(4, h, bw / 2);
    const isPeak = d === peak;
    bars += `<path class="bar" style="--i:${i}" fill="${isPeak ? C.peak : C.series}" d="M${n(bx)} ${base}V${n(base - h + r)}Q${n(bx)} ${n(base - h)} ${n(bx + r)} ${n(base - h)}H${n(bx + bw - r)}Q${n(bx + bw)} ${n(base - h)} ${n(bx + bw)} ${n(base - h + r)}V${base}Z"/>`;
    if (isPeak) {
      const run = s.run(String(d.count), MONO_MEDIUM, 19);
      const lx = Math.min(right - run.width, Math.max(left, bx + bw / 2 - run.width / 2));
      s.body.push(s.place(run, lx, base - h - 10, C.text, ' class="tag"'));
    }
  });
  s.body.push(`<rect x="${left}" y="${base}" width="${right - left}" height="1" fill="${C.rule}"/>`);
  s.body.push(bars);
  s.text(dayLabel(recent[0].date), MONO, 19, left, 208, C.muted);
  const end = s.run(dayLabel(recent[recent.length - 1].date), MONO, 19);
  s.body.push(s.place(end, right - end.width, 208, C.muted));

  s.css.push(
    `.bar{transform-box:fill-box;transform-origin:50% 100%;animation:grow .7s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i)*22ms)}` +
    `.tag{animation:fade .4s ease-out .9s both}` +
    `@keyframes grow{from{transform:scaleY(0)}}@keyframes fade{from{opacity:0}}`,
  );
  return s.render();
}

// ── Data: the public contribution calendar ───────────────────────────────────
async function fetchCalendar(login, token) {
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'profile-readme-build' },
    body: JSON.stringify({ query, variables: { login } }),
  });
  const json = await res.json().catch(() => ({}));
  const weeks = json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!res.ok || !weeks) throw new Error(`GitHub answered ${res.status}: ${JSON.stringify(json.errors ?? json.message ?? json).slice(0, 300)}`);
  return weeks.flatMap((w) => w.contributionDays).map((d) => ({ date: d.date, count: d.contributionCount }));
}

// ── Run ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const out = path.join(ROOT, 'assets');
await mkdir(out, { recursive: true });
const save = async (name, svg) => {
  await writeFile(path.join(out, name), svg);
  console.log(`${name}  ${(svg.length / 1024).toFixed(1)} kB`);
};

await save('hero.svg', hero());
await save('stack.svg', stack());

let days = null;
if (args.includes('--data')) {
  days = JSON.parse(await readFile(args[args.indexOf('--data') + 1], 'utf8')).days;
} else if (process.env.GITHUB_TOKEN) {
  try {
    days = await fetchCalendar(process.env.PROFILE_LOGIN || PROFILE.handle, process.env.GITHUB_TOKEN);
  } catch (err) {
    // Leave the last good pulse.svg in place rather than break the README.
    console.error(`Could not read contributions, keeping the existing pulse.svg. ${err.message}`);
  }
} else {
  console.log('pulse.svg  skipped (set GITHUB_TOKEN, or pass --data file.json)');
}
if (days?.length) await save('pulse.svg', pulse(days));
