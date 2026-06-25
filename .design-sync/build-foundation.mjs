// design-sync foundation build (wired as cfg.buildCmd; re-run before the converter).
// 1. regenerate the bundle barrel (.design-sync/ds-entry.tsx) from gen-entry.mjs
// 2. compile the Tailwind v4 foundation (tokens + utilities + .ct-* classes)
// 3. rewrite the @font-face url() so the converter's extractFonts resolves it
//    from the cssEntry dir (.design-sync/) into public/fonts/.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const TW = resolve('.ds-sync/node_modules/.bin/tailwindcss');
const IN = '.design-sync/tw-entry.css';
const OUT = '.design-sync/compiled-foundation.css';

// 1. barrel
execFileSync(process.execPath, ['.design-sync/gen-entry.mjs'], { stdio: 'inherit' });

// 2. compile
if (!existsSync(TW)) { console.error(`tailwindcss CLI missing at ${TW} — run: (cd .ds-sync && npm i @tailwindcss/cli)`); process.exit(1); }
execFileSync(TW, ['-i', IN, '-o', OUT], { stdio: 'inherit' });

// 3. rewrite font url /fonts/<f> -> ../public/fonts/<f> (resolvable from .design-sync/)
let css = readFileSync(OUT, 'utf8');
const before = css;
css = css.replace(/url\(\s*(['"]?)\/fonts\/([^'")]+)\1\s*\)/g, 'url("../public/fonts/$2")');
if (css !== before) writeFileSync(OUT, css);
const n = (before.match(/url\(\s*['"]?\/fonts\//g) || []).length;
console.error(`[foundation] compiled ${OUT} (${(css.length / 1024).toFixed(0)} KB), rewrote ${n} font url(s)`);
