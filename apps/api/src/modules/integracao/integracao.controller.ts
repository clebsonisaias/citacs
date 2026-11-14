import { BadRequestException, ConflictException, Controller, Get, NotFoundException, Query, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { Publico } from '../auth/auth.guard';
import { AuditoriaService } from '../auth/auditoria.service';
import { ipReal } from '../auth/auditoria-util';
import { GenieacsService } from '../genieacs/genieacs.service';
import { diagnosticar } from '../genieacs/diagnostico';
import { IntegracaoGuard } from './integracao.guard';
import { confere, consultaNbi, lerBusca, nomeAtendente, projetar } from './integracao-util';

/**
 * API de outro sistema (AtendeHub) — SÓ LEITURA.
 *
 * Fora da sessão de pessoa (@Publico) e dentro da chave de integração. Não há
 * rota de escrita aqui: reiniciar/Wi-Fi seguem só pelo painel, com perfil,
 * freio e auditoria.
 */
@Publico()
@UseGuards(IntegracaoGuard)
@Controller('integracao/v1')
export class IntegracaoController {
  constructor(
    private readonly genie: GenieacsService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** GET /api/integracao/v1/cpe?pppoe=<login> | ?sn=<serial> | ?ip=<ipv4> */
  @Get('cpe')
  async cpe(@Query() q: Record<string, unknown>, @Req() req: any) {
    const busca = lerBusca(q);
    if ('erro' in busca) throw new BadRequestException(busca.erro);

    const quem = { login: `integracao:${req.sistemaIntegracao}` };
    const ip = ipReal(req.headers['x-forwarded-for'], req.socket?.remoteAddress);
    const detalhe = { busca: busca.tipo, atendente: nomeAtendente(req.headers['x-atendente']) };
    const registrar = (alvo: string | null, resultado: 'ok' | 'erro', extra?: object) =>
      void this.auditoria.registrar(quem, 'consulta integração', alvo, resultado, { ...detalhe, ...extra }, ip);

    let ids: string[];
    try {
      ids = await this.genie.buscarIds(consultaNbi(busca));
    } catch {
      registrar(null, 'erro', { motivo: 'acs indisponivel' });
      throw new ServiceUnavailableException('ACS indisponível');
    }

    // A consulta traz candidatos; só vale quem bate de verdade depois de normalizado.
    const achados = [];
    for (const id of ids) {
      const r = await this.genie.getDeviceComParams(id);
      if (r && confere(busca, r.cpe, id.split('-').at(-1))) achados.push(r);
    }
    if (achados.length === 0) {
      registrar(null, 'ok', { encontrado: false });
      throw new NotFoundException('Nenhum roteador no ACS para este cliente');
    }
    if (achados.length > 1) {
      // IP com CGNAT ou login repetido: devolver o primeiro mostraria o roteador de outra pessoa.
      registrar(null, 'erro', { motivo: 'ambiguo', candidatos: achados.length });
      throw new ConflictException('Mais de um roteador casa com a busca; use o serial');
    }

    const { cpe, params } = achados[0];
    let diag = null;
    try {
      diag = diagnosticar(params, { online: cpe.online, ultimoInform: cpe.lastInform });
    } catch {
      diag = null; // diagnóstico é extra: sem ele, os dados do roteador ainda servem
    }
    registrar(cpe.id, 'ok', { encontrado: true });
    return projetar(cpe, diag);
  }
}
