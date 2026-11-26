// Rule §3.3 — no network dependency at runtime: the app shell and sources
// must not reference any remote script, stylesheet or font.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

describe('offline-first sources', () => {
  const files = ['index.html', ...walk('src')];
  it.each(files)('%s has no remote asset URL', (f) => {
    const t = readFileSync(f, 'utf8');
    expect(t).not.toMatch(/(src|href)=["']https?:\/\//);
    expect(t).not.toMatch(/fonts\.googleapis|fonts\.gstatic|cdn\.jsdelivr|unpkg\.com/);
    expect(t).not.toMatch(/window\.claude/);
  });
});
