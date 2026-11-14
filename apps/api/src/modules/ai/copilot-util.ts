import type { CpeDevice } from '@citacs/shared';
import type { ClienteSgp } from '../sgp/sgp-util';

/** O que a IA vê de um roteador. Fica de fora: IP, MAC, endereço completo, SSID e qualquer senha. */
export interface RoteadorParaIa {
  id: string;
  modelo: string;
  online: boolean;
  ultimoInform: string;
  rxDbm: number | null;
  cliente: {
    nome: string;
    login: string;
    plano: string | null;
    conectado: boolean | null;
    bairro: string | null;
    cidade: string | null;
    /** false = o login do roteador não bate com o do SGP; o IP pode ter mudado de dono. */
    loginConfere: boolean | null;
  } | null;
}

export const semAcento = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function paraIa(cpe: CpeDevice, c: ClienteSgp | null): RoteadorParaIa {
  return {
    id: cpe.id,
    modelo: `${cpe.manufacturer ?? ''} ${cpe.modelName ?? ''}`.trim(),
    online: cpe.online,
    ultimoInform: cpe.lastInform,
    rxDbm: cpe.optical?.rxDbm ?? null,
    cliente: c && {
      nome: c.nome,
      login: c.pppoeLogin,
      plano: c.plano,
      conectado: c.online,
      bairro: c.bairro,
      cidade: c.cidade,
      loginConfere: cpe.pppoeUsername && c.pppoeLogin ? semAcento(cpe.pppoeUsername) === semAcento(c.pppoeLogin) : null,
    },
  };
}

/** Filtra por nome do cliente, login ou serial. Todas as palavras precisam aparecer, sem ligar para acento. */
export function filtrar(lista: RoteadorParaIa[], texto?: string): RoteadorParaIa[] {
  const palavras = semAcento(texto).split(/\s+/).filter(Boolean);
  if (!palavras.length) return lista;
  return lista.filter((r) => {
    const alvo = semAcento([r.id, r.cliente?.nome, r.cliente?.login].join(' '));
    return palavras.every((p) => alvo.includes(p));
  });
}

/** Erro da OpenAI em frase que o técnico entende. */
export function motivoFalhaIa(mensagem: string): string {
  if (/credit|quota|billing/i.test(mensagem)) return 'a conta da OpenAI está sem crédito';
  if (/401|api key|invalid_api_key/i.test(mensagem)) return 'a chave da OpenAI foi recusada';
  if (/429|rate limit/i.test(mensagem)) return 'a OpenAI limitou as chamadas, tente de novo em um minuto';
  return 'a IA não respondeu';
}
