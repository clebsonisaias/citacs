import { createHash, timingSafeEqual } from 'node:crypto';

/** Compara em tempo constante (hash dos dois lados, então o tamanho não vaza). */
export function segredoConfere(recebido: unknown, esperado: string | undefined): boolean {
  if (!esperado || esperado.length < 24 || typeof recebido !== 'string' || !recebido) return false;
  const a = createHash('sha256').update(recebido).digest();
  const b = createHash('sha256').update(esperado).digest();
  return timingSafeEqual(a, b);
}
