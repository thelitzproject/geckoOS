#!/usr/bin/env node

import fs   from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT   = path.resolve(__dirname, '../../');
const DIST   = path.resolve(ROOT, 'build/dist');

const COPY_DIRS = [
  'assets', 'styles', 'themes',
  'core', 'gsl', 'ui', 'apps', 'sdk',
];

const COPY_FILES = ['index.html', 'manifest.json', 'sw.js'];

async function build() {
  console.log('🦎 geckoOS build starting...');
  const start = Date.now();

  // Clean dist
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  // Copy dirs
  for (const dir of COPY_DIRS) {
    const src = path.join(ROOT, dir);
    const dst = path.join(DIST, dir);
    try {
      await fs.cp(src, dst, { recursive: true });
      console.log(`  ✓ ${dir}/`);
    } catch {
      console.warn(`  - ${dir}/ (not found, skipping)`);
    }
  }

  // Copy root files
  for (const file of COPY_FILES) {
    try {
      await fs.copyFile(path.join(ROOT, file), path.join(DIST, file));
      console.log(`  ✓ ${file}`);
    } catch {
      console.warn(`  - ${file} (not found, skipping)`);
    }
  }

  // Write build metadata
  const meta = {
    version:   '1.0.0',
    codename:  'Bijou',
    buildTime: new Date().toISOString(),
    commit:    process.env.GITHUB_SHA ?? 'local',
  };
  await fs.writeFile(path.join(DIST, 'build-meta.json'), JSON.stringify(meta, null, 2));

  console.log(`\n✅ Build complete in ${Date.now() - start}ms → build/dist/`);
}

build().catch(e => { console.error('Build failed:', e); process.exit(1); });
