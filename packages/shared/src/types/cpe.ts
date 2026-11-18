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

export interface ZtpProvisionInfo {
  autorizado: boolean;
  motivo?: string;
  serial?: string;
  mac?: string;
  clienteNome?: string;
  contratoId?: number | string;
  pppoeLogin?: string;
  pppoeSenha?: string;
  vlan?: number;
  wifiSsid?: string;
  wifiSenha?: string;
  plano?: string;
  oltNome?: string;
  cto?: string;
}

export interface ZtpRegistroLog {
  id: number | string;
  serial: string;
  mac?: string;
  fabricante?: string;
  modelo?: string;
  clienteNome?: string;
  contratoId?: string;
  pppoeLogin?: string;
  vlan?: number;
  wifiSsid?: string;
  status: 'SUCESSO' | 'PENDENTE_SGP' | 'ERRO';
  detalhes?: string;
  criadoEm: string;
}

export interface IncidenteFibra {
  id: string;
  oltNome: string;
  slot: number;
  pon: number;
  ctosAfetadas: string[];
  totalClientesAfetados: number;
  clientes: {
    nome: string;
    login: string;
    contrato?: string | number;
    cto?: string;
    sinalAnteriorRx?: number | null;
  }[];
  tipo: 'ROMPIMENTO_CABO' | 'FALHA_ENERGIA_CTO' | 'QUEDA_PON';
  probabilidadeRompimento: number;
  horarioInicio: string;
  status: 'EM_ANDAMENTO' | 'NORMALIZADO';
  diagnosticoIa: string;
  acaoRecomendadaFusao: string;
}

export interface Tr143PingResult {
  host: string;
  repeticoes: number;
  sucesso: boolean;
  pacotesEnviados: number;
  pacotesRecebidos: number;
  perdaPct: number;
  latenciaMinMs?: number;
  latenciaMedMs?: number;
  latenciaMaxMs?: number;
  executadoEm: string;
}

export interface Tr143SpeedtestResult {
  sucesso: boolean;
  velocidadeDownloadMbps: number;
  bytesRecebidos: number;
  tempoDecorridoMs: number;
  planoContratadoMbps?: number;
  atingimentoPlanoPct?: number;
  vereditoIa: string;
  executadoEm: string;
}

export interface CpeFantasmaAlerta {
  id: string;
  tipo: 'EQUIPAMENTO_DIVERGENTE' | 'CLIENTE_CANCELADO_ATIVO' | 'SERIAL_NAO_CADASTRADO';
  serialAcs: string;
  macAcs?: string;
  fabricante?: string;
  modelo?: string;
  loginPppoe?: string;
  clienteSgpNome?: string;
  contratoId?: string;
  contratoStatus?: string;
  serialSgpEsperado?: string;
  macSgpEsperado?: string;
  identificadoEm: string;
  detalhes: string;
}

export interface CampanhaFirmware {
  id: string;
  nome: string;
  fabricante: string;
  modelo: string;
  versaoOrigem: string;
  versaoDestino: string;
  arquivoFirmwareUrl: string;
  janelaInicio: string;
  janelaFim: string;
  limitePorHora: number;
  status: 'PLANEJADA' | 'EM_EXECUCAO' | 'CONCLUIDA' | 'PAUSADA';
  totalAlvos: number;
  atualizadosComSucesso: number;
  falhas: number;
  criadoEm: string;
}
