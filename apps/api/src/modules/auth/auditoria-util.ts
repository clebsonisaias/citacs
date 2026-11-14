/**
 * Freio de escrita: limita quantas alterações em roteadores passam por janela.
 * É o que impede um "resetar todos" mesmo que alguém entre com uma conta válida.
 */
export const FREIO = {
  janelaMin: 10,
  globalMax: 20, // todas as pessoas juntas, por janela
  usuarioMax: 10, // cada pessoa, por janela
  roteadorHoraMax: 3, // o mesmo roteador, por hora
};

export interface Contagem {
  global: number;
  usuario: number;
  roteadorHora: number;
}

/** Devolve o motivo do bloqueio, ou null se pode seguir. */
export function decidirFreio(c: Contagem): string | null {
  if (c.roteadorHora >= FREIO.roteadorHoraMax) {
    return `Freio: este roteador já recebeu ${c.roteadorHora} alterações na última hora. Aguarde antes de mexer de novo.`;
  }
  if (c.usuario >= FREIO.usuarioMax) {
    return `Freio: você fez ${c.usuario} alterações em ${FREIO.janelaMin} minutos. Aguarde alguns minutos.`;
  }
  if (c.global >= FREIO.globalMax) {
    return `Freio: a equipe fez ${c.global} alterações em ${FREIO.janelaMin} minutos, acima do normal. Novas alterações estão suspensas por alguns minutos.`;
  }
  return null;
}

const SEGREDO = /senha|password|pass|secret|token|key/i;

/** Copia o objeto trocando qualquer campo de senha por "***" (nunca vai senha para o registro). */
export function semSegredos(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(semSegredos);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>).map(([k, v]) => [k, SEGREDO.test(k) ? (v ? '***' : v) : semSegredos(v)]),
    );
  }
  return valor;
}

/**
 * IP de quem fez a ação. O Traefik ACRESCENTA o IP real no fim do X-Forwarded-For;
 * o começo da lista pode ter sido inventado pelo cliente, então vale o último.
 */
export function ipReal(xff: string | string[] | undefined, remoto?: string): string | null {
  const lista = (Array.isArray(xff) ? xff.join(',') : xff ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return lista.at(-1) ?? remoto ?? null;
}
