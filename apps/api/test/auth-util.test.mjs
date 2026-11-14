import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conferirSenha, gerarHash, hashToken, lerCookie, novoToken, podeEscrever, Tentativas } from '../src/modules/auth/auth-util.ts';

test('senha: confere a certa, recusa a errada e hash malformado', async () => {
  const h = await gerarHash('senha-forte-123');
  assert.match(h, /^scrypt\$/);
  assert.equal(await conferirSenha('senha-forte-123', h), true);
  assert.equal(await conferirSenha('senha-forte-124', h), false);
  assert.equal(await conferirSenha('x', 'lixo'), false);
  assert.equal(await conferirSenha('x', 'scrypt$YQ==$YQ=='), false);
  assert.notEqual(await gerarHash('a'), await gerarHash('a'), 'salt diferente a cada hash');
});

test('token: aleatório e o banco só vê o sha256', () => {
  const t = novoToken();
  assert.notEqual(t, novoToken());
  assert.equal(hashToken(t).length, 64);
  assert.notEqual(hashToken(t), t);
});

test('cookie: acha pelo nome exato', () => {
  assert.equal(lerCookie('a=1; citacs_sessao=abc%2Fd; b=2', 'citacs_sessao'), 'abc/d');
  assert.equal(lerCookie('xcitacs_sessao=1', 'citacs_sessao'), undefined);
  assert.equal(lerCookie(undefined, 'citacs_sessao'), undefined);
});

test('perfil: leitura não escreve', () => {
  assert.equal(podeEscrever('leitura'), false);
  assert.equal(podeEscrever('escrita'), true);
  assert.equal(podeEscrever('admin'), true);
});

test('tentativas: trava na 5ª falha e solta depois da janela', () => {
  const t = new Tentativas(5, 1000);
  for (let i = 0; i < 4; i++) t.falhou('ana', 0);
  assert.equal(t.bloqueado('ana', 10), false);
  t.falhou('ana', 20);
  assert.equal(t.bloqueado('ana', 30), true);
  assert.equal(t.bloqueado('bia', 30), false, 'outro login não é afetado');
  assert.equal(t.bloqueado('ana', 1100), false, 'janela venceu');
  t.falhou('ana', 1200);
  t.limpar('ana');
  assert.equal(t.bloqueado('ana', 1201), false);
});
