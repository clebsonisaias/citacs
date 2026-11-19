import {
  BadRequestException,
  Controller,
  Get,
  Injectable,
  Logger,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OnuBridgeTelemetry } from '@citacs/shared';
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
  private onusCache: { em: number; dados: any[] } | null = null;

  get configurado() {
    return !!(this.app && this.token);
  }

  /** Lista ONUs com telemetria óptica do SGP (com cache em memória de 5 minutos). */
  async listarOnusComTelemetria(): Promise<any[]> {
    if (!this.configurado) return [];
    if (this.onusCache && Date.now() - this.onusCache.em < 5 * 60_000) {
      return this.onusCache.dados;
    }
    try {
      const p = new URLSearchParams({ app: this.app, token: this.token });
      const r = await fetch(`${this.url}/api/fttx/onu/list/?${p.toString()}`, {
        method: 'GET',
        signal: AbortSignal.timeout(30_000),
      });
      if (!r.ok) throw new Error(`SGP FTTX respondeu ${r.status}`);
      const d: any = await r.json();
      const list = Array.isArray(d) ? d : (d?.onus || d?.results || []);
      this.onusCache = { em: Date.now(), dados: list };
      return list;
    } catch (e) {
      this.logger.warn(`Falha ao carregar lista geral de ONUs: ${(e as Error).message}`);
      return this.onusCache?.dados || [];
    }
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

  /** Desconecta a sessão PPPoE no BRAS através do SGP para forçar reconexão. */
  async desconectarPppoe(login: string): Promise<{ ok: boolean; mensagem: string }> {
    if (!this.configurado) throw new ServiceUnavailableException('Integração SGP não configurada');
    const limpo = normalizarLogin(login);
    if (!limpo) throw new BadRequestException('Login PPPoE inválido');

    const form = new FormData();
    form.set('app', this.app);
    form.set('token', this.token);
    form.set('login', limpo);

    try {
      const r = await fetch(`${this.url}/ws/radius/disconnect/`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(10_000),
      });
      const corpo: any = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(corpo?.msg || corpo?.mensagem || `SGP respondeu ${r.status}`);
      }
      this.cache.delete(`username:${limpo}`);
      return {
        ok: true,
        mensagem: corpo?.result || corpo?.msg || corpo?.mensagem || 'Sessão PPPoE desconectada com sucesso',
      };
    } catch (e) {
      this.logger.error(`Falha ao desconectar PPPoE ${limpo}: ${(e as Error).message}`);
      throw new ServiceUnavailableException(`Falha ao desconectar PPPoE: ${(e as Error).message}`);
    }
  }

  /**
   * Consulta a ONU Bridge externa vinculada ao contrato do assinante via SGP FTTX.
   * Utilizada quando o roteador no ACS não possui interface GPON integrada (ex: Huawei Wi-Fi 6 ligado a ONU Intelbras Bridge).
   */
  async onuBridgeDoCliente(opts: { contrato?: string | number; login?: string; cpfcnpj?: string }): Promise<OnuBridgeTelemetry> {
    if (!this.configurado) {
      return { encontrado: false, isBridge: false };
    }

    let contrato = opts.contrato ? String(opts.contrato) : '';

    // Se não tiver contrato, busca pelo login PPPoE no SGP via /api/ura/consultacliente/
    if (!contrato && opts.login) {
      try {
        const form = new FormData();
        form.set('app', this.app);
        form.set('token', this.token);
        form.set('login', opts.login.trim());
        const r = await fetch(`${this.url}/api/ura/consultacliente/`, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(10_000),
        });
        if (r.ok) {
          const d: any = await r.json();
          if (d?.contratos?.[0]?.contratoId) {
            contrato = String(d.contratos[0].contratoId);
          }
        }
      } catch (e) {
        this.logger.warn(`Falha ao buscar contrato por login ${opts.login}: ${(e as Error).message}`);
      }
    }

    if (!contrato) {
      return { encontrado: false, isBridge: false };
    }

    // Consulta ONU no SGP FTTX
    try {
      const p = new URLSearchParams({
        app: this.app,
        token: this.token,
        contrato,
      });
      const r = await fetch(`${this.url}/api/fttx/onu/list/?${p.toString()}`, {
        method: 'GET',
        signal: AbortSignal.timeout(12_000),
      });

      if (!r.ok) {
        throw new Error(`SGP FTTX list respondeu ${r.status}`);
      }

      const d: any = await r.json();
      const onus: any[] = Array.isArray(d) ? d : (d?.onus || d?.results || []);

      if (!onus.length) {
        return { encontrado: false, isBridge: false };
      }

      const onu = onus[0];
      const serialHex = onu.phy_addr || '';
      let fabricante = 'Desconhecido';
      let serialFormatado = serialHex;

      if (serialHex.length >= 8) {
        try {
          const prefix = Buffer.from(serialHex.slice(0, 8), 'hex').toString('utf8');
          serialFormatado = `${prefix}-${serialHex.slice(8)}`;
          if (prefix.toUpperCase().includes('ITBS')) fabricante = 'Intelbras';
          else if (prefix.toUpperCase().includes('HWTC')) fabricante = 'Huawei';
          else if (prefix.toUpperCase().includes('ZTEG')) fabricante = 'ZTE';
          else if (prefix.toUpperCase().includes('FHTT')) fabricante = 'Fiberhome';
          else if (prefix.toUpperCase().includes('VSOL')) fabricante = 'V-SOL';
          else fabricante = prefix;
        } catch {}
      }

      let sinalRxDbm = onu.info_rx ? parseFloat(onu.info_rx) : null;
      let sinalTxDbm = onu.info_tx ? parseFloat(onu.info_tx) : null;
      let sinalOltRxDbm = onu.info_olt_rx ? parseFloat(onu.info_olt_rx) : null;
      let distanciaMetros: number | null = null;
      let temperaturaC: number | null = null;
      let voltagemV: number | null = null;
      let tempoOnline: string | null = null;
      let ultimoMotivoQueda: string | null = null;
      let status = onu.service_status === 1 ? 'online' : 'offline';

      // Tenta obter telemetria em tempo real da OLT via /api/fttx/onu/:id/info/
      if (onu.id) {
        try {
          const pInfo = new URLSearchParams({ app: this.app, token: this.token });
          const rInfo = await fetch(`${this.url}/api/fttx/onu/${onu.id}/info/?${pInfo.toString()}`, {
            method: 'GET',
            signal: AbortSignal.timeout(10_000),
          });
          if (rInfo.ok) {
            const dInfo: any = await rInfo.json();
            const text: string = typeof dInfo?.result === 'string' ? dInfo.result : JSON.stringify(dInfo);

            const rxM = text.match(/Rx optical power\(dBm\)\s*:\s*(-?\d+\.?\d*)/i);
            const txM = text.match(/Tx optical power\(dBm\)\s*:\s*(-?\d+\.?\d*)/i);
            const oltRxM = text.match(/OLT Rx ONT optical power\(dBm\)\s*:\s*(-?\d+\.?\d*)/i);
            const tempM = text.match(/Temperature\(C\)\s*:\s*(\d+)/i);
            const voltM = text.match(/Voltage\(V\)\s*:\s*([\d.]+)/i);
            const distM = text.match(/ONT distance\(m\)\s*:\s*(\d+)/i);
            const runM = text.match(/Run state\s*:\s*(\w+)/i);
            const snM = text.match(/SN\s*:\s*([A-Za-z0-9]+)\s*\(([^)]+)\)/i);
            const durM = text.match(/ONT online duration\s*:\s*([^\r\n]+)/i);
            const downM = text.match(/Last down cause\s*:\s*([^\r\n]+)/i);

            if (rxM) sinalRxDbm = parseFloat(rxM[1]);
            if (txM) sinalTxDbm = parseFloat(txM[1]);
            if (oltRxM) sinalOltRxDbm = parseFloat(oltRxM[1]);
            if (tempM) temperaturaC = parseInt(tempM[1], 10);
            if (voltM) voltagemV = parseFloat(voltM[1]);
            if (distM) distanciaMetros = parseInt(distM[1], 10);
            if (runM) status = runM[1].toLowerCase();
            if (snM) serialFormatado = snM[2].trim();
            if (durM) tempoOnline = durM[1].trim();
            if (downM) ultimoMotivoQueda = downM[1].trim();
          }
        } catch (e) {
          this.logger.debug(`infoOnu detalhado falhou (usando valores do SGP): ${(e as Error).message}`);
        }
      }

      return {
        encontrado: true,
        isBridge: true,
        onuId: onu.id,
        modelo: onu.type || 'ONU Bridge',
        fabricante,
        serial: serialHex,
        serialFormatado,
        oltNome: onu.olt_name,
        slot: onu.slot,
        pon: onu.pon,
        onuid: onu.onuid,
        vlan: onu.vlan,
        cto: onu.cto,
        ctoPorta: onu.ctoport,
        status,
        sinalRxDbm,
        sinalTxDbm,
        sinalOltRxDbm,
        distanciaMetros,
        temperaturaC,
        voltagemV,
        tempoOnline,
        ultimoMotivoQueda,
        atualizadoEm: onu.info_date || new Date().toISOString(),
      };
    } catch (e) {
      this.logger.warn(`Falha ao consultar ONU Bridge para contrato ${contrato}: ${(e as Error).message}`);
      return { encontrado: false, isBridge: false };
    }
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

  /** Desconecta a sessão PPPoE deste roteador no BRAS através do SGP. */
  @Post(':id/desconectar-pppoe')
  async desconectarPppoe(@Param('id') id: string) {
    if (!this.sgp.configurado) throw new ServiceUnavailableException('Integração SGP não configurada');
    const achado = await this.genieacs.getDeviceComParams(id);
    if (!achado) throw new NotFoundException('Dispositivo não encontrado no ACS');
    const { cpe } = achado;
    const login = cpe.pppoeUsername;
    if (!login) throw new BadRequestException('Dispositivo não possui usuário PPPoE configurado');
    return this.sgp.desconectarPppoe(login);
  }

  /** Telemetria óptica da ONU Bridge externa vinculada via SGP/OLT. */
  @Get(':id/onu-bridge')
  async onuBridge(@Param('id') id: string) {
    if (!this.sgp.configurado) return { configurado: false, encontrado: false, isBridge: false };
    const achado = await this.genieacs.getDeviceComParams(id);
    if (!achado) throw new NotFoundException('Dispositivo não encontrado no ACS');
    const { cpe } = achado;

    // Obtém dados do cliente/contrato
    const cliRes = await this.sgp.clienteDoRoteador(cpe);
    const login = cpe.pppoeUsername || cliRes.cliente?.pppoeLogin;

    const bridge = await this.sgp.onuBridgeDoCliente({ login });
    return {
      configurado: true,
      roteadorAcs: {
        id: cpe.id,
        fabricante: cpe.manufacturer,
        modelo: cpe.modelName,
        serial: cpe.serialNumber,
      },
      ...bridge,
    };
  }
}
