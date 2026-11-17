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

export interface LanDevice {
  ipAddress: string;
  macAddress: string;
  hostName?: string;
  interfaceType: 'Ethernet' | 'Wi-Fi 2.4GHz' | 'Wi-Fi 5GHz' | 'Wi-Fi' | 'Outro';
  active: boolean;
  leaseTimeRemaining?: number;
  vendorClass?: string;
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
  hosts?: LanDevice[];
  tenantId?: string;
}

export interface PingDiagnosticResult {
  state: string;
  host: string;
  successCount: number;
  failureCount: number;
  averageResponseTimeMs: number;
  minimumResponseTimeMs: number;
  maximumResponseTimeMs: number;
  packetLossPercent: number;
}

export interface OnuBridgeTelemetry {
  encontrado: boolean;
  isBridge: boolean;
  onuId?: number;
  modelo?: string;
  fabricante?: string;
  serial?: string;
  serialFormatado?: string;
  oltNome?: string;
  slot?: number;
  pon?: number;
  onuid?: number;
  vlan?: number;
  cto?: string;
  ctoPorta?: number;
  status?: string;
  sinalRxDbm?: number | null;
  sinalTxDbm?: number | null;
  sinalOltRxDbm?: number | null;
  distanciaMetros?: number | null;
  temperaturaC?: number | null;
  voltagemV?: number | null;
  tempoOnline?: string | null;
  ultimoMotivoQueda?: string | null;
  atualizadoEm?: string | null;
}

export type CpeCommandType =
  | 'reboot'
  | 'factoryReset'
  | 'refreshParameters'
  | 'setParameterValues'
  | 'wifiConfig'
  | 'pingDiagnostic';

export type TipoAlertaRadar =
  | 'fibra_critica'
  | 'fibra_atencao'
  | 'cluster_cto'
  | 'wifi_poluido'
  | 'quedas_frequentes';

export interface AlertaRadarPreditivo {
  id: string;
  tipo: TipoAlertaRadar;
  severidade: 'critica' | 'alta' | 'media';
  clienteNome: string;
  login: string;
  contrato?: string | number;
  equipamento: string;
  cpeId?: string;
  sinalRxDbm?: number | null;
  sinalTxDbm?: number | null;
  sinalOltRxDbm?: number | null;
  oltNome?: string;
  slot?: number;
  pon?: number;
  cto?: string;
  ctoPorta?: number;
  diagnostico: string;
  acaoSugerida: string;
  mensagemClienteSugerida: string;
  identificadoEm: string;
}

export interface ResumoRadarPreditivo {
  totalEmRisco: number;
  criticos: number;
  atencao: number;
  clustersCto: number;
  problemasWifi: number;
  geradoEm: string;
}

export interface RespostaRadarPreditivo {
  resumo: ResumoRadarPreditivo;
  alertas: AlertaRadarPreditivo[];
}
