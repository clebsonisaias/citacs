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

export interface ResultadoClienteRoteador {
  cliente: ClienteSgp | null;
  metodo: 'login' | 'ip' | null;
  loginConfere: boolean | null;
  motivo?: string;
}

/**
 * Decide a vinculação do roteador ao cliente do SGP.
 * Regra:
 * 1. Se achou por login PPPoE -> vincula com segurança (imune a IP dinâmico/CGNAT).
 * 2. Se achou por IP:
 *    - Se o roteador tem login PPPoE e ele NÃO bate com o login da sessão do SGP,
 *      NÃO vincula (evita atribuir o cliente anterior dono do IP ao novo roteador).
 *    - Se bate ou se o roteador não informou PPPoE -> vincula por IP.
 * 3. Se não achou em nenhum -> cliente nulo com motivo claro.
 */
export function resolverVinculoCliente(
  cpe: { pppoeUsername?: string; ipAddress?: string },
  clientePorLogin: ClienteSgp | null,
  clientePorIp: ClienteSgp | null,
): ResultadoClienteRoteador {
  const loginRoteador = normalizarLogin(cpe.pppoeUsername);
  const ip = (cpe.ipAddress ?? '').trim();

  // 1. Prioridade máxima: login PPPoE do próprio roteador
  if (clientePorLogin) {
    return {
      cliente: clientePorLogin,
      metodo: 'login',
      loginConfere: true,
    };
  }

  // 2. Fallback: sessão Radius pelo IP
  if (clientePorIp) {
    const loginSgp = normalizarLogin(clientePorIp.pppoeLogin);
    if (loginRoteador && loginSgp && loginRoteador !== loginSgp) {
      return {
        cliente: null,
        metodo: 'ip',
        loginConfere: false,
        motivo: `O IP de internet (${ip}) possui sessão de outro assinante no SGP (${clientePorIp.nome} / ${clientePorIp.pppoeLogin}), e o login do roteador (${cpe.pppoeUsername}) não foi localizado no SGP.`,
      };
    }
    return {
      cliente: clientePorIp,
      metodo: 'ip',
      loginConfere: loginRoteador ? true : null,
    };
  }

  if (!loginRoteador && !ip) {
    return {
      cliente: null,
      metodo: null,
      loginConfere: null,
      motivo: 'O roteador ainda não informou login PPPoE nem IP de internet',
    };
  }

  return {
    cliente: null,
    metodo: null,
    loginConfere: null,
    motivo: loginRoteador
      ? `Nenhum assinante encontrado no SGP com o login PPPoE "${cpe.pppoeUsername}"`
      : `Nenhuma sessão no SGP com o IP ${ip}`,
  };
}

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
