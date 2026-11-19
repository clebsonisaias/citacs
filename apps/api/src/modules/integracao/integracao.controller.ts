import { BadRequestException, ConflictException, Controller, Get, Post, Body, NotFoundException, Query, Req, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { Publico } from '../auth/auth.guard';
import { AuditoriaService } from '../auth/auditoria.service';
import { ipReal } from '../auth/auditoria-util';
import { GenieacsService } from '../genieacs/genieacs.service';
import { CpeService } from '../cpe/cpe.service';
import { diagnosticar } from '../genieacs/diagnostico';
import { IntegracaoGuard } from './integracao.guard';
import { confere, consultaNbi, lerBusca, nomeAtendente, projetar } from './integracao-util';

/**
 * API de integração com sistemas parceiros (CITchat / AtendeHub).
 * Autenticação via chave Bearer configurada em INTEGRACAO_CHAVES ou no banco.
 */
@Publico()
@UseGuards(IntegracaoGuard)
@Controller('integracao/v1')
export class IntegracaoController {
  constructor(
    private readonly genie: GenieacsService,
    private readonly cpeService: CpeService,
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

  /**
   * POST /api/integracao/v1/cpe/wifi
   * Altera nome e senha do Wi-Fi pelo CITchat/WhatsApp.
   * Regra estrita institucional: O nome sempre inicia com NetGo_ (ex: NetGo_Jose).
   */
  @Post('cpe/wifi')
  async alterarWifi(
    @Body() body: { pppoe: string; ssid?: string; senha?: string; banda?: '2.4GHz' | '5GHz' | 'ambas' },
    @Req() req: any,
  ) {
    if (!body?.pppoe) throw new BadRequestException('PPPoE obrigatório');
    const login = body.pppoe.trim().toLowerCase();
    const cpe = await this.obterCpePorLogin(login);

    const quem = { login: `integracao:${req.sistemaIntegracao}` };
    const ip = ipReal(req.headers['x-forwarded-for'], req.socket?.remoteAddress);

    let ssidFormatado: string | undefined = undefined;
    if (body.ssid) {
      const limpo = body.ssid.replace(/^NetGo_/i, '').trim();
      if (!limpo) throw new BadRequestException('O nome da rede Wi-Fi não pode ser vazio');
      ssidFormatado = `NetGo_${limpo}`;
    }

    if (body.senha && body.senha.length < 8) {
      throw new BadRequestException('A senha do Wi-Fi deve ter no mínimo 8 caracteres');
    }

    const banda = body.banda || 'ambas';
    const resultados: Record<string, any> = {};

    if (banda === '2.4GHz' || banda === 'ambas') {
      resultados['2.4GHz'] = await this.cpeService.configureWifi(cpe.id, '2.4GHz', {
        ssid: ssidFormatado,
        password: body.senha,
      });
    }

    if (banda === '5GHz' || banda === 'ambas') {
      const ssid5 = ssidFormatado
        ? (ssidFormatado.endsWith(' 5G') || ssidFormatado.endsWith('_5G') ? ssidFormatado : `${ssidFormatado} 5G`)
        : undefined;
      resultados['5GHz'] = await this.cpeService.configureWifi(cpe.id, '5GHz', {
        ssid: ssid5,
        password: body.senha,
      });
    }

    void this.auditoria.registrar(quem, 'alterar wifi integração', cpe.id, 'ok', {
      login,
      ssid: ssidFormatado,
      banda,
      atendente: nomeAtendente(req.headers['x-atendente']),
    }, ip);

    return {
      sucesso: true,
      mensagem: `Wi-Fi atualizado com sucesso! Nome da rede: ${ssidFormatado || 'mantido'}`,
      ssid: ssidFormatado,
      banda,
    };
  }

  /**
   * POST /api/integracao/v1/cpe/reiniciar
   * Reinicia o roteador remotamente pelo CITchat/WhatsApp.
   */
  @Post('cpe/reiniciar')
  async reiniciar(@Body() body: { pppoe: string }, @Req() req: any) {
    if (!body?.pppoe) throw new BadRequestException('PPPoE obrigatório');
    const login = body.pppoe.trim().toLowerCase();
    const cpe = await this.obterCpePorLogin(login);

    const quem = { login: `integracao:${req.sistemaIntegracao}` };
    const ip = ipReal(req.headers['x-forwarded-for'], req.socket?.remoteAddress);

    await this.cpeService.reboot(cpe.id);

    void this.auditoria.registrar(quem, 'reiniciar roteador integração', cpe.id, 'ok', {
      login,
      atendente: nomeAtendente(req.headers['x-atendente']),
    }, ip);

    return {
      sucesso: true,
      mensagem: 'Comando de reinicialização enviado ao roteador com sucesso.',
      cpeId: cpe.id,
    };
  }

  private async obterCpePorLogin(login: string) {
    const busca = { tipo: 'pppoe' as const, valor: login };
    let ids: string[];
    try {
      ids = await this.genie.buscarIds(consultaNbi(busca));
    } catch {
      throw new ServiceUnavailableException('ACS indisponível');
    }

    for (const id of ids) {
      const r = await this.genie.getDeviceComParams(id);
      if (r && confere(busca, r.cpe, id.split('-').at(-1))) {
        return r.cpe;
      }
    }

    throw new NotFoundException(`Roteador do cliente ${login} não localizado no ACS`);
  }
}
