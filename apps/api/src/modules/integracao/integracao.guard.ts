import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { LimiteJanela, lerChaves, sistemaDaChave } from './integracao-util';

/**
 * Chave de integração (Bearer) — separada da sessão de pessoa. Sem
 * INTEGRACAO_CHAVES no ambiente, ninguém entra (falha fechada).
 */
@Injectable()
export class IntegracaoGuard implements CanActivate {
  private readonly chaves = lerChaves(process.env.INTEGRACAO_CHAVES);
  // 60 consultas por minuto por sistema: sobra para o painel, freia abuso.
  private readonly limite = new LimiteJanela(Number(process.env.INTEGRACAO_LIMITE_MIN) || 60, 60_000);

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const sistema = sistemaDaChave(req.headers.authorization, this.chaves);
    if (!sistema) throw new UnauthorizedException('Chave de integração inválida');
    if (!this.limite.permitir(sistema)) throw new HttpException('Muitas consultas; tente em instantes', HttpStatus.TOO_MANY_REQUESTS);
    req.sistemaIntegracao = sistema;
    return true;
  }
}
