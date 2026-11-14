/** Cliente do SGP como o CITacs mostra. Só os campos escolhidos: a senha PPPoE nunca entra. */
export interface ClienteSgp {
  nome: string;
  pppoeLogin: string;
  plano: string | null;
  planoMbps: number | null;
  online: boolean | null;
  servicoId: number | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
}

export const normalizarLogin = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** "Fibra - ⚡ Ultra 500.exp.260818" → 500; "1 Giga" → 1000. Null se não achar velocidade. */
export function planoMbps(plano: string | null | undefined): number | null {
  if (!plano) return null;
  const giga = /(\d+(?:[.,]\d+)?)\s*(?:g\b|gb\b|giga)/i.exec(plano);
  if (giga) return Math.round(parseFloat(giga[1].replace(',', '.')) * 1000);
  for (const m of plano.matchAll(/\d+/g)) {
    const n = parseInt(m[0], 10);
    if (n >= 10 && n <= 10_000) return n;
  }
  return null;
}

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Lê a resposta de /ws/radius/radacct/list/all/ ({ paggination, result: [...] }).
 * Prefere a sessão online. Lança erro se a resposta não tiver lista (token/app recusados etc.).
 */
export function extrairCliente(resposta: unknown): ClienteSgp | null {
  const r = resposta as Record<string, unknown> | unknown[] | null;
  const linhas = Array.isArray(r) ? r : Array.isArray(r?.['result']) ? (r['result'] as unknown[]) : null;
  if (!linhas) {
    const msg = r && typeof r === 'object' ? texto(r['msg']) ?? texto(r['message']) ?? texto(r['detail']) : null;
    throw new Error(`Resposta inesperada do SGP${msg ? `: ${msg}` : ''}`);
  }
  const lista = linhas.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object');
  const s = lista.find((x) => x['online'] === true) ?? lista[0];
  if (!s) return null;
  const plano = texto(s['plano']);
  return {
    nome: texto(s['nome']) ?? '(sem nome)',
    pppoeLogin: texto(s['pppoe_login']) ?? '',
    plano,
    planoMbps: planoMbps(plano),
    online: typeof s['online'] === 'boolean' ? (s['online'] as boolean) : null,
    servicoId: typeof s['servico_id'] === 'number' ? (s['servico_id'] as number) : null,
    endereco: texto(s['endereco']),
    bairro: texto(s['endereco_bairro']),
    cidade: texto(s['endereco_cidade']),
  };
}
