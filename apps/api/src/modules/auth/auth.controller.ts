import { Body, Controller, Get, HttpCode, HttpException, Param, ParseIntPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthService, Usuario } from './auth.service';
import { Admin, Publico, SenhaTemporariaOk } from './auth.guard';
import { COOKIE, lerCookie, Perfil, PERFIS, SESSAO_HORAS } from './auth-util';
import { Auditar, AuditoriaService } from './auditoria.service';
import { ipReal } from './auditoria-util';

class LoginDto {
  @IsString() @MaxLength(64) login: string;
  @IsString() @MaxLength(200) senha: string;
}

class TrocarSenhaDto {
  @IsString() @MaxLength(200) atual: string;
  @IsString() @MaxLength(200) nova: string;
}

class CriarUsuarioDto {
  @IsString() @MaxLength(32) login: string;
  @IsString() @MinLength(2) @MaxLength(80) nome: string;
  @IsIn(PERFIS) perfil: Perfil;
}

class AlterarUsuarioDto {
  @IsOptional() @IsIn(PERFIS) perfil?: Perfil;
  @IsOptional() @IsBoolean() ativo?: boolean;
}

type ReqLogada = Request & { usuario: Usuario; tokenSessao: string };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const ip = ipReal(req.headers['x-forwarded-for'], req.socket?.remoteAddress);
    try {
      const { token, usuario } = await this.auth.login(dto.login, dto.senha);
      res.cookie(COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: SESSAO_HORAS * 3600_000,
      });
      await this.auditoria.registrar(usuario, 'login', null, 'ok', null, ip);
      return usuario;
    } catch (e) {
      const bloqueado = e instanceof HttpException && e.getStatus() === 429;
      await this.auditoria.registrar({ login: dto.login.trim().toLowerCase() }, 'login', null, bloqueado ? 'bloqueado' : 'erro', null, ip);
      throw e;
    }
  }

  @Publico()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(lerCookie(req.headers.cookie, COOKIE));
    res.clearCookie(COOKIE, { path: '/' });
  }

  @SenhaTemporariaOk()
  @Get('me')
  me(@Req() req: ReqLogada) {
    return req.usuario;
  }

  @SenhaTemporariaOk()
  @Auditar('senha trocada')
  @Post('senha')
  @HttpCode(204)
  trocarSenha(@Req() req: ReqLogada, @Body() dto: TrocarSenhaDto) {
    return this.auth.trocarSenha(req.usuario, req.tokenSessao, dto.atual, dto.nova);
  }
}

@Admin()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  listar() {
    return this.auth.listar();
  }

  @Auditar('usuário criado')
  @Post()
  criar(@Body() dto: CriarUsuarioDto) {
    return this.auth.criar(dto.login, dto.nome, dto.perfil);
  }

  @Auditar('usuário alterado')
  @Patch(':id')
  @HttpCode(204)
  alterar(@Param('id', ParseIntPipe) id: number, @Body() dto: AlterarUsuarioDto, @Req() req: ReqLogada) {
    return this.auth.alterar(id, req.usuario, dto);
  }

  @Auditar('senha temporária gerada')
  @Post(':id/nova-senha')
  novaSenha(@Param('id', ParseIntPipe) id: number, @Req() req: ReqLogada) {
    return this.auth.novaSenhaTemporaria(id, req.usuario);
  }
}

/** Quem fez o quê (só admin). */
@Admin()
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  listar(@Query('limite') limite?: string) {
    return this.auditoria.listar(limite ? parseInt(limite, 10) || 300 : 300);
  }
}
