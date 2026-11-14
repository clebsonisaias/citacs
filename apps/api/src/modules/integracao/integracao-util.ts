/**
 * Integração de outro sistema (o AtendeHub) com o CITacs — SÓ LEITURA.
 *
 * Funções puras (testadas em test/integracao-util.test.mjs):
 *  - chave por sistema: no ambiente fica só o sha256 (`INTEGRACAO_CHAVES`),
 *    comparado em tempo constante;
 *  - busca do roteador por login PPPoE, serial ou IP, validada;
 *  - resposta com campos FIXOS: nunca senha do Wi-Fi/PPPoE nem parâmetro cru.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { normalizarLogin } from '../sgp/sgp-util.ts';

export interface ChaveIntegracao {
  sistema: string;
  hash: Buffer;
}

/** `INTEGRACAO_CHAVES=atendehub:<sha256 hex>,outro:<sha256 hex>`. Entrada malformada é ignorada. */
export function lerChaves(env: string | undefined): ChaveIntegracao[] {
  return (env ?? '')
    .split(',')
    .map((s) => s.trim())
    .map((s) => /^([a-z0-9_-]{2,32}):([0-9a-f]{64})$/i.exec(s))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ sistema: m[1].toLowerCase(), hash: Buffer.from(m[2].toLowerCase(), 'hex') }));
}

/** Devolve o sistema dono da chave ou null. Sem chaves configuradas, ninguém entra. */
export function sistemaDaChave(authorization: string | undefined, chaves: ChaveIntegracao[]): string | null {
  const m = /^Bearer ([A-Za-z0-9._~+/=-]{24,256})$/.exec(authorization ?? '');
  if (!m || chaves.length === 0) return null;
  const h = createHash('sha256').update(m[1]).digest();
  let achado: string | null = null;
  // Compara com todas, sem sair cedo: o tempo não revela qual chave chegou perto.
  for (const c of chaves) if (timingSafeEqual(h, c.hash) && !achado) achado = c.sistema;
  return achado;
}

/** Limite simples por sistema: N consultas por janela. */
export class LimiteJanela {
  private readonly marcas = new Map<string, number[]>();
  private readonly max: number;
  private readonly janelaMs: number;
  constructor(max: number, janelaMs: number) {
    this.max = max;
    this.janelaMs = janelaMs;
  }
  permitir(chave: string, agora = Date.now()): boolean {
    const vivas = (this.marcas.get(chave) ?? []).filter((t) => agora - t < this.janelaMs);
    if (vivas.length >= this.max) {
      this.marcas.set(chave, vivas);
      return false;
    }
    vivas.push(agora);
    this.marcas.set(chave, vivas);
    return true;
  }
}

export type TipoBusca = 'pppoe' | 'sn' | 'ip';
export interface Busca {
  tipo: TipoBusca;
  valor: string;
}

const FORMATO: Record<TipoBusca, RegExp> = {
  pppoe: /^[A-Za-z0-9._@-]{1,64}$/,
  sn: /^[A-Za-z0-9-]{4,64}$/,
  ip: /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/,
};

/** Exatamente um critério, no formato certo. Senão, devolve o motivo. */
export function lerBusca(q: Partial<Record<TipoBusca, unknown>>): Busca | { erro: string } {
  const dados = (Object.keys(FORMATO) as TipoBusca[])
    .filter((t) => typeof q[t] === 'string' && (q[t] as string).trim() !== '')
    .map((t) => ({ tipo: t, valor: (q[t] as string).trim() }));
  if (dados.length !== 1) return { erro: 'Informe exatamente um critério: pppoe, sn ou ip.' };
  const b = dados[0];
  if (!FORMATO[b.tipo].test(b.valor)) return { erro: `Valor de ${b.tipo} em formato inválido.` };
  return b;
}

// Onde cada fabricante guarda o dado: TR-098 (InternetGatewayDevice) e TR-181 (Device).
const IDX = ['1', '2'];
const caminhosPppoe = [
  ...IDX.flatMap((c) => IDX.map((p) => `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.${c}.WANPPPConnection.${p}.Username`)),
  ...IDX.map((i) => `Device.PPP.Interface.${i}.Username`),
];
const caminhosIp = [
  ...IDX.flatMap((c) =>
    IDX.flatMap((p) => [
      `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.${c}.WANPPPConnection.${p}.ExternalIPAddress`,
      `InternetGatewayDevice.WANDevice.1.WANConnectionDevice.${c}.WANIPConnection.${p}.ExternalIPAddress`,
    ]),
  ),
  ...IDX.map((i) => `Device.IP.Interface.${i}.IPv4Address.1.IPAddress`),
];

/** Consulta do NBI (MongoDB) para os candidatos. O resultado ainda é conferido depois. */
export function consultaNbi(b: Busca): Record<string, unknown> {
  if (b.tipo === 'sn') return { '_deviceId._SerialNumber': b.valor };
  const caminhos = b.tipo === 'pppoe' ? caminhosPppoe : caminhosIp;
  return { $or: caminhos.map((c) => ({ [`${c}._value`]: b.valor })) };
}

/** O roteador normalizado bate MESMO com a busca? (a consulta só traz candidatos). */
export function confere(b: Busca, cpe: { serialNumber?: string; pppoeUsername?: string; ipAddress?: string }, idSerial?: string): boolean {
  if (b.tipo === 'sn') return [cpe.serialNumber, idSerial].some((s) => s?.toLowerCase() === b.valor.toLowerCase());
  // O roteador pode mandar o login com espaço e maiúscula ("Kovausk ").
  if (b.tipo === 'pppoe') return !!cpe.pppoeUsername && normalizarLogin(cpe.pppoeUsername) === normalizarLogin(b.valor);
  return cpe.ipAddress === b.valor;
}

/** Campos que saem para outro sistema. Lista fechada: o que não está aqui não sai. */
export function projetar(
  cpe: {
    id: string;
    serialNumber: string;
    manufacturer: string;
    modelName: string;
    softwareVersion: string;
    online: boolean;
    lastInform: string;
    pppoeUsername?: string;
    ipAddress?: string;
    optical?: { rxDbm: number | null; txDbm: number | null; status: string };
    wifi?: Array<{ band: string; ssid: string; enabled: boolean; channel: number | 'auto'; connectedClientsCount?: number }>;
    wan?: Array<{ type: string; status: string; ipAddress?: string; uptimeSeconds?: number }>;
  },
  diagnostico: { camadaProvavel: string | null; confianca: string | null; resumo: string; achados: Array<{ camada: string; gravidade: string; mensagem: string }> } | null,
) {
  return {
    id: cpe.id,
    fabricante: cpe.manufacturer,
    modelo: cpe.modelName,
    serial: cpe.serialNumber,
    firmware: cpe.softwareVersion,
    online: cpe.online,
    ultimoContato: cpe.lastInform,
    pppoe: cpe.pppoeUsername ?? null,
    sinal: cpe.optical ? { rxDbm: cpe.optical.rxDbm, txDbm: cpe.optical.txDbm, status: cpe.optical.status } : null,
    wan: (cpe.wan ?? []).map((w) => ({ tipo: w.type, status: w.status, ip: w.ipAddress ?? null, uptimeSeg: w.uptimeSeconds ?? null })),
    wifi: (cpe.wifi ?? []).map((w) => ({
      banda: w.band,
      ssid: w.ssid,
      ativo: w.enabled,
      canal: w.channel,
      aparelhos: w.connectedClientsCount ?? null,
    })),
    diagnostico: diagnostico
      ? {
          camadaProvavel: diagnostico.camadaProvavel,
          confianca: diagnostico.confianca,
          resumo: diagnostico.resumo,
          achados: diagnostico.achados.map((a) => ({ camada: a.camada, gravidade: a.gravidade, mensagem: a.mensagem })),
        }
      : null,
  };
}

/** Nome do atendente vindo no cabeçalho: só para a auditoria, curto e sem controle. */
export function nomeAtendente(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const limpo = v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
  return limpo || null;
}
