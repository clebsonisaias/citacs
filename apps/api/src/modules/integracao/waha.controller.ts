import { Body, Controller, Post } from '@nestjs/common';
import { WahaService } from './waha.service';
import { Publico } from '../auth/auth.guard';

@Controller('integracao/waha')
export class WahaController {
  constructor(private readonly wahaService: WahaService) {}

  /**
   * Webhook chamado pelo contêiner WAHA (WhatsApp HTTP API) ao receber mensagem do assinante.
   */
  @Publico()
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
   */
  @Post('simular')
  async simularAutoCura(@Body('termo') termo: string) {
    return this.wahaService.diagnosticarEAutocurar(termo || 'kovausk');
  }
}
