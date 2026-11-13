import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { CpeDevice, OpticalPower, WifiRadio, WanInterface } from '@citacs/shared';

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
    try {
      const response = await this.client.get(`/devices/${encodeURIComponent(id)}`);
      if (!response.data) return null;
      return this.normalizeCpe(response.data);
    } catch (error: any) {
      this.logger.error(`Erro ao buscar CPE ${id}: ${error.message}`);
      return null;
    }
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
   * Altera configurações de Wi-Fi (SSID, Senha, Canal)
   * Suporta variantes de caminho TR-069 (KeyPassphrase, PreSharedKey)
   */
  async setWifiConfig(
    deviceId: string,
    radioBand: '2.4GHz' | '5GHz',
    config: { ssid?: string; password?: string; channel?: number }
  ): Promise<any> {
    this.logger.log(`Atualizando Wi-Fi (${radioBand}) para CPE ${deviceId}`);
    const parameterValues: [string, string, string][] = [];

    // TR-098 / TR-181 mapping
    const is5G = radioBand === '5GHz';
    const wlanIndex = is5G ? '2' : '1';
    const base = `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${wlanIndex}`;

    if (config.ssid) {
      parameterValues.push([`${base}.SSID`, config.ssid, 'xsd:string']);
    }
    if (config.password) {
      // Compatibilidade Huawei/ZTE/Outros: envia para KeyPassphrase e PreSharedKey
      parameterValues.push([`${base}.PreSharedKey.1.KeyPassphrase`, config.password, 'xsd:string']);
      parameterValues.push([`${base}.KeyPassphrase`, config.password, 'xsd:string']);
      parameterValues.push([`${base}.PreSharedKey.1.PreSharedKey`, config.password, 'xsd:string']);
    }
    if (config.channel) {
      parameterValues.push([`${base}.Channel`, config.channel.toString(), 'xsd:unsignedInt']);
    }

    const response = await this.client.post(
      `/devices/${encodeURIComponent(deviceId)}/tasks?timeout=3000&connection_request`,
      {
        name: 'setParameterValues',
        parameterValues,
      }
    );
    return response.data;
  }

  /**
   * Obtém todos os parâmetros em formato plano [caminho, valor, gravável]
   */
  async getDeviceParametersFlat(deviceId: string): Promise<Array<[string, string, boolean]>> {
    const raw = await this.client.get(`/devices/${encodeURIComponent(deviceId)}`);
    if (!raw.data) return [];
    
    const out: Array<[string, string, boolean]> = [];
    const walk = (node: Record<string, unknown>, path: string) => {
      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith('_') || v == null || typeof v !== 'object') continue;
        const p = path ? `${path}.${k}` : k;
        const n = v as any;
        if ('_value' in n) {
          out.push([p, String(n._value ?? ''), Boolean(n._writable)]);
        }
        walk(n as Record<string, unknown>, p);
      }
    };
    walk(raw.data, '');
    return out;
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
    const deviceId = raw.DeviceID || {};
    const info =
      raw.InternetGatewayDevice?.DeviceInfo ||
      raw.Device?.DeviceInfo ||
      {};

    const manufacturer = this.extractValue(info.Manufacturer) || deviceId.Manufacturer || 'Desconhecido';
    const modelName = this.extractValue(info.ModelName) || deviceId.ProductClass || 'CPE GPON';
    const serialNumber = this.extractValue(info.SerialNumber) || deviceId.SerialNumber || id.split('-')[2] || id;
    const softwareVersion = this.extractValue(info.SoftwareVersion) || '1.0.0';
    const hardwareVersion = this.extractValue(info.HardwareVersion);

    const lastInform = raw._lastInform ? new Date(raw._lastInform).toISOString() : new Date().toISOString();
    const registeredAt = raw._registered ? new Date(raw._registered).toISOString() : lastInform;

    // Calculo de online (se informou nos ultimos 10 minutos)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const online = raw._lastInform ? new Date(raw._lastInform).getTime() > tenMinutesAgo : false;

    // Extração de potência óptica
    const optical = this.extractOpticalPower(raw);

    // Extração de Wi-Fi
    const wifi = this.extractWifi(raw);

    // Extração de WAN / PPPoE
    const wan = this.extractWan(raw);

    return {
      id,
      serialNumber,
      manufacturer,
      modelName,
      softwareVersion,
      hardwareVersion,
      macAddress: this.extractMacAddress(raw),
      ipAddress: this.extractIpAddress(raw),
      pppoeUsername: wan[0]?.name || undefined,
      online,
      lastInform,
      registeredAt,
      optical,
      wifi,
      wan,
    };
  }

  private extractValue(node: any): string | undefined {
    if (!node) return undefined;
    if (typeof node._value !== 'undefined') return String(node._value);
    if (typeof node === 'string') return node;
    return undefined;
  }

  private extractOpticalPower(raw: any): OpticalPower {
    // Procura por campos de Rx / Tx em caminhos conhecidos de Huawei, ZTE, Fiberhome, etc.
    let rxValue: number | null = null;
    let txValue: number | null = null;

    // Heurística de busca no json bruto
    const searchRxKeys = ['RXPower', 'RxPower', 'OpticalRxPower', 'RxOpticalPower'];
    const searchTxKeys = ['TXPower', 'TxPower', 'OpticalTxPower', 'TxOpticalPower'];

    const findPower = (obj: any, keys: string[]): number | null => {
      if (!obj || typeof obj !== 'object') return null;
      for (const key of Object.keys(obj)) {
        if (keys.includes(key)) {
          const val = parseFloat(this.extractValue(obj[key]) || '');
          if (!isNaN(val)) {
            // Alguns fabricantes reportam em 0.1 uW ou 0.0001 dBm
            if (val > 100) return parseFloat((val / 1000).toFixed(2));
            if (val < -100) return parseFloat((val / 100).toFixed(2));
            return parseFloat(val.toFixed(2));
          }
        }
        if (typeof obj[key] === 'object') {
          const nested = findPower(obj[key], keys);
          if (nested !== null) return nested;
        }
      }
      return null;
    };

    rxValue = findPower(raw, searchRxKeys);
    txValue = findPower(raw, searchTxKeys);

    let status: OpticalPower['status'] = 'unknown';
    if (rxValue !== null) {
      if (rxValue >= -24.5 && rxValue <= -8.0) {
        status = 'optimal';
      } else if (rxValue < -24.5 && rxValue >= -27.0) {
        status = 'warning';
      } else {
        status = 'critical';
      }
    }

    return {
      rxDbm: rxValue,
      txDbm: txValue,
      status,
    };
  }

  private extractWifi(raw: any): WifiRadio[] {
    const radios: WifiRadio[] = [];
    const wlanConfig = raw.InternetGatewayDevice?.LANDevice?.['1']?.WLANConfiguration;

    if (wlanConfig) {
      Object.keys(wlanConfig).forEach((key, idx) => {
        if (key.startsWith('_')) return;
        const conf = wlanConfig[key];
        const ssid = this.extractValue(conf?.SSID) || `Rede Wi-Fi ${idx + 1}`;
        const enabled = this.extractValue(conf?.Enable) !== '0';
        const channelRaw = parseInt(this.extractValue(conf?.Channel) || '0', 10);
        const band: WifiRadio['band'] = idx === 0 ? '2.4GHz' : '5GHz';

        radios.push({
          index: idx + 1,
          band,
          ssid,
          enabled,
          channel: channelRaw === 0 ? 'auto' : channelRaw,
        });
      });
    }

    return radios;
  }

  private extractWan(raw: any): WanInterface[] {
    // Normalização simplificada de WAN
    return [
      {
        name: 'Internet_WAN',
        type: 'PPPoE',
        status: 'Connected',
        ipAddress: this.extractIpAddress(raw),
      },
    ];
  }

  private extractIpAddress(raw: any): string | undefined {
    return (
      raw._ip ||
      this.extractValue(raw.InternetGatewayDevice?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANIPConnection?.['1']?.ExternalIPAddress) ||
      this.extractValue(raw.InternetGatewayDevice?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANPPPConnection?.['1']?.ExternalIPAddress)
    );
  }

  private extractMacAddress(raw: any): string | undefined {
    return (
      this.extractValue(raw.InternetGatewayDevice?.LANDevice?.['1']?.LANEthernetInterfaceConfig?.['1']?.MACAddress) ||
      this.extractValue(raw.InternetGatewayDevice?.WANDevice?.['1']?.WANConnectionDevice?.['1']?.WANPPPConnection?.['1']?.MACAddress)
    );
  }
}
