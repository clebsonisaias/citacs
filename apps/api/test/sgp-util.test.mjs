import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extrairCliente, normalizarLogin, planoMbps } from '../src/modules/sgp/sgp-util.ts';

// Formato real de /ws/radius/radacct/list/all/ (valores inventados).
const resposta = {
  paggination: {},
  result: [
    {
      nome: 'MARIA EXEMPLO', pppoe_login: 'maria', pppoe_senha: 'NAO-PODE-VAZAR', plano: 'Fibra - ⚡ Ultra 500.exp.260818',
      plano_id: 1, servico_id: 42, online: true, ip: '', endereco: 'RUA A, 1, CENTRO, NATAL, RN', endereco_bairro: 'CENTRO',
      endereco_cidade: 'NATAL', endereco_latitude: '-5.8', radacct: [],
    },
  ],
};

test('cliente: lê os campos e nunca traz a senha PPPoE', () => {
  const c = extrairCliente(resposta);
  assert.equal(c.nome, 'MARIA EXEMPLO');
  assert.equal(c.pppoeLogin, 'maria');
  assert.equal(c.planoMbps, 500);
  assert.equal(c.online, true);
  assert.equal(c.servicoId, 42);
  assert.equal(c.bairro, 'CENTRO');
  assert.ok(!JSON.stringify(c).includes('NAO-PODE-VAZAR'));
});

test('cliente: prefere a sessão online; lista vazia é null; resposta sem lista é erro', () => {
  const duas = { result: [{ nome: 'ANTIGA', online: false }, { nome: 'ATUAL', online: true }] };
  assert.equal(extrairCliente(duas).nome, 'ATUAL');
  assert.equal(extrairCliente({ result: [] }), null);
  assert.throws(() => extrairCliente({ msg: 'Token inválido' }), /Token inválido/);
  assert.throws(() => extrairCliente(null), /Resposta inesperada/);
});

test('plano: tira a velocidade do nome', () => {
  assert.equal(planoMbps('Fibra - ⚡ Ultra 500.exp.260818'), 500);
  assert.equal(planoMbps('PLANO 100MB'), 100);
  assert.equal(planoMbps('Fibra 1 Giga'), 1000);
  assert.equal(planoMbps('Empresarial'), null);
  assert.equal(planoMbps(null), null);
});

test('login: compara sem espaço e sem maiúscula (o roteador manda "Kovausk ")', () => {
  assert.equal(normalizarLogin('Kovausk '), normalizarLogin('kovausk'));
});
