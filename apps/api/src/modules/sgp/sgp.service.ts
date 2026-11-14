import { Controller, Get, Injectable, Logger, NotFoundException, Param, ServiceUnavailableException } from '@nestjs/common';
import { GenieacsService } from '../genieacs/genieacs.service';
import { ClienteSgp, extrairCliente, normalizarLogin } from './sgp-util';

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
  // ponytail: cache em memória por IP (1 instância da API); vai para o banco se precisar de busca por nome.
  private readonly cache = new Map<string, { em: number; valor: ClienteSgp | null }>();

  get configurado() {
    return !!(this.app && this.token);
  }

  /** Quem está com este IP agora, pela sessão Radius (o IP de internet que o roteador informa ao ACS). */
  async clientePorIp(ip: string): Promise<ClienteSgp | null> {
    const guardado = this.cache.get(ip);
    if (guardado && Date.now() - guardado.em < CACHE_MS) return guardado.valor;

    const form = new FormData();
    form.set('app', this.app);
    form.set('token', this.token);
    form.set('framedipaddress', ip);
    form.set('limit', '3');
    let corpo: unknown;
    try {
      const r = await fetch(`${this.url}/ws/radius/radacct/list/all/`, { method: 'POST', body: form, signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error(`SGP respondeu ${r.status}`);
      corpo = await r.json();
    } catch (e) {
      this.logger.warn(`SGP indisponível: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Não foi possível consultar o SGP agora');
    }
    let valor: ClienteSgp | null;
    try {
      valor = extrairCliente(corpo);
    } catch (e) {
      this.logger.warn((e as Error).message);
      throw new ServiceUnavailableException((e as Error).message);
    }
    if (this.cache.size > 5_000) this.cache.clear();
    this.cache.set(ip, { em: Date.now(), valor });
    return valor;
  }

  /** Velocidade do plano, se der para descobrir; nunca derruba quem chama. */
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

  /** Cliente do SGP dono deste roteador, ligado pelo IP de internet da última leitura. */
  @Get(':id/cliente')
  async cliente(@Param('id') id: string) {
    if (!this.sgp.configurado) return { configurado: false };
    const achado = await this.genieacs.getDeviceComParams(id);
    if (!achado) throw new NotFoundException('Dispositivo não encontrado no ACS');
    const { cpe } = achado;
    const ip = cpe.ipAddress;
    if (!ip) return { configurado: true, cliente: null, motivo: 'O roteador ainda não informou o IP de internet' };
    const cliente = await this.sgp.clientePorIp(ip);
    return {
      configurado: true,
      ipConsultado: ip,
      lidoEm: cpe.lastInform,
      cliente,
      // O login PPPoE que o roteador usa precisa bater com o do SGP; se não bater, o IP pode ter mudado de dono.
      loginConfere: cliente && cpe.pppoeUsername ? normalizarLogin(cpe.pppoeUsername) === normalizarLogin(cliente.pppoeLogin) : null,
      motivo: cliente ? undefined : 'Nenhuma sessão no SGP com este IP',
    };
  }
}
