import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenieacsService } from '../genieacs/genieacs.service';
import { SgpService } from '../sgp/sgp.service';
import { AiChatMessage } from '@citacs/shared';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly genieacsService: GenieacsService,
    private readonly sgp: SgpService
  ) {}

  @Post('diagnose/:cpeId')
  async diagnose(
    @Param('cpeId') cpeId: string,
    @Body('tenantId') tenantId?: string
  ) {
    const found = await this.genieacsService.getDeviceComParams(cpeId);
    if (!found) {
      return {
        error: 'Dispositivo não encontrado no ACS',
      };
    }
    // Com o plano do SGP, o diagnóstico compara a velocidade negociada com a contratada.
    const planoMbps = await this.sgp.planoMbpsDoIp(found.cpe.ipAddress);
    return this.aiService.diagnoseCpe(found.cpe, found.params, tenantId, planoMbps);
  }

  @Post('chat')
  async chat(
    @Body()
    body: {
      messages: AiChatMessage[];
      cpeId?: string;
      tenantId?: string;
    }
  ) {
    let cpeContext = undefined;
    if (body.cpeId) {
      cpeContext = await this.genieacsService.getDeviceById(body.cpeId);
    }
    return this.aiService.chatWithCopilot(
      body.messages || [],
      cpeContext || undefined,
      body.tenantId
    );
  }
}
