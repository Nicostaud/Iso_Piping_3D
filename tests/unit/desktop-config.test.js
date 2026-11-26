// Desktop packaging settings required by CLAUDE.md §10 (phase 3).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { readVersions } from '../../scripts/sync-version.mjs';

const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const conf = json('src-tauri/tauri.conf.json');

describe('tauri.conf.json', () => {
  it('build wiring', () => {
    expect(conf.build).toMatchObject({ frontendDist: '../dist', devUrl: 'http://localhost:5173', beforeBuildCommand: 'npm run build' });
  });
  it('main window 1400x900, minimum 1024x700', () => {
    expect(conf.app.windows[0]).toMatchObject({ title: 'Iso Piping 3D', width: 1400, height: 900, minWidth: 1024, minHeight: 700 });
  });
  it('Windows installers: MSI + NSIS; standard installer downloads WebView2, offshore embeds it', () => {
    expect(conf.bundle.targets).toEqual(['msi', 'nsis']);
    expect(conf.bundle.windows.webviewInstallMode.type).toBe('downloadBootstrapper');
    expect(json('src-tauri/tauri.offshore.conf.json').bundle.windows.webviewInstallMode.type).toBe('offlineInstaller');
  });
  it('.isop file association', () => {
    expect(conf.bundle.fileAssociations[0].ext).toEqual(['isop']);
  });
  it('code signing not enabled', () => {
    expect(conf.bundle.windows.certificateThumbprint).toBeNull();
  });
});

describe('capabilities', () => {
  const cap = json('src-tauri/capabilities/default.json');
  it('minimal permissions, no static file system scope', () => {
    expect(cap.windows).toEqual(['main']);
    expect(cap.permissions.filter((p) => typeof p !== 'string')).toEqual([]);
    expect(cap.permissions.some((p) => /^fs:(default|allow-(read|write)-all|scope)/.test(p))).toBe(false);
    expect(cap.permissions.filter((p) => p.startsWith('fs:')).sort()).toEqual(['fs:allow-read-text-file', 'fs:allow-write-file', 'fs:allow-write-text-file']);
  });
});

describe('single version', () => {
  it('package.json = tauri.conf.json = Cargo.toml', () => {
    const v = readVersions();
    expect(v.conf).toBe(v.pkg);
    expect(v.cargo).toBe(v.pkg);
  });
});
