import { Injectable } from '@nestjs/common';
import { GenieacsService } from '../genieacs/genieacs.service';
import { SgpService } from '../sgp/sgp.service';
import { CpeDevice } from '@citacs/shared';

@Injectable()
export class CpeService {
  constructor(
    private readonly genieacsService: GenieacsService,
    private readonly sgpService: SgpService,
  ) {}

  async listCpes(search?: string): Promise<CpeDevice[]> {
    const devices = await this.genieacsService.getDevices();

    // Enriquece com o nome do assinante via SGP em paralelo
    if (this.sgpService.configurado && devices.length > 0) {
      await Promise.allSettled(
        devices.map(async (d) => {
          try {
            const vinculo = await this.sgpService.clienteDoRoteador(d);
            if (vinculo.cliente?.nome) {
              d.subscriberName = vinculo.cliente.nome;
            }
          } catch {
            // Silencioso para não quebrar a listagem de CPEs
          }
        }),
      );
    }

    if (!search) return devices;

    const term = search.toLowerCase();
    return devices.filter(
      (c) =>
        c.serialNumber.toLowerCase().includes(term) ||
        c.modelName.toLowerCase().includes(term) ||
        (c.subscriberName && c.subscriberName.toLowerCase().includes(term)) ||
        (c.macAddress && c.macAddress.toLowerCase().includes(term)) ||
        (c.ipAddress && c.ipAddress.includes(term)) ||
        (c.pppoeUsername && c.pppoeUsername.toLowerCase().includes(term))
    );
  }

  async getCpeById(id: string): Promise<CpeDevice | null> {
    const cpe = await this.genieacsService.getDeviceById(id);
    if (cpe && this.sgpService.configurado) {
      try {
        const vinculo = await this.sgpService.clienteDoRoteador(cpe);
        if (vinculo.cliente?.nome) {
          cpe.subscriberName = vinculo.cliente.nome;
        }
      } catch {
        // Silencioso
      }
    }
    return cpe;
  }

  async getParameters(id: string): Promise<Array<[string, string, boolean]>> {
    return this.genieacsService.getDeviceParametersFlat(id);
  }

  async reboot(id: string): Promise<any> {
    return this.genieacsService.reboot(id);
  }

  async factoryReset(id: string): Promise<any> {
    return this.genieacsService.factoryReset(id);
  }

  async configureWifi(
    id: string,
    radioBand: '2.4GHz' | '5GHz',
    config: { ssid?: string; password?: string; channel?: number | 'auto' }
  ): Promise<any> {
    return this.genieacsService.setWifiConfig(id, radioBand, config);
  }

  async refresh(id: string): Promise<any> {
    return this.genieacsService.refreshParameters(id, ['InternetGatewayDevice']);
  }
}
