import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Req, Res } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuthService, Usuario } from './auth.service';
import { Admin, Publico, SenhaTemporariaOk } from './auth.guard';
import { COOKIE, lerCookie, Perfil, PERFIS, SESSAO_HORAS } from './auth-util';

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
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, usuario } = await this.auth.login(dto.login, dto.senha);
    res.cookie(COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSAO_HORAS * 3600_000,
    });
    return usuario;
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

  @Post()
  criar(@Body() dto: CriarUsuarioDto) {
    return this.auth.criar(dto.login, dto.nome, dto.perfil);
  }

  @Patch(':id')
  @HttpCode(204)
  alterar(@Param('id', ParseIntPipe) id: number, @Body() dto: AlterarUsuarioDto, @Req() req: ReqLogada) {
    return this.auth.alterar(id, req.usuario, dto);
  }

  @Post(':id/nova-senha')
  novaSenha(@Param('id', ParseIntPipe) id: number, @Req() req: ReqLogada) {
    return this.auth.novaSenhaTemporaria(id, req.usuario);
  }
}
