// Single version: package.json is the source; tauri.conf.json and Cargo.toml follow.
// Usage: node scripts/sync-version.mjs          write the package.json version
//        node scripts/sync-version.mjs --check  exit 1 when they differ (CI / release)
// Runs automatically on `npm version <x>` (see the "version" script in package.json).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const file = (p) => fileURLToPath(new URL(p, root));

export function readVersions() {
  const pkg = JSON.parse(readFileSync(file('package.json'), 'utf8')).version;
  const conf = JSON.parse(readFileSync(file('src-tauri/tauri.conf.json'), 'utf8')).version;
  const cargo = (readFileSync(file('src-tauri/Cargo.toml'), 'utf8').match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m) || [])[1];
  return { pkg, conf, cargo };
}

export function syncVersions() {
  const { pkg } = readVersions();
  const confPath = file('src-tauri/tauri.conf.json');
  const conf = JSON.parse(readFileSync(confPath, 'utf8'));
  conf.version = pkg;
  writeFileSync(confPath, JSON.stringify(conf, null, 2) + '\n');
  const cargoPath = file('src-tauri/Cargo.toml');
  const cargo = readFileSync(cargoPath, 'utf8').replace(/^(\[package\][\s\S]*?^version\s*=\s*)"[^"]+"/m, `$1"${pkg}"`);
  writeFileSync(cargoPath, cargo);
  return pkg;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--check')) {
    const v = readVersions();
    if (v.pkg !== v.conf || v.pkg !== v.cargo) {
      console.error(`Version mismatch: package.json ${v.pkg}, tauri.conf.json ${v.conf}, Cargo.toml ${v.cargo}. Run: node scripts/sync-version.mjs`);
      process.exit(1);
    }
    console.log(`Version ${v.pkg} (package.json = tauri.conf.json = Cargo.toml)`);
  } else {
    console.log('Synced version', syncVersions());
  }
}
