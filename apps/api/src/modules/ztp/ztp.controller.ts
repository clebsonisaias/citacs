import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ZtpService } from './ztp.service';
import { Publico } from '../auth/auth.guard';
import { SegredoGuard } from '../auth/segredo.guard';
import { ZtpProvisionInfo, ZtpRegistroLog } from '@citacs/shared';

@Controller('ztp')
export class ZtpController {
  constructor(private readonly ztpService: ZtpService) {}

  /**
   * Endpoint de consulta chamado pelo GenieACS Extension durante o evento 0 BOOTSTRAP.
   * Fora da sessão de pessoa, mas exige ZTP_TOKEN (cabeçalho X-Citacs-Token):
   * a resposta traz senha PPPoE e do Wi-Fi do cliente.
   */
  @Publico()
  @UseGuards(SegredoGuard('ZTP_TOKEN'))
  @Get('provision-info')
  async obterInfoProvisao(
    @Query('serial') serial?: string,
    @Query('mac') mac?: string,
    @Query('manufacturer') manufacturer?: string,
    @Query('model') model?: string,
  ): Promise<ZtpProvisionInfo> {
    if (!serial && !mac) {
      return {
        autorizado: false,
        motivo: 'Parâmetro serial ou mac é obrigatório para provisionamento',
      };
    }

    return this.ztpService.resolverProvisao({
      serial: serial || '',
      mac,
      fabricante: manufacturer,
      modelo: model,
    });
  }

  /**
   * Histórico de ativações Zero-Touch para o painel NOC.
   */
  @Get('logs')
  async listarLogs(@Query('limite') limite?: string): Promise<ZtpRegistroLog[]> {
    const lim = limite ? Math.min(Math.max(parseInt(limite, 10) || 50, 1), 200) : 50;
    return this.ztpService.listarLogs(lim);
  }
}
