import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Pool } from 'pg';

/**
 * Chaves de integração criadas pelo painel (Integrações). No banco fica só o
 * sha256: a chave aparece uma vez, na criação. Revogada, para de valer na hora.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS integracao_chaves (
  id serial PRIMARY KEY,
  sistema text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  prefixo text NOT NULL,
  hash text UNIQUE NOT NULL,
  criado_por text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  ultimo_uso timestamptz,
  revogada_em timestamptz
);`;

export interface ChaveListada {
  id: number;
  sistema: string;
  descricao: string;
  prefixo: string;
  criadoPor: string;
  criadoEm: string;
  ultimoUso: string | null;
  revogadaEm: string | null;
}

export const SISTEMA_VALIDO = /^[a-z0-9_-]{2,32}$/;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class ChavesIntegracaoService implements OnModuleDestroy {
  private readonly logger = new Logger(ChavesIntegracaoService.name);
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  private pronto?: Promise<void>;
  // Evita um UPDATE de "último uso" a cada consulta: no máximo um por minuto por chave.
  private readonly usoMarcado = new Map<number, number>();

  private db() {
    return (this.pronto ??= this.pool.query(SCHEMA).then(
      () => undefined,
      (e) => {
        this.pronto = undefined;
        throw e;
      },
    ));
  }

  async criar(sistemaBruto: string, descricao: string, criadoPor: string): Promise<{ id: number; sistema: string; chave: string }> {
    const sistema = sistemaBruto.trim().toLowerCase();
    if (!SISTEMA_VALIDO.test(sistema)) throw new BadRequestException('Nome do sistema: 2 a 32 letras minúsculas, números, - ou _');
    await this.db();
    const chave = `cit_${randomBytes(32).toString('base64url')}`;
    const { rows } = await this.pool.query(
      `INSERT INTO integracao_chaves (sistema, descricao, prefixo, hash, criado_por) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [sistema, descricao.trim().slice(0, 120), chave.slice(0, 10), sha(chave), criadoPor],
    );
    this.logger.log(`Chave de integração criada para ${sistema} por ${criadoPor}`);
    return { id: rows[0].id, sistema, chave };
  }

  async listar(): Promise<ChaveListada[]> {
    await this.db();
    const { rows } = await this.pool.query(
      `SELECT id, sistema, descricao, prefixo, criado_por AS "criadoPor", criado_em AS "criadoEm",
              ultimo_uso AS "ultimoUso", revogada_em AS "revogadaEm"
         FROM integracao_chaves ORDER BY revogada_em IS NOT NULL, criado_em DESC`,
    );
    return rows;
  }

  async revogar(id: number): Promise<void> {
    await this.db();
    const { rowCount } = await this.pool.query(`UPDATE integracao_chaves SET revogada_em = now() WHERE id = $1 AND revogada_em IS NULL`, [id]);
    if (!rowCount) throw new NotFoundException('Chave não encontrada ou já revogada');
  }

  /** Sistema dono da chave ativa, ou null. Banco fora do ar = ninguém entra por aqui. */
  async validar(chave: string): Promise<string | null> {
    try {
      await this.db();
      const { rows } = await this.pool.query(`SELECT id, sistema FROM integracao_chaves WHERE hash = $1 AND revogada_em IS NULL`, [sha(chave)]);
      const r = rows[0];
      if (!r) return null;
      const agora = Date.now();
      if (agora - (this.usoMarcado.get(r.id) ?? 0) > 60_000) {
        this.usoMarcado.set(r.id, agora);
        void this.pool.query(`UPDATE integracao_chaves SET ultimo_uso = now() WHERE id = $1`, [r.id]).catch(() => undefined);
      }
      return r.sistema;
    } catch (e) {
      this.logger.error(`Falha ao validar chave de integração: ${(e as Error).message}`);
      return null;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
