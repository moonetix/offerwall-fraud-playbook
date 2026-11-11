import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.') || name === 'node_modules') return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const checked = files(ROOT).filter((f) => ['.md', '.mjs', '.php', '.sql', '.json'].includes(extname(f)));

test('house style: plain hyphens, no emoji', () => {
  for (const f of checked) {
    const text = readFileSync(f, 'utf8');
    assert.doesNotMatch(text, new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`, 'u'), `${f}: en or em dash`);
    assert.doesNotMatch(text, /\p{Extended_Pictographic}/u, `${f}: emoji`);
  }
});

test('relative links in chapters and README resolve', () => {
  for (const f of checked.filter((x) => x.endsWith('.md'))) {
    const text = readFileSync(f, 'utf8');
    for (const [, target] of text.matchAll(/\]\(((?!https?:|#|mailto:)[^)#]+)(?:#[^)]*)?\)/g)) {
      assert.doesNotThrow(() => statSync(join(dirname(f), target)), `${f} -> ${target}`);
    }
  }
});
