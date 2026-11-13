// node --test test/  (Node >= 22.18 roda o .ts importado direto, sem build)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paramsDeGenie, normalizarParams, normalizarDbm, indicesWifi, caminhosWifi } from '../src/modules/genieacs/cpe-normalizer.ts';

// Monta o JSON aninhado do GenieACS ({ a: { b: { _value } } }) a partir de caminho→valor.
function genie(flat) {
  const root = { _id: 'x' };
  for (const [path, value] of Object.entries(flat)) {
    let n = root;
    for (const k of path.split('.')) n = n[k] ??= {};
    n._value = value;
    n._writable = true;
  }
  return root;
}

test('Huawei EG8145V5 (TR-098): Wi-Fi em 1 e 5, WAN fora do .1.1, sinal em dBm', () => {
  const igd = 'InternetGatewayDevice';
  const w = `${igd}.LANDevice.1.WLANConfiguration`;
  const wan = `${igd}.WANDevice.1.WANConnectionDevice`;
  const p = paramsDeGenie(genie({
    [`${igd}.DeviceInfo.Manufacturer`]: 'Huawei Technologies Co., Ltd',
    [`${igd}.DeviceInfo.ModelName`]: 'EG8145V5',
    [`${igd}.DeviceInfo.SerialNumber`]: '48575443A66266A4',
    [`${igd}.DeviceInfo.SoftwareVersion`]: 'V5R020C00S115',
    [`${w}.1.SSID`]: 'NETGO HUAWEI', [`${w}.1.Channel`]: '6', [`${w}.1.X_HW_RFBand`]: '2.4GHz', [`${w}.1.Enable`]: '1',
    [`${w}.2.SSID`]: 'convidado', [`${w}.2.Channel`]: '6', [`${w}.2.X_HW_RFBand`]: '2.4GHz',
    // 5 GHz em canal automático ainda não reportado: a banda vem do campo da Huawei.
    [`${w}.5.SSID`]: 'NETGO HUAWEI-5G', [`${w}.5.Channel`]: '0', [`${w}.5.X_HW_RFBand`]: '5GHz', [`${w}.5.Enable`]: '1',
    [`${w}.5.AssociatedDeviceNumberOfEntries`]: '7',
    // .1 é gerência sem PPPoE; a internet está na .2.
    [`${wan}.1.WANIPConnection.1.ExternalIPAddress`]: '10.0.0.5',
    [`${wan}.2.WANPPPConnection.1.ConnectionStatus`]: 'Connected',
    [`${wan}.2.WANPPPConnection.1.Username`]: 'cliente@citmax',
    [`${wan}.2.WANPPPConnection.1.ExternalIPAddress`]: '100.64.1.20',
    [`${igd}.WANDevice.1.X_GponInterafceConfig.RXPower`]: '-18.52',
    [`${igd}.WANDevice.1.X_GponInterafceConfig.TXPower`]: '2.31',
  }));
  const n = normalizarParams(p);
  assert.equal(n.dataModel, 'tr098');
  assert.equal(n.model, 'EG8145V5');
  assert.deepEqual(indicesWifi(p), { idx24: '1', idx5: '5' });
  assert.deepEqual(n.wifi.map((r) => [r.idx, r.banda, r.ssid, r.canal, r.ativo]), [
    ['1', '2.4GHz', 'NETGO HUAWEI', 6, true],
    ['5', '5GHz', 'NETGO HUAWEI-5G', 0, true],
  ]);
  assert.equal(n.wifi[1].clientes, 7);
  assert.equal(n.pppoeUser, 'cliente@citmax');
  assert.equal(n.ipWan, '100.64.1.20');
  assert.equal(n.wanStatus, 'Connected');
  assert.equal(n.sinalRx, -18.52);
  assert.equal(n.sinalTx, 2.31);
  assert.equal(n.temOptica, true);
  assert.deepEqual(caminhosWifi('tr098', '5').senha, [`${w}.5.PreSharedKey.1.KeyPassphrase`, `${w}.5.KeyPassphrase`]);
});

test('TR-181: Wi-Fi pelo canal do rádio, sinal em 0,1 dBm, PPP', () => {
  const p = paramsDeGenie(genie({
    'Device.DeviceInfo.Manufacturer': 'Zyxel',
    'Device.WiFi.SSID.1.SSID': 'casa', 'Device.WiFi.Radio.1.Channel': '11',
    'Device.WiFi.SSID.2.SSID': 'casa-5g', 'Device.WiFi.Radio.2.Channel': '36',
    'Device.PPP.Interface.1.Status': 'Up',
    'Device.PPP.Interface.1.Username': 'z@netgo',
    'Device.PPP.Interface.1.IPCP.LocalIPAddress': '100.64.9.9',
    'Device.Optical.Interface.1.CurrentDownstreamPower': '-2150',
  }));
  const n = normalizarParams(p);
  assert.equal(n.dataModel, 'tr181');
  assert.deepEqual(n.wifi.map((r) => [r.idx, r.banda, r.canal]), [['1', '2.4GHz', 11], ['2', '5GHz', 36]]);
  assert.equal(n.pppoeUser, 'z@netgo');
  assert.equal(n.ipWan, '100.64.9.9');
  assert.equal(n.sinalRx, -21.5);
  assert.equal(caminhosWifi('tr181', '2').senha[0], 'Device.WiFi.AccessPoint.2.Security.KeyPassphrase');
});

test('roteador sem fibra: sem sinal e sem ramo óptico', () => {
  const n = normalizarParams(paramsDeGenie(genie({ 'InternetGatewayDevice.DeviceInfo.ModelName': 'Archer' })));
  assert.equal(n.sinalRx, null);
  assert.equal(n.temOptica, false);
  assert.deepEqual(n.wifi, []);
});

test('normalizarDbm: decimal nunca reescala; inteiro fora de faixa desce por 10', () => {
  assert.equal(normalizarDbm('-23.7'), -23.7);
  assert.equal(normalizarDbm('-2370'), -23.7);
  assert.equal(normalizarDbm('-23700'), -23.7);
  assert.equal(normalizarDbm('250', 10), 2.5);
  assert.equal(normalizarDbm('0'), null);
  assert.equal(normalizarDbm(''), null);
});
