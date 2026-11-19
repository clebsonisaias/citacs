import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, mixin, Type } from '@nestjs/common';
import { segredoConfere } from './segredo-util';

/**
 * Rota chamada por outro sistema (GenieACS, WAHA), fora da sessão de pessoa.
 * Exige o segredo da variável `envVar` no cabeçalho `X-Citacs-Token` (ou no
 * query `token`, para quem não consegue mandar cabeçalho). Sem a variável
 * configurada (ou com menos de 24 caracteres), ninguém entra: falha fechada.
 */
export function SegredoGuard(envVar: string): Type<CanActivate> {
  @Injectable()
  class Guard implements CanActivate {
    canActivate(ctx: ExecutionContext): boolean {
      const req = ctx.switchToHttp().getRequest();
      const recebido = req.headers['x-citacs-token'] ?? req.query?.token;
      if (!segredoConfere(recebido, process.env[envVar])) throw new UnauthorizedException('Token inválido');
      return true;
    }
  }
  return mixin(Guard);
}
