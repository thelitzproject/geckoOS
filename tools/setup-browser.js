#!/usr/bin/env node
/**
 * tools/setup-browser.js
 *
 * Clones thelitzproject/browser.js into vendor/browser.js and builds it.
 * Run via:  npm run setup:browser
 *
 * Requirements:
 *   - git
 *   - pnpm  (install with: npm i -g pnpm)
 *   - Rust/cargo  (install from https://rustup.rs)
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT   = join(__dirname, '..');
const VENDOR = join(ROOT, 'vendor', 'browser.js');
const DIST   = join(VENDOR, 'packages', 'chrome', 'dist', 'index.html');

const run = (cmd, cwd = ROOT) => {
  console.log(`\n→ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
};

const check = (cmd, name) => {
  try { execSync(`${cmd} --version`, { stdio: 'pipe' }); return true; }
  catch { console.error(`✗ ${name} not found. Install it and re-run npm run setup:browser`); return false; }
};

console.log('┌─────────────────────────────────────────┐');
console.log('│  geckoOS — browser.js setup             │');
console.log('└─────────────────────────────────────────┘\n');

// Check dependencies
if (!check('git',           'git'))          process.exit(1);
if (!check('pnpm',          'pnpm'))         { console.log('  Install pnpm:         npm i -g pnpm'); process.exit(1); }
if (!check('cargo',         'Rust/cargo'))   { console.log('  Install Rust:         https://rustup.rs'); process.exit(1); }
if (!check('wasm-pack',     'wasm-pack'))    { console.log('  Install wasm-pack:    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh'); process.exit(1); }
if (!check('wasm-opt',      'wasm-opt'))     { console.log('  Install binaryen:     https://github.com/WebAssembly/binaryen/releases  (or: brew install binaryen)'); process.exit(1); }
if (!check('wasm-bindgen',  'wasm-bindgen')) { console.log('  Install:              cargo install wasm-bindgen-cli'); process.exit(1); }
if (!check('wasm-snip',     'wasm-snip'))    { console.log('  Install (r58playz fork): cargo install --git https://github.com/r58playz/wasm-snip wasm-snip'); process.exit(1); }

// Already built?
if (existsSync(DIST)) {
  console.log('✓ browser.js already built at vendor/browser.js/packages/chrome/dist/');
  console.log('  Delete vendor/browser.js/ and re-run to rebuild.');
  process.exit(0);
}

// Clone browser.js
if (!existsSync(VENDOR)) {
  run('git clone --depth=1 https://github.com/thelitzproject/browser.js vendor/browser.js');
} else {
  console.log('  vendor/browser.js already cloned — skipping clone.');
}

// Clone dreamlandjs dependency
const dreamland = join(VENDOR, 'external', 'dreamlandjs');
if (!existsSync(dreamland)) {
  run(
    'git clone --depth=1 https://github.com/MercuryWorkshop/dreamlandjs external/dreamlandjs',
    VENDOR
  );
}

// Install dependencies
run('pnpm install', VENDOR);

// Build scramjet WASM first (required by the main rspack build)
const scramjetCore = join(VENDOR, 'packages', 'scramjet', 'packages', 'core');
if (existsSync(scramjetCore)) {
  run('pnpm run rewriter:build', scramjetCore);
} else {
  console.warn('  scramjet/core not found — skipping WASM build');
}

// Main build
run('pnpm run build', VENDOR);

// Verify
if (existsSync(DIST)) {
  console.log('\n✓ browser.js built successfully!');
  console.log('  Reload geckoOS to use the browser.\n');
} else {
  console.error('\n✗ Build completed but dist not found at expected path.');
  console.error('  Check build output above for errors.\n');
  process.exit(1);
}
