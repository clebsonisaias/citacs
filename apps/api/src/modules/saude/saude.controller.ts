import { Controller, Get } from '@nestjs/common';
import { Publico } from '../auth/auth.guard';

/**
 * GET /api/health — usado pelo healthcheck do container e pelo Coolify no
 * rolling update: o container novo só recebe tráfego quando responde 200.
 * Não consulta banco nem ACS: queda do GenieACS não deve travar o deploy.
 */
@Controller('health')
export class SaudeController {
  @Publico()
  @Get()
  saude() {
    return { ok: true };
  }
}
