import { Controller, Get, Injectable, Logger, NotFoundException, Param, ServiceUnavailableException } from '@nestjs/common';
import { GenieacsService } from '../genieacs/genieacs.service';
import { ClienteSgp, extrairCliente, normalizarLogin, resolverVinculoCliente, ResultadoClienteRoteador } from './sgp-util';

const CACHE_MS = 10 * 60_000;

/**
 * Leitura do SGP da NetGo. Só consulta; nunca altera nada lá.
 * Configuração por ambiente: SGP_URL, SGP_APP, SGP_TOKEN (sem token, a integração fica desligada).
 */
@Injectable()
export class SgpService {
  private readonly logger = new Logger(SgpService.name);
  private readonly url = process.env.SGP_URL || 'https://conect.sgp.net.br';
  private readonly app = process.env.SGP_APP || '';
  private readonly token = process.env.SGP_TOKEN || '';
  // Cache em memória por chave (username:<login> ou ip:<ip>)
  private readonly cache = new Map<string, { em: number; valor: ClienteSgp | null }>();

  get configurado() {
    return !!(this.app && this.token);
  }

  private async consultarSgp(campo: 'username' | 'framedipaddress', valor: string): Promise<ClienteSgp | null> {
    const chave = `${campo}:${valor}`;
    const guardado = this.cache.get(chave);
    if (guardado && Date.now() - guardado.em < CACHE_MS) return guardado.valor;

    const form = new FormData();
    form.set('app', this.app);
    form.set('token', this.token);
    form.set(campo, valor);
    form.set('limit', '3');
    let corpo: unknown;
    try {
      const r = await fetch(`${this.url}/ws/radius/radacct/list/all/`, { method: 'POST', body: form, signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error(`SGP respondeu ${r.status}`);
      corpo = await r.json();
    } catch (e) {
      this.logger.warn(`SGP indisponível (${campo}=${valor}): ${(e as Error).message}`);
      throw new ServiceUnavailableException('Não foi possível consultar o SGP agora');
    }
    let resultado: ClienteSgp | null;
    try {
      resultado = extrairCliente(corpo);
    } catch (e) {
      this.logger.warn((e as Error).message);
      throw new ServiceUnavailableException((e as Error).message);
    }
    if (this.cache.size > 5_000) this.cache.clear();
    this.cache.set(chave, { em: Date.now(), valor: resultado });
    return resultado;
  }

  /** Assinante do SGP com este login PPPoE. */
  async clientePorLogin(login: string): Promise<ClienteSgp | null> {
    const limpo = normalizarLogin(login);
    if (!limpo) return null;
    return this.consultarSgp('username', limpo);
  }

  /** Quem está com este IP agora, pela sessão Radius (o IP de internet que o roteador informa ao ACS). */
  async clientePorIp(ip: string): Promise<ClienteSgp | null> {
    const limpo = (ip ?? '').trim();
    if (!limpo) return null;
    return this.consultarSgp('framedipaddress', limpo);
  }

  /**
   * Identifica o cliente dono do roteador:
   * 1. Prioritariamente por login PPPoE (infalível em redes dinâmicas/CGNAT).
   * 2. Fallback por IP (apenas se o login do SGP bater ou se o roteador não tiver login).
   */
  async clienteDoRoteador(cpe: { pppoeUsername?: string; ipAddress?: string }): Promise<ResultadoClienteRoteador> {
    if (!this.configurado) {
      return { cliente: null, metodo: null, loginConfere: null, motivo: 'Integração SGP não configurada' };
    }

    const login = normalizarLogin(cpe.pppoeUsername);
    const ip = (cpe.ipAddress ?? '').trim();

    let clienteLogin: ClienteSgp | null = null;
    if (login) {
      clienteLogin = await this.clientePorLogin(login).catch(() => null);
    }

    let clienteIp: ClienteSgp | null = null;
    if (!clienteLogin && ip) {
      clienteIp = await this.clientePorIp(ip).catch(() => null);
    }

    return resolverVinculoCliente(cpe, clienteLogin, clienteIp);
  }

  /** Velocidade do plano do cliente vinculado ao CPE. */
  async planoMbpsDoCpe(cpe?: { pppoeUsername?: string; ipAddress?: string }): Promise<number | undefined> {
    if (!this.configurado || !cpe) return undefined;
    return (await this.clienteDoRoteador(cpe).catch(() => null))?.cliente?.planoMbps ?? undefined;
  }

  /** Velocidade do plano, se der para descobrir; nunca derruba quem chama (legado). */
  async planoMbpsDoIp(ip?: string): Promise<number | undefined> {
    if (!this.configurado || !ip) return undefined;
    return (await this.clientePorIp(ip).catch(() => null))?.planoMbps ?? undefined;
  }
}

@Controller('cpes')
export class ClienteController {
  constructor(
    private readonly sgp: SgpService,
    private readonly genieacs: GenieacsService,
  ) {}

  /** Cliente do SGP dono deste roteador, ligado por login PPPoE ou IP de internet. */
  @Get(':id/cliente')
  async cliente(@Param('id') id: string) {
    if (!this.sgp.configurado) return { configurado: false };
    const achado = await this.genieacs.getDeviceComParams(id);
    if (!achado) throw new NotFoundException('Dispositivo não encontrado no ACS');
    const { cpe } = achado;
    const res = await this.sgp.clienteDoRoteador(cpe);
    return {
      configurado: true,
      loginConsultado: cpe.pppoeUsername,
      ipConsultado: cpe.ipAddress,
      lidoEm: cpe.lastInform,
      cliente: res.cliente,
      metodo: res.metodo,
      loginConfere: res.loginConfere,
      motivo: res.motivo,
    };
  }
}
