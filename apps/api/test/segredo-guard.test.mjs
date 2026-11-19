import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segredoConfere } from '../src/modules/auth/segredo-util.ts';

const S = 'x'.repeat(32);
test('segredo: só entra com o valor exato', () => {
  assert.equal(segredoConfere(S, S), true);
  assert.equal(segredoConfere(S + 'y', S), false);
  assert.equal(segredoConfere('', S), false);
  assert.equal(segredoConfere(undefined, S), false);
  assert.equal(segredoConfere([S], S), false, 'query repetida (array) é recusada');
});
test('segredo: sem variável ou curta demais, ninguém entra (falha fechada)', () => {
  assert.equal(segredoConfere('', undefined), false);
  assert.equal(segredoConfere(undefined, undefined), false);
  assert.equal(segredoConfere('curto', 'curto'), false);
});
