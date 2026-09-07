import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'public', 'additional.css'), 'utf8');

test('dense dashboard typography retains component hierarchy without a global override layer', () => {
  assert.doesNotMatch(css, /KRDS typography baseline|--krds-body-size/);
  assert.match(css, /\.topbar h1\{font-size:30px/);
  assert.match(css, /\.workspace-page-intro p\{[\s\S]*font-size:\.92rem/);
  assert.match(css, /\.panel-head h3\{font-size:18px/);
  assert.match(css, /\.nav-item\{min-height:42px/);
});
