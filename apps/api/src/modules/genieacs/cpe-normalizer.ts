/**
 * Normalização dos parâmetros TR-069 de uma CPE, portada do ACS do Maxxi
 * (maxxi/src/services/acs.js), onde foi calibrada com aparelhos reais da base
 * (Huawei, C-DATA, Intelbras, roteador TR-181).
 *
 * Módulo PURO: recebe o JSON do GenieACS (ou um mapa caminho→valor) e devolve
 * os campos normalizados. Fala os dois dialetos, TR-098 (InternetGatewayDevice.*)
 * e TR-181 (Device.*). Testado em apps/api/test/cpe-normalizer.test.mjs.
 */

export type Params = Record<string, string>;
export type DataModel = 'tr098' | 'tr181';

/** Achata o JSON do GenieACS ({ a: { b: { _value } } }) em [caminho, valor, gravável]. */
export function achatarGenie(raw: any): Array<[string, string, boolean]> {
  const out: Array<[string, string, boolean]> = [];
  const walk = (node: Record<string, unknown>, path: string) => {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('_') || v == null || typeof v !== 'object') continue;
      const p = path ? `${path}.${k}` : k;
      const n = v as any;
      if ('_value' in n) out.push([p, String(n._value ?? ''), Boolean(n._writable)]);
      walk(n, p);
    }
  };
  if (raw && typeof raw === 'object') walk(raw, '');
  return out;
}

/**
 * Online = falou com o ACS dentro de 2 intervalos de inform do próprio roteador (30 min se o intervalo não veio).
 * Uma janela fixa menor que o intervalo (era 10 min para roteadores de 15) marcava roteador bom como offline.
 */
export function estaOnline(p: Params, lastInform: string | null | undefined, agora = Date.now()): boolean {
  if (!lastInform) return false;
  const s = Number(p['InternetGatewayDevice.ManagementServer.PeriodicInformInterval'] ?? p['Device.ManagementServer.PeriodicInformInterval']);
  const janelaMs = (s > 0 ? 2 * s : 1800) * 1000;
  return agora - new Date(lastInform).getTime() < janelaMs;
}

export function paramsDeGenie(raw: any): Params {
  const p: Params = {};
  for (const [k, v] of achatarGenie(raw)) p[k] = v;
  return p;
}

function primeiro(p: Params, lista: string[]): string | null {
  for (const k of lista) if (p[k] != null && p[k] !== '') return p[k];
  return null;
}
function primeiroPorRegex(p: Params, re: RegExp): string | null {
  for (const k of Object.keys(p)) if (re.test(k) && p[k] != null && p[k] !== '') return p[k];
  return null;
}
const num = (v: string | null): number | null => {
  const n = parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : null;
};

// ── Data model ───────────────────────────────────────────────────────────────
/** Decide TR-098 x TR-181 pelos NOMES dos parâmetros. Null se indeterminado. */
export function detectarDataModel(p: Params): DataModel | null {
  let igd = 0, dev = 0;
  for (const n of Object.keys(p || {})) {
    if (n.startsWith('InternetGatewayDevice.')) igd++;
    else if (n.startsWith('Device.')) dev++;
  }
  if (igd && igd >= dev) return 'tr098';
  if (dev) return 'tr181';
  return null;
}

// ── Sinal óptico ─────────────────────────────────────────────────────────────
// O nome varia por fabricante. Tenta os conhecidos e, se nada bater, varre por
// sufixo. Nota: "X_GponInterafceConfig" (com o erro de digitação) é o nome real
// usado pela Huawei.
const RX_CANDIDATOS = [
  'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.RXPower',
  'InternetGatewayDevice.X_INTELBRAS_GponInterfaceConfig.RXPower',
  'InternetGatewayDevice.X_CT-COM_GponInterfaceConfig.RXPower',
  'Device.Optical.Interface.1.CurrentDownstreamPower',
  'Device.Optical.Interface.1.OpticalSignalLevel',
];
const TX_CANDIDATOS = [
  'InternetGatewayDevice.WANDevice.1.X_GponInterafceConfig.TXPower',
  'InternetGatewayDevice.X_INTELBRAS_GponInterfaceConfig.TXPower',
  'InternetGatewayDevice.X_CT-COM_GponInterfaceConfig.TXPower',
  'Device.Optical.Interface.1.CurrentUpstreamPower',
  'Device.Optical.Interface.1.TransmitOpticalLevel',
];
const RX_RE = /(RXPower|RxPower|CurrentDownstreamPower|RxOpticalPower|OpticalSignalLevel)$/i;
const TX_RE = /(TXPower|TxPower|CurrentUpstreamPower|TxOpticalPower|TransmitOpticalLevel)$/i;
// Faixas plausíveis: Rx de ONU online fica entre ~-30 e -8 dBm; Tx entre ~-5 e +7.
// São elas que dizem em qual potência de 10 o valor cru está.
const LIMITE_RX = 40, LIMITE_TX = 10;

/**
 * Potência em dBm. TR-181 reporta em 0,1 ou 0,001 dBm (-2500 = -25,0). Valor
 * COM casa decimal já está em dBm e nunca é reescalado (senão -23.7 viraria -2.37).
 */
export function normalizarDbm(v: unknown, limite = LIMITE_RX): number | null {
  const cru = String(v ?? '').trim();
  let n = parseFloat(cru);
  if (!Number.isFinite(n) || n === 0) return null;
  if (!/[.,]/.test(cru)) {
    let guarda = 0;
    while (Math.abs(n) > limite && guarda++ < 4) n = n / 10;
  }
  return Math.round(n * 100) / 100;
}

/** É ONU (tem ramo óptico) ou roteador atrás de ONU em bridge? */
const OPTICA_RE = /(Gpon|GPON|Optical|RXPower|RxPower|TXPower|TxPower)/;
export function temInterfaceOptica(p: Params): boolean {
  return Object.keys(p || {}).some((n) => OPTICA_RE.test(n));
}

// ── Wi-Fi ────────────────────────────────────────────────────────────────────
const WLAN_RE = /^InternetGatewayDevice\.LANDevice\.1\.WLANConfiguration\.(\d+)\.(SSID|Channel|X_HW_RFBand|OperatingFrequencyBand|Standard)$/;
const TR181_SSID_RE = /^Device\.WiFi\.SSID\.(\d+)\.(SSID)$/;
const TR181_RADIO_RE = /^Device\.WiFi\.Radio\.(\d+)\.(Channel|OperatingFrequencyBand)$/;

/**
 * Índice da rede principal de cada banda, descoberto dos params reais. Índice
 * fixo não funciona: a Huawei da base do Maxxi usa 1 e 2, a EG8145V5 usa 1 e 5.
 * Banda vem do campo explícito do fabricante quando existe (X_HW_RFBand,
 * OperatingFrequencyBand, Standard "a/ac"); senão do canal (> 14 ⇒ 5 GHz).
 * Com várias redes na mesma banda (rede de convidado), a de menor índice é a principal.
 */
export function indicesWifi(p: Params): { idx24: string | null; idx5: string | null } {
  const redes: Record<string, Record<string, string>> = {};
  for (const nome of Object.keys(p || {})) {
    const m = nome.match(WLAN_RE) || nome.match(TR181_SSID_RE) || nome.match(TR181_RADIO_RE);
    if (m) (redes[m[1]] = redes[m[1]] || {})[m[2]] = p[nome];
  }
  const ehCinco = (v: Record<string, string>): boolean => {
    const banda = v.X_HW_RFBand || v.OperatingFrequencyBand;
    if (banda) return banda.startsWith('5');
    const canal = parseInt(v.Channel, 10);
    if (canal > 0) return canal > 14;
    // Canal 0 = automático ainda não reportado. "ax" existe nas duas bandas, então não conta.
    return /a(?!x)/i.test(v.Standard || '') && !/[bg]/i.test(v.Standard || '');
  };
  const comSsid = Object.entries(redes)
    .filter(([, v]) => v.SSID)
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  return {
    idx24: comSsid.find(([, v]) => !ehCinco(v))?.[0] ?? null,
    idx5: comSsid.find(([, v]) => ehCinco(v))?.[0] ?? null,
  };
}

// ponytail: em TR-181 assume Radio.i = SSID.i (igual ao Maxxi); seguir SSID.i.LowerLayers se aparecer CPE que divirja.
export function caminhosWifi(dm: DataModel, idx: string) {
  if (dm === 'tr181') {
    return {
      ssid: `Device.WiFi.SSID.${idx}.SSID`,
      senha: [`Device.WiFi.AccessPoint.${idx}.Security.KeyPassphrase`],
      canal: `Device.WiFi.Radio.${idx}.Channel`,
      canalAuto: `Device.WiFi.Radio.${idx}.AutoChannelEnable`,
      enable: `Device.WiFi.SSID.${idx}.Enable`,
      status: `Device.WiFi.SSID.${idx}.Status`,
      clientes: `Device.WiFi.AccessPoint.${idx}.AssociatedDeviceNumberOfEntries`,
    };
  }
  const b = `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${idx}`;
  return {
    ssid: `${b}.SSID`,
    // Fabricantes divergem onde a senha mora; gravar nos dois é o que o Maxxi faz.
    senha: [`${b}.PreSharedKey.1.KeyPassphrase`, `${b}.KeyPassphrase`],
    canal: `${b}.Channel`,
    canalAuto: `${b}.AutoChannelEnable`,
    enable: `${b}.Enable`,
    status: `${b}.Status`,
    clientes: `${b}.AssociatedDeviceNumberOfEntries`,
  };
}

// ── WAN ──────────────────────────────────────────────────────────────────────
/**
 * Prefixo da conexão PPPoE de internet. A Huawei costuma ter várias
 * WANConnectionDevice (gerência, VoIP, internet), então o caminho fixo .1.1 do
 * Maxxi não basta: prefere a conectada, depois a que tem usuário.
 */
function prefixoPpp(p: Params): string | null {
  const re = /^(InternetGatewayDevice\.WANDevice\.\d+\.WANConnectionDevice\.\d+\.WANPPPConnection\.\d+)\.(ConnectionStatus|Username)$/;
  const insts: Record<string, Record<string, string>> = {};
  for (const k of Object.keys(p)) {
    const m = k.match(re);
    if (m) (insts[m[1]] = insts[m[1]] || {})[m[2]] = p[k];
  }
  const lista = Object.entries(insts).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
  return (lista.find(([, v]) => v.ConnectionStatus === 'Connected') || lista.find(([, v]) => v.Username) || [null])[0];
}

const DEVINFO = (campo: string) => [`InternetGatewayDevice.DeviceInfo.${campo}`, `Device.DeviceInfo.${campo}`];

export interface CpeNormalizada {
  dataModel: DataModel | null;
  manufacturer: string | null;
  model: string | null;
  serial: string | null;
  hardwareVer: string | null;
  firmware: string | null;
  uptimeSeg: number | null;
  wanStatus: string | null;
  ipWan: string | null;
  pppoeUser: string | null;
  wanUptimeSeg: number | null;
  sinalRx: number | null;
  sinalTx: number | null;
  temOptica: boolean;
  informInterval: number | null;
  wifi: Array<{ idx: string; banda: '2.4GHz' | '5GHz'; ssid: string | null; canal: number | null; ativo: boolean; clientes: number | null }>;
}

export function normalizarParams(p: Params): CpeNormalizada {
  p = p || {};
  const dm = detectarDataModel(p);
  const ppp = prefixoPpp(p);
  const pppTr181 = 'Device.PPP.Interface.1';
  const { idx24, idx5 } = indicesWifi(p);

  const wifi: CpeNormalizada['wifi'] = [];
  for (const [idx, banda] of [[idx24, '2.4GHz'], [idx5, '5GHz']] as const) {
    if (idx == null) continue;
    // Cada rede pode estar nos dois dialetos; tenta os caminhos dos dois.
    const c98 = caminhosWifi('tr098', idx), c181 = caminhosWifi('tr181', idx);
    const val = (k: 'ssid' | 'canal' | 'enable' | 'status' | 'clientes') => primeiro(p, [c98[k], c181[k]]);
    const enable = val('enable'), status = val('status');
    wifi.push({
      idx,
      banda,
      ssid: val('ssid'),
      canal: num(val('canal')),
      ativo: enable != null ? enable === '1' || enable === 'true' : status !== 'Disabled',
      clientes: num(val('clientes')),
    });
  }

  return {
    dataModel: dm,
    manufacturer: primeiro(p, DEVINFO('Manufacturer')),
    model: primeiro(p, DEVINFO('ModelName')),
    serial: primeiro(p, DEVINFO('SerialNumber')),
    hardwareVer: primeiro(p, DEVINFO('HardwareVersion')),
    firmware: primeiro(p, DEVINFO('SoftwareVersion')),
    uptimeSeg: num(primeiro(p, DEVINFO('UpTime'))),
    wanStatus: primeiro(p, [`${ppp}.ConnectionStatus`, `${pppTr181}.Status`]),
    ipWan: primeiro(p, [
      `${ppp}.ExternalIPAddress`,
      `${pppTr181}.IPCP.LocalIPAddress`,
      'Device.IP.Interface.2.IPv4Address.1.IPAddress',
      'Device.IP.Interface.1.IPv4Address.1.IPAddress',
    ]),
    pppoeUser: primeiro(p, [`${ppp}.Username`, `${pppTr181}.Username`]) ?? primeiroPorRegex(p, /(WANPPPConnection\.\d+|Device\.PPP\.Interface\.\d+)\.Username$/),
    wanUptimeSeg: num(primeiro(p, [`${ppp}.Uptime`])),
    sinalRx: normalizarDbm(primeiro(p, RX_CANDIDATOS) ?? primeiroPorRegex(p, RX_RE), LIMITE_RX),
    sinalTx: normalizarDbm(primeiro(p, TX_CANDIDATOS) ?? primeiroPorRegex(p, TX_RE), LIMITE_TX),
    temOptica: temInterfaceOptica(p),
    informInterval: num(primeiro(p, [
      'InternetGatewayDevice.ManagementServer.PeriodicInformInterval',
      'Device.ManagementServer.PeriodicInformInterval',
    ])),
    wifi,
  };
}
