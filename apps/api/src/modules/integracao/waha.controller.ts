import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { WahaService } from './waha.service';
import { Escrita, Publico } from '../auth/auth.guard';
import { Auditar } from '../auth/auditoria.service';
import { SegredoGuard } from '../auth/segredo.guard';

@Controller('integracao/waha')
export class WahaController {
  constructor(private readonly wahaService: WahaService) {}

  /**
   * Webhook chamado pelo contêiner WAHA (WhatsApp HTTP API) ao receber mensagem do assinante.
   * Exige WAHA_WEBHOOK_TOKEN (cabeçalho X-Citacs-Token ou ?token=): a rota altera o
   * canal do Wi-Fi do roteador e devolve dados do cliente.
   */
  @Publico()
  @UseGuards(SegredoGuard('WAHA_WEBHOOK_TOKEN'))
  @Post('webhook')
  async receberMensagemWhatsapp(@Body() body: any) {
    const from = body?.payload?.from || body?.from || '';
    const text = body?.payload?.body || body?.body || '';

    // Extrai o número de telefone (remove sufixo @c.us se houver)
    const telefone = from.replace(/@.*$/, '').replace(/\D/g, '');
    if (!telefone) return { ok: false, motivo: 'Telefone ausente' };

    return this.wahaService.diagnosticarEAutocurar(telefone);
  }

  /**
   * Endpoint de teste/simulação de auto-cura diretamente pelo painel do CITacs.
   * Altera o roteador: perfil de escrita, passa pelo freio e fica na auditoria.
   */
  @Escrita()
  @Auditar('auto-cura simulada (WAHA)', { freio: true })
  @Post('simular')
  async simularAutoCura(@Body('termo') termo: string) {
    return this.wahaService.diagnosticarEAutocurar(termo || 'kovausk');
  }
}
