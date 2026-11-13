/**
 * Diagnóstico read-only de uma CPE a partir dos parâmetros TR-069.
 *
 * Junta duas fontes:
 *  - maxxi/src/services/acs-diagnostico.js: lê a casa (aparelhos, sinal de cada
 *    estação Wi-Fi, ping, enlace WAN) a partir do que o CPE já publica.
 *  - iAmCorey/wifi-optimizer (MIT): classifica a CAMADA provável com evidência,
 *    diz o próximo teste e o que evitar; só propõe mudança com evidência, uma
 *    por vez, sempre reversível.
 *
 * Puro: não chama rede nem banco. Testado em apps/api/test/diagnostico.test.mjs.
 */
import { normalizarParams } from './cpe-normalizer.ts';
import type { Params } from './cpe-normalizer.ts';

export type Camada = 'fibra' | 'wan' | 'wifi-cobertura' | 'wifi-radio' | 'aparelhos';
export type Gravidade = 'alta' | 'media' | 'baixa';

export interface Achado {
  camada: Camada;
  gravidade: Gravidade;
  mensagem: string;
  evidencia: string[];
  proximoTeste: string;
  evitar?: string;
}

export interface Proposta {
  id: string;
  titulo: string;
  motivo: string;
  tradeoff: string;
  // Formato aceito por POST /cpes/:id/wifi.
  parametros: { band: '2.4GHz' | '5GHz'; channel: number | 'auto' };
  reversao: { band: '2.4GHz' | '5GHz'; channel: number | 'auto' };
}

export interface Diagnostico {
  camadaProvavel: Camada | null;
  confianca: Gravidade | null;
  achados: Achado[];
  propostas: Proposta[];
  resumo: string;
}

export interface OpcoesDiagnostico {
  online: boolean;
  ultimoInform?: string;
  /** IP do servidor do POP: só ping até ele julga a última milha. */
  alvoReferencia?: string;
  planoMbps?: number;
}

// ── Leitura da casa (port do Maxxi) ──────────────────────────────────────────
export function classificarRssi(rssi: number | null): 'otimo' | 'bom' | 'fraco' | 'ruim' | 'desconhecido' {
  if (rssi == null || !Number.isFinite(rssi)) return 'desconhecido';
  if (rssi >= -50) return 'otimo';
  if (rssi >= -60) return 'bom';
  if (rssi >= -70) return 'fraco';
  return 'ruim';
}

/** RSSI vem em formatos diferentes por firmware: "-46dBm", "-78 dBm", "-55". */
function parseRssi(v: unknown): number | null {
  const m = String(v ?? '').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
const normMac = (m: unknown) => String(m || '').toUpperCase().replace(/-/g, ':');

function agrupar(p: Params, re: RegExp): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [nome, valor] of Object.entries(p)) {
    const m = nome.match(re);
    if (m) (out[m[1]] = out[m[1]] || {})[m[2]] = valor;
  }
  return out;
}

export function extrairHosts(p: Params) {
  return Object.entries(agrupar(p, /(?:^|\.)Hosts\.Host\.(\d+)\.(\w+)$/))
    .map(([idx, h]) => ({
      idx: Number(idx),
      nome: h.HostName || null,
      mac: normMac(h.MACAddress),
      ativo: h.Active === '1' || h.Active === 'true',
    }))
    .filter((h) => h.nome || h.mac)
    .sort((a, b) => a.idx - b.idx);
}

export function extrairEstacoesWifi(p: Params, hosts: ReturnType<typeof extrairHosts>) {
  // TR-098: WLANConfiguration.{w}.AssociatedDevice.{i}.AssociatedDeviceXxx
  // TR-181: WiFi.AccessPoint.{a}.AssociatedDevice.{i}.Xxx
  const porChave: Record<string, Record<string, string>> = {};
  for (const [nome, valor] of Object.entries(p)) {
    const m = nome.match(/WLANConfiguration\.(\d+)\.AssociatedDevice\.(\d+)\.AssociatedDevice(\w+)$/)
      || nome.match(/WiFi\.AccessPoint\.(\d+)\.AssociatedDevice\.(\d+)\.(\w+)$/);
    if (m) (porChave[`${m[1]}/${m[2]}`] = porChave[`${m[1]}/${m[2]}`] || {})[m[3]] = valor;
  }
  const porMac = new Map(hosts.filter((h) => h.mac).map((h) => [h.mac, h]));
  return Object.values(porChave)
    .map((d) => {
      const mac = normMac(d.MACAddress);
      const rssi = parseRssi(d.Rssi ?? d.SignalStrength ?? d.RSSI);
      // Sem o HostName o atendente veria só um MAC, que não diz nada ao cliente.
      return { mac, nome: porMac.get(mac)?.nome || null, rssi, qualidade: classificarRssi(rssi) };
    })
    .filter((w) => w.mac);
}

function sufixo(p: Params, s: string): string | null {
  for (const [n, v] of Object.entries(p)) if (n.endsWith(s)) return v;
  return null;
}

export function extrairPing(p: Params, alvoReferencia?: string) {
  const g = (s: string) => sufixo(p, `IPPingDiagnostics.${s}`);
  const estado = g('DiagnosticsState'), alvo = g('Host');
  if (!estado || estado === 'None' || !alvo) return null;
  const media = parseInt(g('AverageResponseTime') ?? '', 10);
  const ok = parseInt(g('SuccessCount') ?? '', 10) || 0;
  const falhas = parseInt(g('FailureCount') ?? '', 10) || 0;
  return {
    alvo,
    // Ping para a internet mede distância, não qualidade do link: só o alvo do POP julga a última milha.
    referencia: !!alvoReferencia && alvo === alvoReferencia,
    mediaMs: Number.isFinite(media) ? media : null,
    perda: falhas,
    enviados: ok + falhas,
  };
}

function extrairEnlaceWan(p: Params) {
  const mbps = (v: string | null) => { const n = parseInt(v ?? '', 10); return n > 0 ? Math.round(n / 1e6) : null; };
  const porta = parseInt(sufixo(p, 'WANEthernetInterfaceConfig.1.MaxBitRate') ?? sufixo(p, 'Ethernet.Interface.1.MaxBitRate') ?? '', 10);
  return {
    // Taxa NEGOCIADA, não capacidade: porta gigabit negocia 100 com cabo ruim.
    negociadaMbps: mbps(sufixo(p, 'WANCommonInterfaceConfig.Layer1DownstreamMaxBitRate')),
    portaMbps: porta > 0 ? porta : null,
  };
}

// ── Regras (tabela do wifi-optimizer aplicada ao que o ACS enxerga) ──────────
const PESO: Record<Gravidade, number> = { alta: 3, media: 2, baixa: 1 };
// Empate de gravidade: a camada mais "de baixo" explica as de cima (fibra ruim derruba tudo).
const ORDEM: Camada[] = ['fibra', 'wan', 'wifi-cobertura', 'wifi-radio', 'aparelhos'];
const ehDfs = (c: number) => c >= 52 && c <= 144;

export function diagnosticar(p: Params, o: OpcoesDiagnostico): Diagnostico {
  const n = normalizarParams(p);
  const hosts = extrairHosts(p);
  const estacoes = extrairEstacoesWifi(p, hosts);
  const ping = extrairPing(p, o.alvoReferencia);
  const enlace = extrairEnlaceWan(p);
  const achados: Achado[] = [];
  const propostas: Proposta[] = [];

  if (!o.online) {
    achados.push({
      camada: 'wan', gravidade: 'alta',
      mensagem: `CPE sem contato com o ACS${o.ultimoInform ? ` desde ${o.ultimoInform}` : ''}. Os dados abaixo podem estar desatualizados.`,
      evidencia: ['sem Inform recente'],
      proximoTeste: 'Ver na OLT se a ONU está online e no BRAS se o PPPoE está ativo; confirmar energia no cliente.',
      evitar: 'Enviar comandos para a CPE: ela não vai receber até voltar.',
    });
  }

  const rx = n.sinalRx;
  if (rx != null && (rx < -24.5 || rx > -8)) {
    const critico = rx < -27;
    achados.push({
      camada: 'fibra', gravidade: critico ? 'alta' : 'media',
      mensagem: rx > -8
        ? `Sinal óptico alto demais (${rx} dBm): receptor saturado, possível falta de splitter/atenuador.`
        : `Sinal óptico ${critico ? 'crítico' : 'no limite'} (${rx} dBm).`,
      evidencia: [`Rx ${rx} dBm${n.sinalTx != null ? `, Tx ${n.sinalTx} dBm` : ''}`],
      proximoTeste: 'Comparar com o sinal da ONU vista pela OLT e com vizinhos da mesma CTO; limpar conectores.',
      evitar: 'Mexer em Wi-Fi: com fibra ruim, a perda aparece em todos os aparelhos.',
    });
  }

  if (n.wanStatus && !/^(Connected|Up)$/.test(n.wanStatus)) {
    achados.push({
      camada: 'wan', gravidade: 'alta',
      mensagem: `Conexão de internet da CPE está "${n.wanStatus}".`,
      evidencia: [`status WAN ${n.wanStatus}`],
      proximoTeste: 'Ver autenticação PPPoE no BRAS (usuário, senha, VLAN) e o log de quedas.',
    });
  }

  if (ping && ping.perda > 0) {
    achados.push({
      camada: 'wan', gravidade: ping.referencia ? 'alta' : 'media',
      mensagem: `Perda de ${ping.perda} de ${ping.enviados} pacotes no ping da CPE até ${ping.referencia ? 'o POP' : ping.alvo}.`,
      evidencia: [`ping ${ping.alvo}: ${ping.perda}/${ping.enviados} perdidos, média ${ping.mediaMs ?? '?'} ms`],
      proximoTeste: ping.referencia
        ? 'Repetir com 50–100 pacotes e comparar com outra CPE da mesma PON.'
        : 'Repetir o ping até o servidor do POP: perda para a internet não prova defeito na última milha.',
      evitar: 'Trocar canal de Wi-Fi: o ping sai da própria CPE, o Wi-Fi não participa.',
    });
  }

  if (o.planoMbps && enlace.negociadaMbps && enlace.negociadaMbps < o.planoMbps) {
    const cabo = enlace.portaMbps != null && enlace.portaMbps > enlace.negociadaMbps;
    achados.push({
      camada: 'wan', gravidade: 'alta',
      mensagem: cabo
        ? `Porta WAN de ${enlace.portaMbps} Mbps negociando ${enlace.negociadaMbps} Mbps, abaixo do plano de ${o.planoMbps}: provável cabo ou conector.`
        : `Enlace WAN em ${enlace.negociadaMbps} Mbps, abaixo do plano de ${o.planoMbps} Mbps.`,
      evidencia: [`negociada ${enlace.negociadaMbps} Mbps`, `porta ${enlace.portaMbps ?? 'desconhecida'}`],
      proximoTeste: cabo ? 'Trocar o cabo/refazer o conector antes de trocar o equipamento.' : 'Confirmar a capacidade física da porta do equipamento.',
    });
  }

  const fracos = estacoes.filter((e) => e.qualidade === 'fraco' || e.qualidade === 'ruim');
  if (fracos.length) {
    const linkLimpo = !!ping && ping.perda === 0;
    achados.push({
      camada: 'wifi-cobertura',
      gravidade: fracos.some((e) => e.qualidade === 'ruim') ? 'alta' : 'media',
      mensagem: `${fracos.length} de ${estacoes.length} aparelho(s) no Wi-Fi com sinal fraco: é distância/obstáculo, não o link.`,
      evidencia: [
        ...fracos.map((e) => `${e.nome || 'aparelho sem nome'}: ${e.rssi} dBm`),
        ...(linkLimpo ? ['contra a hipótese de link: ping da CPE sem perda'] : []),
      ],
      proximoTeste: 'Medir o mesmo aparelho perto da ONT: se melhora, é cobertura (reposicionar a ONT, repetidor ou mesh).',
      evitar: 'Trocar canal ou culpar o link: canal não resolve distância.',
    });
  }

  const ativos = hosts.filter((h) => h.ativo).length;
  if (ativos >= 15) {
    achados.push({
      camada: 'aparelhos', gravidade: 'baixa',
      mensagem: `${ativos} aparelhos ativos ao mesmo tempo: pode explicar lentidão sem defeito na rede.`,
      evidencia: [`${ativos} hosts ativos`],
      proximoTeste: 'Medir a latência com e sem carga: se só sobe sob uso, é saturação.',
      evitar: 'Ligar QoS com taxas chutadas.',
    });
  }

  // 5 GHz em canal DFS: radar obriga o rádio a parar (≥ 60 s) e os aparelhos caem para 2.4.
  // Só vira PROPOSTA de teste, com reversão, nunca mudança automática.
  const w5 = n.wifi.find((w) => w.banda === '5GHz');
  if (w5?.ativo && w5.canal && ehDfs(w5.canal)) {
    achados.push({
      camada: 'wifi-radio', gravidade: 'baixa',
      mensagem: `5 GHz no canal ${w5.canal}, faixa DFS (radar): sujeito a paradas de 1 min ou mais.`,
      evidencia: [`canal 5 GHz ${w5.canal}`],
      proximoTeste: 'Se houver queixa de queda no 5 GHz, testar um canal sem DFS e comparar por 20–30 min.',
    });
    propostas.push({
      id: 'teste-5g-sem-dfs',
      titulo: 'Testar 5 GHz em canal sem DFS (36) [reversível]',
      motivo: `Canal atual ${w5.canal} é DFS; 36–48 não exigem detecção de radar em nenhuma região.`,
      tradeoff: 'Se os vizinhos estiverem em 36–48, pode haver mais disputa de canal.',
      parametros: { band: '5GHz', channel: 36 },
      reversao: { band: '5GHz', channel: w5.canal },
    });
  }

  achados.sort((a, b) => PESO[b.gravidade] - PESO[a.gravidade] || ORDEM.indexOf(a.camada) - ORDEM.indexOf(b.camada));
  const principal = achados[0] ?? null;

  const partes: string[] = [];
  if (hosts.length) partes.push(`${hosts.length} aparelhos conhecidos, ${ativos} ativos, ${estacoes.length} no Wi-Fi.`);
  partes.push(principal
    ? `Camada provável: ${principal.camada} (confiança ${principal.gravidade}). Próximo teste: ${principal.proximoTeste}`
    : 'Nenhuma anomalia nos dados que o ACS enxerga.');
  partes.push('Nenhuma configuração foi alterada.');

  return {
    camadaProvavel: principal?.camada ?? null,
    confianca: principal?.gravidade ?? null,
    achados,
    propostas,
    resumo: partes.join(' '),
  };
}
