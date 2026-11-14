import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { CpeDevice, OpticalPower } from '@citacs/shared';
import { achatarGenie, caminhosWifi, detectarDataModel, indicesWifi, normalizarParams, paramsDeGenie } from './cpe-normalizer';

@Injectable()
export class GenieacsService {
  private readonly logger = new Logger(GenieacsService.name);
  private readonly client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    const nbiUrl = this.configService.get<string>('GENIEACS_NBI_URL') || 'http://127.0.0.1:7557';
    this.client = axios.create({
      baseURL: nbiUrl,
      timeout: 10000,
    });
    this.logger.log(`GenieACS NBI Client configurado para: ${nbiUrl}`);
  }

  /**
   * Lista dispositivos CPEs cadastrados no GenieACS
   */
  async getDevices(query = {}): Promise<CpeDevice[]> {
    try {
      const response = await this.client.get('/devices', {
        params: {
          query: JSON.stringify(query),
          projection: [
            '_id',
            '_lastInform',
            '_registered',
            'DeviceID',
            'InternetGatewayDevice.DeviceInfo',
            'Device.DeviceInfo',
            'InternetGatewayDevice.WANDevice',
            'Device.Optical',
            'InternetGatewayDevice.LANDevice',
            'Device.WiFi',
            'Device.PPP',
            'Device.IP',
          ].join(','),
        },
      });

      return (response.data || []).map((raw: any) => this.normalizeCpe(raw));
    } catch (error: any) {
      this.logger.error(`Erro ao buscar dispositivos no NBI: ${error.message}`);
      return [];
    }
  }

  /**
   * Busca um dispositivo específico por ID
   */
  async getDeviceById(id: string): Promise<CpeDevice | null> {
    return (await this.getDeviceComParams(id))?.cpe ?? null;
  }

  /** CPE normalizada + mapa caminho→valor bruto (para o diagnóstico). */
  async getDeviceComParams(id: string): Promise<{ cpe: CpeDevice; params: Record<string, string> } | null> {
    try {
      const raw = await this.buscarRaw(id);
      return raw ? { cpe: this.normalizeCpe(raw), params: paramsDeGenie(raw) } : null;
    } catch (error: any) {
      this.logger.error(`Erro ao buscar CPE ${id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Ids dos aparelhos que casam com a consulta (no máximo `limite`). Para a
   * integração: quem chama confere cada candidato e recusa se houver mais de um.
   */
  async buscarIds(query: Record<string, unknown>, limite = 3): Promise<string[]> {
    const { data } = await this.client.get('/devices', {
      params: { query: JSON.stringify(query), projection: '_id', limit: limite },
    });
    return (data ?? []).map((d: { _id: string }) => d._id).filter(Boolean);
  }

  /** O NBI do GenieACS não tem GET /devices/:id; a busca por id é uma query. */
  private async buscarRaw(id: string): Promise<any | null> {
    const { data } = await this.client.get('/devices', { params: { query: JSON.stringify({ _id: id }) } });
    return data?.[0] ?? null;
  }

  /**
   * Envia comando de Reboot para a CPE
   */
  async reboot(deviceId: string): Promise<any> {
    this.logger.log(`Disparando Reboot para CPE: ${deviceId}`);
    const response = await this.client.post(
      `/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`,
      { name: 'reboot' }
    );
    return response.data;
  }

  /**
   * Envia comando de Factory Reset para a CPE
   */
  async factoryReset(deviceId: string): Promise<any> {
    this.logger.warn(`Disparando Factory Reset para CPE: ${deviceId}`);
    const response = await this.client.post(
      `/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`,
      { name: 'factoryReset' }
    );
    return response.data;
  }

  /**
   * Altera configurações de Wi-Fi (SSID, Senha, Canal).
   * O índice da rede e o dialeto (TR-098/TR-181) vêm dos parâmetros reais da CPE:
   * índice fixo grava na rede errada (a EG8145V5 usa 1 e 5, outras Huawei 1 e 2).
   */
  async setWifiConfig(
    deviceId: string,
    radioBand: '2.4GHz' | '5GHz',
    config: { ssid?: string; password?: string; channel?: number | 'auto' }
  ): Promise<any> {
    this.logger.log(`Atualizando Wi-Fi (${radioBand}) para CPE ${deviceId}`);
    const raw = await this.buscarRaw(deviceId);
    if (!raw) throw new NotFoundException('Dispositivo não encontrado no ACS');
    const params = paramsDeGenie(raw);
    const dm = detectarDataModel(params) ?? 'tr098';
    const { idx24, idx5 } = indicesWifi(params);
    const idx = radioBand === '5GHz' ? idx5 : idx24;
    if (idx == null) throw new BadRequestException(`CPE não reportou rede Wi-Fi ${radioBand}`);
    const c = caminhosWifi(dm, idx);

    // Valor anterior de cada campo alterado (do último Inform que o GenieACS tem),
    // para desfazer reaplicando `antes` neste mesmo endpoint. A senha nunca é devolvida.
    // ponytail: rollback só na resposta; histórico persistente quando o Postgres entrar em uso.
    const autoAtual = /^(1|true)$/.test(params[c.canalAuto] ?? '');
    const antes: Record<string, unknown> = { band: radioBand };
    const parameterValues: [string, string, string][] = [];
    if (config.ssid) {
      antes.ssid = params[c.ssid] ?? null;
      parameterValues.push([c.ssid, config.ssid, 'xsd:string']);
    }
    if (config.password) {
      for (const caminho of c.senha) parameterValues.push([caminho, config.password, 'xsd:string']);
    }
    if (config.channel === 'auto') {
      antes.channel = autoAtual ? 'auto' : Number(params[c.canal]) || 'auto';
      parameterValues.push([c.canalAuto, 'true', 'xsd:boolean']);
    } else if (config.channel) {
      antes.channel = autoAtual ? 'auto' : Number(params[c.canal]) || 'auto';
      // Canal fixo só vale com o automático desligado; senão a CPE ignora ou volta ao auto.
      parameterValues.push([c.canalAuto, 'false', 'xsd:boolean']);
      parameterValues.push([c.canal, config.channel.toString(), 'xsd:unsignedInt']);
    }
    if (!parameterValues.length) throw new BadRequestException('Nada para alterar');

    const response = await this.client.post(
      `/devices/${encodeURIComponent(deviceId)}/tasks?timeout=3000&connection_request`,
      {
        name: 'setParameterValues',
        parameterValues,
      }
    );
    const { password, ...depois } = config;
    return {
      // 200 = CPE recebeu agora; 202 = fila até o próximo Inform (CPE atrás de CGNAT não recebe Connection Request).
      aplicada: response.status === 200,
      tarefa: response.data,
      antes,
      depois: { band: radioBand, ...depois, ...(password ? { password: '(alterada)' } : {}) },
    };
  }

  /**
   * Obtém todos os parâmetros em formato plano [caminho, valor, gravável]
   */
  async getDeviceParametersFlat(deviceId: string): Promise<Array<[string, string, boolean]>> {
    const raw = await this.client.get(`/devices/${encodeURIComponent(deviceId)}`);
    if (!raw.data) return [];
    return achatarGenie(raw.data);
  }

  /**
   * Força uma atualização imediata de parâmetros (Refresh)
   */
  async refreshParameters(deviceId: string, parameterNames: string[]): Promise<any> {
    const response = await this.client.post(
      `/devices/${encodeURIComponent(deviceId)}/tasks?connection_request`,
      {
        name: 'refreshObject',
        objectName: parameterNames[0] || 'InternetGatewayDevice',
      }
    );
    return response.data;
  }

  /**
   * Normaliza dados brutos do TR-069 em objeto estruturado
   */
  private normalizeCpe(raw: any): CpeDevice {
    const id = raw._id || '';
    const p = paramsDeGenie(raw);
    const n = normalizarParams(p);

    const lastInform = raw._lastInform ? new Date(raw._lastInform).toISOString() : new Date().toISOString();
    const registeredAt = raw._registered ? new Date(raw._registered).toISOString() : lastInform;

    // Calculo de online (se informou nos ultimos 10 minutos)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const online = raw._lastInform ? new Date(raw._lastInform).getTime() > tenMinutesAgo : false;

    let status: OpticalPower['status'] = 'unknown';
    if (n.sinalRx !== null) {
      if (n.sinalRx >= -24.5 && n.sinalRx <= -8.0) status = 'optimal';
      else if (n.sinalRx < -24.5 && n.sinalRx >= -27.0) status = 'warning';
      else status = 'critical';
    }

    const temWan = n.wanStatus || n.ipWan || n.pppoeUser;
    const wanStatus = /^(Connected|Up)$/.test(n.wanStatus ?? '') ? 'Connected'
      : n.wanStatus === 'Connecting' ? 'Connecting' : 'Disconnected';

    return {
      id,
      serialNumber: n.serial || p['DeviceID.SerialNumber'] || id.split('-')[2] || id,
      manufacturer: n.manufacturer || p['DeviceID.Manufacturer'] || 'Desconhecido',
      modelName: n.model || p['DeviceID.ProductClass'] || 'CPE GPON',
      softwareVersion: n.firmware || 'N/D',
      hardwareVersion: n.hardwareVer ?? undefined,
      macAddress: this.extractMacAddress(raw),
      ipAddress: n.ipWan ?? undefined,
      pppoeUsername: n.pppoeUser ?? undefined,
      online,
      lastInform,
      registeredAt,
      optical: { rxDbm: n.sinalRx, txDbm: n.sinalTx, status },
      wifi: n.wifi.map((w) => ({
        index: Number(w.idx),
        band: w.banda,
        ssid: w.ssid ?? '',
        enabled: w.ativo,
        channel: w.canal ? w.canal : 'auto',
        connectedClientsCount: w.clientes ?? undefined,
      })),
      wan: temWan
        ? [{
            name: n.pppoeUser || 'WAN',
            type: n.pppoeUser ? 'PPPoE' : 'IPoE',
            status: wanStatus,
            ipAddress: n.ipWan ?? undefined,
            uptimeSeconds: n.wanUptimeSeg ?? undefined,
          }]
        : [],
    };
  }

  private extractValue(node: any): string | undefined {
    if (!node) return undefined;
    if (typeof node._value !== 'undefined') return String(node._value);
    if (typeof node === 'string') return node;
    return undefined;
  }

  private extractMacAddress(raw: any): string | undefined {
    return (
      this.extractValue(raw.InternetGatewayDevice?.LANDevice?.['1']?.LANEthernetInterfaceConfig?.['1']?.MACAddress) ||
      this.extractValue(raw.InternetGatewayDevice?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANPPPConnection?.['1']?.MACAddress)
    );
  }
}
