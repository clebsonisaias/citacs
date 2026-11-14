import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

export type Perfil = 'leitura' | 'escrita' | 'admin';
export const PERFIS: Perfil[] = ['leitura', 'escrita', 'admin'];
export const COOKIE = 'citacs_sessao';
export const SESSAO_HORAS = 12;
export const SENHA_MINIMA = 12;

const scryptAsync = (senha: string, salt: Buffer, tamanho: number) =>
  new Promise<Buffer>((ok, erro) => scrypt(senha, salt, tamanho, (e, h) => (e ? erro(e) : ok(h))));

/** Formato: `scrypt$<salt base64>$<hash base64>`. */
export async function gerarHash(senha: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(senha, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const [alg, salt, hash] = guardado.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const esperado = Buffer.from(hash, 'base64');
  if (esperado.length !== 64) return false;
  return timingSafeEqual(await scryptAsync(senha, Buffer.from(salt, 'base64'), 64), esperado);
}

/** Token da sessão vai só no cookie; o banco guarda o sha256 dele. */
export const novoToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const senhaTemporaria = () => randomBytes(12).toString('base64url');

export function lerCookie(header: string | undefined, nome: string): string | undefined {
  for (const parte of (header ?? '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nome) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return undefined;
}

/** admin faz tudo; escrita altera roteador; leitura só olha. */
export function podeEscrever(perfil: Perfil) {
  return perfil === 'escrita' || perfil === 'admin';
}

/**
 * Trava um login depois de `max` senhas erradas dentro da janela.
 * ponytail: memória do processo (a API roda em 1 instância); vai para o Redis se escalar.
 */
export class Tentativas {
  private falhas = new Map<string, { n: number; desde: number }>();
  max: number;
  janelaMs: number;

  constructor(max = 5, janelaMs = 15 * 60_000) {
    this.max = max;
    this.janelaMs = janelaMs;
  }

  bloqueado(chave: string, agora = Date.now()): boolean {
    const f = this.falhas.get(chave);
    if (!f) return false;
    if (agora - f.desde > this.janelaMs) {
      this.falhas.delete(chave);
      return false;
    }
    return f.n >= this.max;
  }

  falhou(chave: string, agora = Date.now()) {
    if (this.falhas.size > 10_000) this.falhas.clear(); // ninguém enche a memória com logins inventados
    const f = this.falhas.get(chave);
    if (!f || agora - f.desde > this.janelaMs) this.falhas.set(chave, { n: 1, desde: agora });
    else f.n++;
  }

  limpar(chave: string) {
    this.falhas.delete(chave);
  }
}
