import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { COOKIE, lerCookie, podeEscrever } from './auth-util';

/** Rota aberta sem login (só o login e o logout). */
export const Publico = () => SetMetadata('publico', true);
/** Altera roteador: perfil escrita ou admin. */
export const Escrita = () => SetMetadata('escrita', true);
/** Gestão da equipe: só admin. */
export const Admin = () => SetMetadata('admin', true);
/** Liberada para quem ainda está com a senha temporária (ver quem sou, trocar a senha). */
export const SenhaTemporariaOk = () => SetMetadata('senhaTemporariaOk', true);

/** Guard global: toda rota exige sessão, a não ser as marcadas com @Publico(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const marca = (chave: string) => this.reflector.getAllAndOverride<boolean>(chave, [ctx.getHandler(), ctx.getClass()]);
    if (marca('publico')) return true;

    const req = ctx.switchToHttp().getRequest();
    const token = lerCookie(req.headers.cookie, COOKIE);
    const usuario = await this.auth.validar(token);
    if (!usuario) throw new UnauthorizedException('Faça login');
    if (usuario.trocarSenha && !marca('senhaTemporariaOk')) throw new ForbiddenException('Troque a senha temporária antes de continuar');
    if (marca('admin') && usuario.perfil !== 'admin') throw new ForbiddenException('Só o administrador pode fazer isso');
    if (marca('escrita') && !podeEscrever(usuario.perfil)) throw new ForbiddenException('Seu perfil é só de leitura');

    req.usuario = usuario;
    req.tokenSessao = token;
    return true;
  }
}
