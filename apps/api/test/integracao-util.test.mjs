import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { LimiteJanela, confere, consultaNbi, lerBusca, lerChaves, nomeAtendente, projetar, sistemaDaChave } from '../src/modules/integracao/integracao-util.ts';

const CHAVE = 'ak_teste_' + 'x'.repeat(32);
const sha = (s) => createHash('sha256').update(s).digest('hex');

test('chave: só o sha256 fica no ambiente; chave certa entra, errada e ausente não', () => {
  const chaves = lerChaves(`atendehub:${sha(CHAVE)}, lixo, outro:123`);
  assert.equal(chaves.length, 1, 'entrada malformada é ignorada');
  assert.equal(sistemaDaChave(`Bearer ${CHAVE}`, chaves), 'atendehub');
  assert.equal(sistemaDaChave(`Bearer ${CHAVE}y`, chaves), null);
  assert.equal(sistemaDaChave(undefined, chaves), null);
  assert.equal(sistemaDaChave(CHAVE, chaves), null, 'sem Bearer');
});

test('chave: sem INTEGRACAO_CHAVES ninguém entra (falha fechada)', () => {
  assert.equal(sistemaDaChave(`Bearer ${CHAVE}`, lerChaves(undefined)), null);
  assert.equal(sistemaDaChave(`Bearer ${CHAVE}`, lerChaves('')), null);
});

test('limite por janela', () => {
  const l = new LimiteJanela(2, 1000);
  assert.equal(l.permitir('a', 0), true);
  assert.equal(l.permitir('a', 10), true);
  assert.equal(l.permitir('a', 20), false);
  assert.equal(l.permitir('b', 20), true, 'outro sistema tem a própria cota');
  assert.equal(l.permitir('a', 1500), true, 'janela anda');
});

test('busca: exatamente um critério e no formato', () => {
  assert.deepEqual(lerBusca({ pppoe: ' kovausk ' }), { tipo: 'pppoe', valor: 'kovausk' });
  assert.ok('erro' in lerBusca({}));
  assert.ok('erro' in lerBusca({ pppoe: 'a', sn: 'ABCD1234' }), 'dois critérios');
  assert.ok('erro' in lerBusca({ pppoe: '{"$ne":null}' }), 'nada de operador do Mongo');
  assert.ok('erro' in lerBusca({ ip: '999.1.1.1' }));
  assert.deepEqual(lerBusca({ ip: '100.65.18.235' }), { tipo: 'ip', valor: '100.65.18.235' });
  assert.ok('erro' in lerBusca({ pppoe: ['a'] }), 'array (query repetida) é recusado');
});

test('consulta do NBI: serial direto; pppoe/ip por caminhos conhecidos', () => {
  assert.deepEqual(consultaNbi({ tipo: 'sn', valor: 'ABCD1234' }), { '_deviceId._SerialNumber': 'ABCD1234' });
  const q = consultaNbi({ tipo: 'pppoe', valor: 'kovausk' });
  assert.ok(q.$or.length >= 4);
  assert.ok(q.$or.every((c) => Object.values(c)[0] === 'kovausk'));
});

test('confere: a consulta traz candidatos, só passa quem bate de verdade', () => {
  assert.equal(confere({ tipo: 'pppoe', valor: 'kovausk' }, { pppoeUsername: 'Kovausk ' }), true, 'roteador manda com espaço e maiúscula');
  assert.equal(confere({ tipo: 'pppoe', valor: 'kovausk' }, { pppoeUsername: 'outro' }), false);
  assert.equal(confere({ tipo: 'sn', valor: 'abcd' }, { serialNumber: 'X' }, 'ABCD'), true);
  assert.equal(confere({ tipo: 'ip', valor: '1.2.3.4' }, { ipAddress: '1.2.3.5' }), false);
});

test('projeção: lista fechada, sem senha nem campo cru', () => {
  const cpe = {
    id: 'X-Y-SN1', serialNumber: 'SN1', manufacturer: 'Huawei', modelName: 'EG8145V5', softwareVersion: 'V5',
    online: true, lastInform: '2026-11-14T06:00:00.000Z', pppoeUsername: 'kovausk', ipAddress: '1.2.3.4',
    optical: { rxDbm: -19.5, txDbm: 2.1, status: 'optimal' },
    wifi: [{ band: '5GHz', ssid: 'Casa', enabled: true, channel: 149, connectedClientsCount: 3, password: 'segredo', KeyPassphrase: 'segredo' }],
    wan: [{ type: 'PPPoE', status: 'Connected', ipAddress: '1.2.3.4', uptimeSeconds: 100, password: 'pppsenha' }],
    senhaQualquer: 'segredo',
  };
  const saida = projetar(cpe, { camadaProvavel: null, confianca: null, resumo: 'ok', achados: [{ camada: 'wifi-radio', gravidade: 'baixa', mensagem: 'm', evidencia: ['mac aa:bb'] }] });
  const json = JSON.stringify(saida);
  assert.ok(!json.includes('segredo') && !json.includes('pppsenha'), 'senha não sai');
  assert.ok(!json.includes('aa:bb'), 'evidência crua do diagnóstico não sai');
  assert.equal(saida.wifi[0].aparelhos, 3);
  assert.equal(saida.sinal.rxDbm, -19.5);
});

test('nome do atendente: curto e sem caractere de controle', () => {
  assert.equal(nomeAtendente('Maria\nSilva'), 'MariaSilva');
  assert.equal(nomeAtendente('x'.repeat(200)).length, 80);
  assert.equal(nomeAtendente(undefined), null);
});
