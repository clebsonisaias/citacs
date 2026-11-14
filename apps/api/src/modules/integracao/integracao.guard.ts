import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { LimiteJanela, lerChaves, sistemaDaChave } from './integracao-util';
import { ChavesIntegracaoService } from './chaves.service';

/**
 * Chave de integração (Bearer) — separada da sessão de pessoa. Vale a chave
 * gerada no painel (Integrações) ou a do ambiente (INTEGRACAO_CHAVES). Sem
 * nenhuma das duas, ninguém entra (falha fechada).
 */
@Injectable()
export class IntegracaoGuard implements CanActivate {
  private readonly chavesEnv = lerChaves(process.env.INTEGRACAO_CHAVES);
  // 60 consultas por minuto por sistema: sobra para o painel, freia abuso.
  private readonly limite = new LimiteJanela(Number(process.env.INTEGRACAO_LIMITE_MIN) || 60, 60_000);

  constructor(private readonly chaves: ChavesIntegracaoService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth: string | undefined = req.headers.authorization;
    let sistema = sistemaDaChave(auth, this.chavesEnv);
    const m = /^Bearer (cit_[A-Za-z0-9_-]{43})$/.exec(auth ?? '');
    if (!sistema && m) sistema = await this.chaves.validar(m[1]);
    if (!sistema) throw new UnauthorizedException('Chave de integração inválida');
    if (!this.limite.permitir(sistema)) throw new HttpException('Muitas consultas; tente em instantes', HttpStatus.TOO_MANY_REQUESTS);
    req.sistemaIntegracao = sistema;
    return true;
  }
}
