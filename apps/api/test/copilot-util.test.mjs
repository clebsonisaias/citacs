import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrar, motivoFalhaIa, paraIa } from '../src/modules/ai/copilot-util.ts';

const cpe = {
  id: '00E0FC-Huawei-SERIAL1', serialNumber: 'SERIAL1', manufacturer: 'Huawei', modelName: 'HG8145',
  ipAddress: '100.64.0.9', macAddress: 'AA:BB:CC:DD:EE:FF', pppoeUsername: 'Maria ', online: true,
  lastInform: '2026-11-14T00:00:00Z', optical: { rxDbm: -20.1 }, wifi: [{ ssid: 'Casa da Maria' }],
};
const cliente = {
  nome: 'MARIA DA CONCEIÇÃO', pppoeLogin: 'maria', plano: 'Ultra 500', planoMbps: 500, online: true,
  servicoId: 1, endereco: 'RUA A, 1', bairro: 'CENTRO', cidade: 'NATAL',
};

test('paraIa não leva IP, MAC, endereço nem SSID para a IA', () => {
  const r = paraIa(cpe, cliente);
  const texto = JSON.stringify(r);
  for (const proibido of ['100.64.0.9', 'AA:BB', 'RUA A', 'Casa da Maria']) assert.ok(!texto.includes(proibido), proibido);
  assert.equal(r.cliente.nome, 'MARIA DA CONCEIÇÃO');
  assert.equal(r.cliente.loginConfere, true);
});

test('paraIa marca login que não bate e aceita roteador sem cliente', () => {
  assert.equal(paraIa({ ...cpe, pppoeUsername: 'joao' }, cliente).cliente.loginConfere, false);
  assert.equal(paraIa(cpe, null).cliente, null);
});

test('filtrar acha por nome sem acento, login ou serial, e exige todas as palavras', () => {
  const lista = [paraIa(cpe, cliente), paraIa({ ...cpe, id: 'X-OUTRO' }, null)];
  assert.equal(filtrar(lista, 'maria conceicao').length, 1);
  assert.equal(filtrar(lista, 'serial1').length, 1);
  assert.equal(filtrar(lista, 'maria joaquina').length, 0);
  assert.equal(filtrar(lista, '').length, 2);
});

test('motivoFalhaIa traduz falta de crédito', () => {
  assert.equal(motivoFalhaIa('429 You have no credits remaining'), 'a conta da OpenAI está sem crédito');
  assert.equal(motivoFalhaIa('timeout'), 'a IA não respondeu');
});
