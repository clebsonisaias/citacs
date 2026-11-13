import { Injectable } from '@nestjs/common';
import { GenieacsService } from '../genieacs/genieacs.service';
import { CpeDevice } from '@citacs/shared';

@Injectable()
export class CpeService {
  constructor(private readonly genieacsService: GenieacsService) {}

  async listCpes(search?: string): Promise<CpeDevice[]> {
    const devices = await this.genieacsService.getDevices();
    if (!search) return devices;

    const term = search.toLowerCase();
    return devices.filter(
      (c) =>
        c.serialNumber.toLowerCase().includes(term) ||
        c.modelName.toLowerCase().includes(term) ||
        (c.macAddress && c.macAddress.toLowerCase().includes(term)) ||
        (c.ipAddress && c.ipAddress.includes(term)) ||
        (c.pppoeUsername && c.pppoeUsername.toLowerCase().includes(term))
    );
  }

  async getCpeById(id: string): Promise<CpeDevice | null> {
    return this.genieacsService.getDeviceById(id);
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
