export interface OpticalPower {
  rxDbm: number | null;
  txDbm: number | null;
  status: 'optimal' | 'warning' | 'critical' | 'unknown';
  voltage?: number;
  biasCurrent?: number;
  temperature?: number;
}

export interface WifiRadio {
  index: number;
  band: '2.4GHz' | '5GHz' | '6GHz';
  ssid: string;
  enabled: boolean;
  channel: number | 'auto';
  channelBandwidth?: string;
  securityMode?: string;
  connectedClientsCount?: number;
}

export interface WanInterface {
  name: string;
  type: 'PPPoE' | 'IPoE' | 'Bridge';
  ipAddress?: string;
  macAddress?: string;
  uptimeSeconds?: number;
  status: 'Connected' | 'Disconnected' | 'Connecting';
}

export interface CpeDevice {
  id: string; // GenieACS _id (ex: 00259E-HG8145V5-...)
  serialNumber: string;
  manufacturer: string;
  modelName: string;
  softwareVersion: string;
  hardwareVersion?: string;
  macAddress?: string;
  ipAddress?: string;
  pppoeUsername?: string;
  subscriberName?: string;
  online: boolean;
  lastInform: string; // ISO date
  registeredAt: string; // ISO date
  optical?: OpticalPower;
  wifi?: WifiRadio[];
  wan?: WanInterface[];
  tenantId?: string;
}

export type CpeCommandType =
  | 'reboot'
  | 'factoryReset'
  | 'refreshParameters'
  | 'setParameterValues'
  | 'wifiConfig'
  | 'pingDiagnostic';
