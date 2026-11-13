import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticar } from '../src/modules/genieacs/diagnostico.ts';

const IGD = 'InternetGatewayDevice';
const W = `${IGD}.LANDevice.1.WLANConfiguration`;
const H = `${IGD}.LANDevice.1.Hosts.Host`;
const PING = `${IGD}.IPPingDiagnostics`;
const POP = '10.0.0.1';

// CPE saudável de base: Wi-Fi 2.4 (6) e 5G (36), sinal -19 dBm, PPPoE conectado.
const base = () => ({
  [`${W}.1.SSID`]: 'casa', [`${W}.1.Channel`]: '6', [`${W}.1.Enable`]: '1',
  [`${W}.5.SSID`]: 'casa-5g', [`${W}.5.Channel`]: '36', [`${W}.5.Enable`]: '1',
  [`${IGD}.WANDevice.1.X_GponInterafceConfig.RXPower`]: '-19.2',
  [`${IGD}.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ConnectionStatus`]: 'Connected',
});
const online = { online: true, alvoReferencia: POP };

test('saudável: sem achados, sem propostas, diz que nada foi alterado', () => {
  const d = diagnosticar(base(), online);
  assert.equal(d.camadaProvavel, null);
  assert.deepEqual(d.achados, []);
  assert.deepEqual(d.propostas, []);
  assert.match(d.resumo, /Nenhuma configuração foi alterada/);
});

test('aparelho longe com link limpo: cobertura, com o nome do aparelho e evidência contra o link', () => {
  const d = diagnosticar({
    ...base(),
    [`${H}.1.HostName`]: 'TV-Sala', [`${H}.1.MACAddress`]: 'aa-bb-cc-00-00-01', [`${H}.1.Active`]: '1',
    [`${W}.5.AssociatedDevice.1.AssociatedDeviceMACAddress`]: 'AA:BB:CC:00:00:01',
    [`${W}.5.AssociatedDevice.1.AssociatedDeviceRssi`]: '-78dBm',
    [`${PING}.DiagnosticsState`]: 'Complete', [`${PING}.Host`]: POP,
    [`${PING}.SuccessCount`]: '50', [`${PING}.FailureCount`]: '0', [`${PING}.AverageResponseTime`]: '4',
  }, online);
  assert.equal(d.camadaProvavel, 'wifi-cobertura');
  assert.equal(d.confianca, 'alta');
  const a = d.achados[0];
  assert.ok(a.evidencia.includes('TV-Sala: -78 dBm'));
  assert.ok(a.evidencia.some((e) => e.startsWith('contra a hipótese de link')));
  assert.match(a.evitar, /canal/);
  assert.deepEqual(d.propostas, []);
});

test('fibra crítica vem antes do Wi-Fi fraco (camada de baixo explica a de cima)', () => {
  const d = diagnosticar({
    ...base(),
    [`${IGD}.WANDevice.1.X_GponInterafceConfig.RXPower`]: '-28.4',
    [`${W}.1.AssociatedDevice.1.AssociatedDeviceMACAddress`]: 'AA:BB:CC:00:00:09',
    [`${W}.1.AssociatedDevice.1.AssociatedDeviceRssi`]: '-80',
  }, online);
  assert.equal(d.camadaProvavel, 'fibra');
  assert.deepEqual(d.achados.map((a) => a.camada), ['fibra', 'wifi-cobertura']);
});

test('offline: camada wan, alta, e avisa que os dados podem estar velhos', () => {
  const d = diagnosticar(base(), { online: false, ultimoInform: '2026-11-13T19:00:00Z' });
  assert.equal(d.camadaProvavel, 'wan');
  assert.match(d.achados[0].mensagem, /sem contato com o ACS desde 2026-11-13T19:00:00Z/);
});

test('5 GHz em DFS: só proposta de teste, com valor para desfazer', () => {
  const d = diagnosticar({ ...base(), [`${W}.5.Channel`]: '100' }, online);
  assert.equal(d.achados[0].camada, 'wifi-radio');
  assert.equal(d.achados[0].gravidade, 'baixa');
  assert.deepEqual(d.propostas[0].parametros, { band: '5GHz', channel: 36 });
  assert.deepEqual(d.propostas[0].reversao, { band: '5GHz', channel: 100 });
});

test('perda no ping para a internet (não o POP) não vira alta: pede repetir até o POP', () => {
  const d = diagnosticar({
    ...base(),
    [`${PING}.DiagnosticsState`]: 'Complete', [`${PING}.Host`]: '8.8.8.8',
    [`${PING}.SuccessCount`]: '8', [`${PING}.FailureCount`]: '2',
  }, online);
  assert.equal(d.achados[0].gravidade, 'media');
  assert.match(d.achados[0].proximoTeste, /POP/);
});

test('porta gigabit negociando 100 abaixo do plano: aponta o cabo, não o equipamento', () => {
  const d = diagnosticar({
    ...base(),
    [`${IGD}.WANDevice.1.WANCommonInterfaceConfig.Layer1DownstreamMaxBitRate`]: '100000000',
    [`${IGD}.WANDevice.1.WANEthernetInterfaceConfig.1.MaxBitRate`]: '1000',
  }, { ...online, planoMbps: 300 });
  assert.equal(d.camadaProvavel, 'wan');
  assert.match(d.achados[0].mensagem, /cabo ou conector/);
});
