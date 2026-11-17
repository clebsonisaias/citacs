import { Injectable } from '@nestjs/common';
import { GenieacsService } from '../genieacs/genieacs.service';
import { SgpService } from '../sgp/sgp.service';
import { AlertaRadarPreditivo, CpeDevice, RespostaRadarPreditivo, TipoAlertaRadar } from '@citacs/shared';

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

  async getPingDiagnostics(id: string) {
    return this.genieacsService.getPingDiagnostics(id);
  }

  async triggerPingDiagnostics(id: string, host = '8.8.8.8', count = 4) {
    return this.genieacsService.triggerPingDiagnostics(id, host, count);
  }

  async triggerSpeedtest(id: string, downloadUrl?: string) {
    return this.genieacsService.triggerSpeedtest(id, downloadUrl);
  }

  async otimizarCanalWifi(id: string, band: '2.4GHz' | '5GHz') {
    const cpe = await this.genieacsService.getDeviceById(id);
    if (!cpe) throw new Error('CPE não encontrado');

    const radio = cpe.wifi?.find((w) => w.band === band);
    const canalAtual = radio?.channel;

    let canalRecomendado: number = 6;
    let motivo = '';

    if (band === '2.4GHz') {
      if (canalAtual === 6) canalRecomendado = 1;
      else if (canalAtual === 1) canalRecomendado = 11;
      else canalRecomendado = 6;
      motivo = `Canal ${canalRecomendado} selecionado por possuir espectro limpo de 20 MHz sem sobreposição lateral.`;
    } else {
      canalRecomendado = canalAtual === 36 ? 149 : 36;
      motivo = `Canal ${canalRecomendado} selecionado para máxima largura de banda (80/160 MHz) sem restrições DFS de radar.`;
    }

    await this.genieacsService.setWifiConfig(id, band, { channel: canalRecomendado });

    return {
      ok: true,
      band,
      canalAnterior: canalAtual,
      canalNovo: canalRecomendado,
      motivo,
    };
  }

  async obterRadarPreditivo(): Promise<RespostaRadarPreditivo> {
    const cpes = await this.genieacsService.getDevices().catch(() => []);
    const onusSgp = await this.sgpService.listarOnusComTelemetria().catch(() => []);

    const alertas: AlertaRadarPreditivo[] = [];
    const agora = new Date().toISOString();

    // 1. Mapeia CTOs atenuadas para detecção de cluster
    const ctoContagem = new Map<string, number>();
    for (const o of onusSgp) {
      const rx = o.info_rx ? parseFloat(o.info_rx) : null;
      if (rx !== null && rx < -25.0 && o.cto) {
        ctoContagem.set(o.cto, (ctoContagem.get(o.cto) || 0) + 1);
      }
    }

    // 2. Avalia ONUs do SGP
    for (const o of onusSgp) {
      const rx = o.info_rx ? parseFloat(o.info_rx) : null;
      const tx = o.info_tx ? parseFloat(o.info_tx) : null;
      const oltRx = o.info_olt_rx ? parseFloat(o.info_olt_rx) : null;

      if (rx === null) continue;

      if (rx < -25.0) {
        const isCritico = rx < -27.0;
        const totalNaMesmaCto = o.cto ? (ctoContagem.get(o.cto) || 0) : 1;
        const isCluster = totalNaMesmaCto >= 2;

        let tipo: TipoAlertaRadar = isCritico ? 'fibra_critica' : 'fibra_atencao';
        if (isCluster) tipo = 'cluster_cto';

        const severidade = isCritico ? 'critica' : isCluster ? 'alta' : 'media';

        let diagnostico = '';
        let acaoSugerida = '';

        if (isCluster) {
          diagnostico = `Múltiplos clientes (${totalNaMesmaCto}) atenuados na mesma caixa (${o.cto}). Provável problema no splitter óptico ou cabo de distribuição primário.`;
          acaoSugerida = `Enviar equipe para auditar a CTO ${o.cto} e medir a potência de entrada no splitter antes de mexer nas residências dos clientes.`;
        } else if (isCritico) {
          diagnostico = `Atenuação óptica severa (${rx.toFixed(2)} dBm) isolada na residência. Alto risco de perda de sinal (LOS) e desconexão iminente.`;
          acaoSugerida = `Revisar drop de fibra do assinante, conector óptico na CTO ${o.cto || '-'} (porta ${o.ctoport || '-'}) ou fusão no PTO.`;
        } else {
          diagnostico = `Atenuação preventiva (${rx.toFixed(2)} dBm). A conexão opera, mas com margem de segurança reduzida para chuvas ou oscilação térmica.`;
          acaoSugerida = `Agendar limpeza de conector óptico ou inspeção do conector mecânico antes do cliente relatar lentidão.`;
        }

        const nome = o.service_cliente || 'Assinante';
        const msgCliente = `Olá ${nome}, identificamos preventivamente uma pequena oscilação no nível de sinal da fibra que atende seu endereço. Nossa equipe de engenharia já agendou uma verificação sem qualquer custo para garantir que sua internet continue 100% estável.`;

        alertas.push({
          id: `sgp-onu-${o.id}`,
          tipo,
          severidade,
          clienteNome: nome,
          login: o.service_login || o.login || '-',
          contrato: o.service_contrato || o.contrato,
          equipamento: `${o.type || 'ONU'} (${o.phy_addr || 'SN'})`,
          sinalRxDbm: rx,
          sinalTxDbm: tx,
          sinalOltRxDbm: oltRx,
          oltNome: o.olt_name,
          slot: o.slot,
          pon: o.pon,
          cto: o.cto,
          ctoPorta: o.ctoport,
          diagnostico,
          acaoSugerida,
          mensagemClienteSugerida: msgCliente,
          identificadoEm: o.info_date || agora,
        });
      }
    }

    // 3. Avalia CPEs do ACS (Wi-Fi e saturação)
    for (const c of cpes) {
      if (c.wifi && c.wifi.length > 0) {
        for (const w of c.wifi) {
          if (w.band === '2.4GHz' && w.enabled) {
            const ch = typeof w.channel === 'number' ? w.channel : 0;
            const isCanalPoluido = ch > 0 && ch !== 1 && ch !== 6 && ch !== 11;
            const hostsCount = c.hosts?.filter((h) => h.active).length || 0;

            if (isCanalPoluido || (w.connectedClientsCount || 0) >= 12) {
              alertas.push({
                id: `cpe-wifi-${c.id}-${w.index}`,
                tipo: 'wifi_poluido',
                severidade: isCanalPoluido ? 'alta' : 'media',
                clienteNome: c.subscriberName || c.pppoeUsername || 'Cliente ACS',
                login: c.pppoeUsername || '-',
                equipamento: `${c.manufacturer} ${c.modelName}`,
                cpeId: c.id,
                diagnostico: isCanalPoluido
                  ? `Rede 2.4 GHz configurada no Canal ${ch} (canal sobreposto não-padrão). Alto índice de colisão de pacotes com redes vizinhas.`
                  : `Rede 2.4 GHz com alta densidade (${w.connectedClientsCount || hostsCount} dispositivos conectados simultâneos). Risco de travamento de throughput.`,
                acaoSugerida: isCanalPoluido
                  ? `Trocar canal 2.4 GHz imediatamente para canal não-sobreposto (1, 6 ou 11) via CITacs.`
                  : `Habilitar Band Steering ou migrar dispositivos com suporte a 5 GHz para a rede de alta velocidade.`,
                mensagemClienteSugerida: `Olá! Notamos que o canal Wi-Fi do seu roteador está sofrendo interferência de redes vizinhas. Realizamos um ajuste automático de frequência para melhorar o alcance e a velocidade no seu celular.`,
                identificadoEm: agora,
              });
            }
          }
        }
      }
    }

    const ordem: Record<string, number> = { critica: 0, alta: 1, media: 2 };
    alertas.sort((a, b) => {
      const diff = ordem[a.severidade] - ordem[b.severidade];
      if (diff !== 0) return diff;
      return (a.sinalRxDbm ?? 0) - (b.sinalRxDbm ?? 0);
    });

    const criticos = alertas.filter((a) => a.severidade === 'critica').length;
    const atencao = alertas.filter((a) => a.severidade === 'alta' && a.tipo !== 'cluster_cto').length;
    const clustersCto = alertas.filter((a) => a.tipo === 'cluster_cto').length;
    const problemasWifi = alertas.filter((a) => a.tipo === 'wifi_poluido').length;

    return {
      resumo: {
        totalEmRisco: alertas.length,
        criticos,
        atencao,
        clustersCto,
        problemasWifi,
        geradoEm: agora,
      },
      alertas: alertas.slice(0, 100),
    };
  }
}
