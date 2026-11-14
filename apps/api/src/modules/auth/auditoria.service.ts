import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, Logger, NestInterceptor, OnModuleDestroy, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Pool } from 'pg';
import { Observable, tap } from 'rxjs';
import { Contagem, decidirFreio, FREIO, ipReal, semSegredos } from './auditoria-util';

export type Resultado = 'ok' | 'erro' | 'bloqueado';
interface Quem {
  id?: number;
  login: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS auditoria (
  id bigserial PRIMARY KEY,
  quando timestamptz NOT NULL DEFAULT now(),
  usuario_id int,
  login text NOT NULL,
  ip text,
  acao text NOT NULL,
  alvo text,
  resultado text NOT NULL,
  detalhe jsonb,
  conta_no_freio boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS auditoria_quando ON auditoria (quando DESC);`;

/** Marca a rota para ser registrada. `freio: true` também passa pelo freio de escrita. */
export const Auditar = (acao: string, opcoes: { freio?: boolean } = {}) => SetMetadata('auditar', { acao, freio: !!opcoes.freio });

@Injectable()
export class AuditoriaService implements OnModuleDestroy {
  private readonly logger = new Logger(AuditoriaService.name);
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  private pronto?: Promise<void>;

  private db() {
    return (this.pronto ??= this.pool.query(SCHEMA).then(
      () => undefined,
      (e) => {
        this.pronto = undefined;
        throw e;
      },
    ));
  }

  /** Grava sem nunca derrubar a requisição: se o banco falhar, fica no log da API. */
  async registrar(quem: Quem, acao: string, alvo: string | null, resultado: Resultado, detalhe: unknown, ip: string | null, contaNoFreio = false) {
    try {
      await this.db();
      await this.pool.query(
        `INSERT INTO auditoria (usuario_id, login, ip, acao, alvo, resultado, detalhe, conta_no_freio) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [quem.id ?? null, quem.login, ip, acao, alvo, resultado, JSON.stringify(semSegredos(detalhe) ?? null), contaNoFreio],
      );
    } catch (e) {
      this.logger.error(`Falha ao registrar ${acao} de ${quem.login}: ${(e as Error).message}`);
    }
  }

  /** Quantas alterações (que passaram pelo freio) houve nas janelas do freio. */
  async contagem(usuarioId: number, alvo: string | null): Promise<Contagem> {
    await this.db();
    const { rows } = await this.pool.query(
      `SELECT
         count(*) FILTER (WHERE quando > now() - make_interval(mins => $3)) AS global,
         count(*) FILTER (WHERE quando > now() - make_interval(mins => $3) AND usuario_id = $1) AS usuario,
         count(*) FILTER (WHERE alvo = $2) AS "roteadorHora"
       FROM auditoria
       WHERE conta_no_freio AND resultado <> 'bloqueado' AND quando > now() - interval '1 hour'`,
      [usuarioId, alvo, FREIO.janelaMin],
    );
    return { global: +rows[0].global, usuario: +rows[0].usuario, roteadorHora: +rows[0].roteadorHora };
  }

  async listar(limite = 300) {
    await this.db();
    const { rows } = await this.pool.query(
      `SELECT id, quando, login, ip, acao, alvo, resultado, detalhe FROM auditoria ORDER BY quando DESC LIMIT $1`,
      [Math.min(Math.max(limite, 1), 1000)],
    );
    return rows;
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}

/** Aplica o freio e registra as rotas marcadas com @Auditar(). Roda depois do guard (já sabe quem é). */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(
    private readonly auditoria: AuditoriaService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const meta = this.reflector.get<{ acao: string; freio: boolean }>('auditar', ctx.getHandler());
    if (!meta) return next.handle();

    const req = ctx.switchToHttp().getRequest();
    const quem: Quem = req.usuario;
    const alvo: string | null = req.params?.id ?? null;
    const ip = ipReal(req.headers['x-forwarded-for'], req.socket?.remoteAddress);
    const detalhe = { corpo: req.body && Object.keys(req.body).length ? req.body : undefined };

    if (meta.freio) {
      const motivo = decidirFreio(await this.auditoria.contagem(quem.id, alvo));
      if (motivo) {
        await this.auditoria.registrar(quem, meta.acao, alvo, 'bloqueado', { ...detalhe, motivo }, ip, true);
        throw new HttpException(motivo, HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    return next.handle().pipe(
      tap({
        // Só o "antes/depois" da resposta (Wi-Fi); nunca a resposta inteira, que pode trazer senha temporária.
        next: (r: any) =>
          void this.auditoria.registrar(quem, meta.acao, alvo, 'ok', { ...detalhe, antes: r?.antes, depois: r?.depois }, ip, meta.freio),
        error: (e: Error) => void this.auditoria.registrar(quem, meta.acao, alvo, 'erro', { ...detalhe, erro: e.message }, ip, meta.freio),
      }),
    );
  }
}
