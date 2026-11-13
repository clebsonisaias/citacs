import { Controller, Post, Body, Param, Get } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenieacsService } from '../genieacs/genieacs.service';
import { AiChatMessage } from '@citacs/shared';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly genieacsService: GenieacsService
  ) {}

  @Post('diagnose/:cpeId')
  async diagnose(@Param('cpeId') cpeId: string) {
    const cpe = await this.genieacsService.getDeviceById(cpeId);
    if (!cpe) {
      return {
        error: 'Dispositivo não encontrado no ACS',
      };
    }
    return this.aiService.diagnoseCpe(cpe);
  }

  @Post('chat')
  async chat(
    @Body()
    body: {
      messages: AiChatMessage[];
      cpeId?: string;
    }
  ) {
    let cpeContext = undefined;
    if (body.cpeId) {
      cpeContext = await this.genieacsService.getDeviceById(body.cpeId);
    }
    return this.aiService.chatWithCopilot(body.messages || [], cpeContext || undefined);
  }
}
