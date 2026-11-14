import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Admin } from '../auth/auth.guard';
import { Auditar } from '../auth/auditoria.service';
import { ChavesIntegracaoService } from './chaves.service';

class CriarChaveDto {
  @IsString() @MaxLength(32) sistema: string;
  @IsOptional() @IsString() @MaxLength(120) descricao?: string;
}

/** Painel → Integrações: gerar, listar e revogar chaves (só admin). */
@Admin()
@Controller('integracoes/chaves')
export class ChavesIntegracaoController {
  constructor(private readonly chaves: ChavesIntegracaoService) {}

  @Get()
  listar() {
    return this.chaves.listar();
  }

  @Auditar('chave de integração criada')
  @Post()
  criar(@Body() dto: CriarChaveDto, @Req() req: { usuario: { login: string } }) {
    return this.chaves.criar(dto.sistema, dto.descricao ?? '', req.usuario.login);
  }

  @Auditar('chave de integração revogada')
  @Post(':id/revogar')
  @HttpCode(204)
  revogar(@Param('id', ParseIntPipe) id: number) {
    return this.chaves.revogar(id);
  }
}
