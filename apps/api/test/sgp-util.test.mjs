import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extrairCliente, normalizarLogin, planoMbps, resolverVinculoCliente } from '../src/modules/sgp/sgp-util.ts';

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

test('cliente: extrai métricas da sessão ativa no BRAS (radacct)', () => {
  const comSessao = {
    result: [
      {
        nome: 'TEOBALDO GUEDES',
        pppoe_login: 'kovausk',
        plano: '500M',
        online: true,
        radacct: [
          {
            acctstarttime: '2026-11-15T08:57:50',
            acctstoptime: null,
            nasipaddress: '170.82.252.2',
            callingstationid: '88:36:cf:5c:76:af',
            acctoutputoctets: 104857600, // 100 MB
            acctinputoctets: 52428800,   // 50 MB
          },
        ],
      },
    ],
  };
  const c = extrairCliente(comSessao);
  assert.equal(c.sessaoConectadaEm, '2026-11-15T08:57:50');
  assert.equal(c.nasIp, '170.82.252.2');
  assert.equal(c.macConectado, '88:36:cf:5c:76:af');
  assert.equal(c.downloadMb, 100);
  assert.equal(c.uploadMb, 50);
});

test('vinculo: prioriza login PPPoE e vincula com segurança mesmo em IP dinâmico/CGNAT', () => {
  const teobaldo = { nome: 'TEOBALDO GUEDES', pppoeLogin: 'teobaldo.guedes', plano: '500M', planoMbps: 500, online: true, servicoId: 10, endereco: null, bairro: null, cidade: null };
  const outro = { nome: 'OUTRO CLIENTE', pppoeLogin: 'outro.cliente', plano: '200M', planoMbps: 200, online: true, servicoId: 99, endereco: null, bairro: null, cidade: null };

  const cpe = { pppoeUsername: 'teobaldo.guedes', ipAddress: '100.65.18.235' };
  const r = resolverVinculoCliente(cpe, teobaldo, outro);
  assert.equal(r.metodo, 'login');
  assert.equal(r.loginConfere, true);
  assert.equal(r.cliente?.nome, 'TEOBALDO GUEDES');
});

test('vinculo: bloqueia atribuição indevida quando o IP pertence a outro cliente', () => {
  const maria = { nome: 'MARIA EXEMPLO', pppoeLogin: 'maria', plano: '500M', planoMbps: 500, online: true, servicoId: 42, endereco: null, bairro: null, cidade: null };
  const cpe = { pppoeUsername: 'teobaldo.guedes', ipAddress: '100.65.18.235' };

  // Login do Teobaldo não encontrado ainda no SGP, mas o IP pertence à Maria no CGNAT
  const r = resolverVinculoCliente(cpe, null, maria);
  assert.equal(r.cliente, null, 'NÃO pode atribuir Maria ao roteador do Teobaldo');
  assert.equal(r.loginConfere, false);
  assert.ok(r.motivo?.includes('possui sessão de outro assinante'));
});

test('vinculo: aceita fallback por IP quando os logins conferem ou quando é IPoE', () => {
  const joao = { nome: 'JOAO SILVA', pppoeLogin: 'joao.silva', plano: '300M', planoMbps: 300, online: true, servicoId: 1, endereco: null, bairro: null, cidade: null };

  // Logins batem
  const r1 = resolverVinculoCliente({ pppoeUsername: 'joao.silva', ipAddress: '10.0.0.1' }, null, joao);
  assert.equal(r1.metodo, 'ip');
  assert.equal(r1.cliente?.nome, 'JOAO SILVA');
  assert.equal(r1.loginConfere, true);

  // Sem login no roteador (IPoE)
  const r2 = resolverVinculoCliente({ ipAddress: '10.0.0.1' }, null, joao);
  assert.equal(r2.metodo, 'ip');
  assert.equal(r2.cliente?.nome, 'JOAO SILVA');
  assert.equal(r2.loginConfere, null);
});
