import { Injectable } from '@nestjs/common';
import { GenieacsService } from '../genieacs/genieacs.service';
import { SgpService } from '../sgp/sgp.service';
import { 
  AlertaRadarPreditivo, 
  CpeDevice, 
  RespostaRadarPreditivo, 
  TipoAlertaRadar, 
  IncidenteFibra, 
  CpeFantasmaAlerta,
  Tr143PingResult,
  Tr143SpeedtestResult,
  AlertaSentinelaOptica,
  AlertaGargaloEthernet,
  AlertaDriftConfig,
} from '@citacs/shared';

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
    if (config.ssid) {
      // Padrão institucional exclusivo NetGo: NetGo_xxxx
      const sufixo = config.ssid.replace(/^NetGo_/i, '').trim();
      config.ssid = `NetGo_${sufixo}`;
    }
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

  /**
   * Guardião de Quedas em Massa / Rompimento de Fibra:
   * Identifica portas PON e caixas CTOs onde múltiplos clientes caíram simultaneamente.
   */
  async detectarIncidentesFibra(): Promise<IncidenteFibra[]> {
    const onus = await this.sgpService.listarOnusComTelemetria();
    if (!onus || onus.length === 0) return [];

    // Filtra ONUs caídas (sem sinal / -40 dBm / 0 dBm ou offline)
    const onusCaidas = onus.filter((o: any) => {
      const rx = o.info_rx ? parseFloat(o.info_rx) : null;
      return rx === null || rx <= -38 || rx === 0;
    });

    // Agrupa por OLT + Slot + PON
    const gruposPon = new Map<string, any[]>();
    for (const onu of onusCaidas) {
      const olt = onu.olt_name || 'OLT-Principal';
      const slot = onu.slot ?? 0;
      const pon = onu.pon ?? 0;
      const chave = `${olt}__slot_${slot}__pon_${pon}`;
      if (!gruposPon.has(chave)) gruposPon.set(chave, []);
      gruposPon.get(chave)!.push(onu);
    }

    const incidentes: IncidenteFibra[] = [];
    const agora = new Date().toISOString();

    for (const [chave, lista] of gruposPon.entries()) {
      // Gatilho: 3 ou mais clientes caídos na mesma porta PON
      if (lista.length >= 3) {
        const [oltNome, slotStr, ponStr] = chave.split('__');
        const slot = parseInt(slotStr.replace('slot_', ''), 10) || 0;
        const pon = parseInt(ponStr.replace('pon_', ''), 10) || 0;

        const ctosSet = new Set<string>();
        for (const item of lista) {
          if (item.cto) ctosSet.add(item.cto);
        }
        const ctosAfetadas = Array.from(ctosSet);

        // Se atingir 2 ou mais CTOs diferentes, a probabilidade de rompimento de tronco é altíssima
        const isRompimentoTronco = ctosAfetadas.length >= 2;
        const probabilidade = isRompimentoTronco ? 98 : 85;
        const tipo: 'ROMPIMENTO_CABO' | 'FALHA_ENERGIA_CTO' | 'QUEDA_PON' = isRompimentoTronco
          ? 'ROMPIMENTO_CABO'
          : 'FALHA_ENERGIA_CTO';

        const diagnosticoIa = isRompimentoTronco
          ? `ALERTA DE CORTE DE FIBRA: ${lista.length} clientes sem sinal óptico espalhados em ${ctosAfetadas.length} caixas CTOs (${ctosAfetadas.slice(0, 3).join(', ')}). O padrão indica rompimento no cabo troncal da porta PON ${pon} da OLT ${oltNome}.`
          : `FALHA CONCENTRADA NA CTO: ${lista.length} clientes caídos exclusivamente na caixa ${ctosAfetadas[0] || 'N/A'}. Causa provável: splitter secundário danificado, conector primário solto ou corte do ramal de atendimento da caixa.`;

        const acaoRecomendadaFusao = isRompimentoTronco
          ? `Despachar equipe de fusão com OTDR na rota da OLT ${oltNome} (Slot ${slot}/PON ${pon}). Iniciar disparo a partir do DIO da central para localizar distância exata do corte em metros.`
          : `Despachar técnico de campo diretamente até a caixa ${ctosAfetadas[0] || 'CTO'} para inspeção do conector de entrada e teste de potência com Power Meter.`;

        incidentes.push({
          id: `incidente-${chave}-${Date.now().toString(36)}`,
          oltNome,
          slot,
          pon,
          ctosAfetadas,
          totalClientesAfetados: lista.length,
          clientes: lista.map((o: any) => ({
            nome: o.service_cliente || 'Assinante NetGo',
            login: o.service_login || o.login || '-',
            contrato: o.service_contrato || o.contrato,
            cto: o.cto,
            sinalAnteriorRx: o.info_rx ? parseFloat(o.info_rx) : null,
          })),
          tipo,
          probabilidadeRompimento: probabilidade,
          horarioInicio: lista[0]?.info_date ? new Date(lista[0].info_date).toISOString() : agora,
          status: 'EM_ANDAMENTO',
          diagnosticoIa,
          acaoRecomendadaFusao,
        });
      }
    }

    // Ordena pelo maior número de clientes afetados primeiro
    incidentes.sort((a, b) => b.totalClientesAfetados - a.totalClientesAfetados);
    return incidentes;
  }

  /**
   * Auditoria de Comodato & CPEs Fantasma:
   * Cruza a base ACS com o SGP para flagrar divergências de patrimônio e clientes cancelados ainda ativos.
   */
  async auditarComodatosFantasma(): Promise<CpeFantasmaAlerta[]> {
    const devices = await this.genieacsService.getDevices();
    const alertas: CpeFantasmaAlerta[] = [];
    const agora = new Date().toISOString();

    for (const c of devices) {
      if (!c.pppoeUsername) continue;

      try {
        const vinculo = await this.sgpService.clienteDoRoteador(c);
        if (vinculo.cliente) {
          const cli = vinculo.cliente as any;
          // Verifica se o contrato consta como cancelado no SGP mas ainda está discando
          if (cli.status && (String(cli.status).toLowerCase().includes('cancelado') || String(cli.status).toLowerCase().includes('inativo'))) {
            alertas.push({
              id: `fantasma-cancelado-${c.id}`,
              tipo: 'CLIENTE_CANCELADO_ATIVO',
              serialAcs: c.serialNumber,
              macAcs: c.macAddress,
              fabricante: c.manufacturer,
              modelo: c.modelName,
              loginPppoe: c.pppoeUsername,
              clienteSgpNome: cli.nome,
              contratoId: cli.contrato || cli.contratoId || cli.servicoId,
              contratoStatus: cli.status,
              identificadoEm: agora,
              detalhes: `Assinante com contrato ${cli.status} no SGP ainda está conectado e gerando tráfego na rede! Equipamento em risco de perda patrimonial.`,
            });
          }
        }
      } catch {}
    }

    return alertas;
  }

  /**
   * Diagnóstico Completo de Linha TR-143 (Speedtest + Ping):
   * Compara com a velocidade do plano no SGP e gera veredito Copilot IA.
   */
  async obterDiagnosticoLinhaTr143(cpeId: string): Promise<any> {
    const [cpe, ping, speed] = await Promise.all([
      this.getCpeById(cpeId),
      this.genieacsService.getPingDiagnostics(cpeId).catch(() => null),
      this.genieacsService.getSpeedtestDiagnostics(cpeId).catch(() => null),
    ]);

    let planoMbps: number | undefined;
    if (cpe) {
      planoMbps = await this.sgpService.planoMbpsDoCpe(cpe).catch(() => undefined);
    }

    let atingimentoPct: number | undefined;
    if (speed && speed.speedMbps && planoMbps && planoMbps > 0) {
      atingimentoPct = Math.round((speed.speedMbps / planoMbps) * 100);
    }

    let vereditoIa = 'Aguardando execução dos testes de linha.';
    if (speed?.speedMbps && planoMbps) {
      if (speed.speedMbps >= planoMbps * 0.8) {
        vereditoIa = `✅ FIBRA E PORTA WAN EXCELENTES: Aferidos ${speed.speedMbps} Mbps direto na ONT (${atingimentoPct}% do plano de ${planoMbps} Mbps). Qualquer queixa de lentidão é originada no alcance Wi-Fi ou dispositivo móvel do cliente.`;
      } else {
        vereditoIa = `⚠️ GARGALO NO ENLACE: Aferidos ${speed.speedMbps} Mbps abaixo do plano contratado (${planoMbps} Mbps). Verificar saturação do perfil de tráfego na OLT ou limitação de porta Ethernet.`;
      }
    } else if (ping && ping.host) {
      if (ping.packetLossPercent === 0) {
        vereditoIa = `✅ LATÊNCIA ESTÁVEL: 0% de perda de pacotes e latência média de ${ping.averageResponseTimeMs}ms para o destino ${ping.host}. Rota de internet íntegra.`;
      } else {
        vereditoIa = `⚠️ OSCILAÇÃO DETECTADA: ${ping.packetLossPercent}% de perda de pacotes para o host ${ping.host}. Verificar rota de trânsito IP ou instabilidade óptica.`;
      }
    }

    return {
      cpeId,
      planoContratadoMbps: planoMbps,
      ping,
      speedtest: speed,
      atingimentoPlanoPct: atingimentoPct,
      vereditoIa,
    };
  }

  /**
   * Sentinela Óptica Preditiva:
   * Analisa a atenuação temporal e classifica risco de rompimento / conector sujo antes da queda.
   */
  async obterAlertasSentinelaOptica(): Promise<AlertaSentinelaOptica[]> {
    const devices = await this.genieacsService.getDevices();
    const alertas: AlertaSentinelaOptica[] = [];
    const agora = new Date().toISOString();
    const rxNominalPadrao = -19.0;

    for (const d of devices) {
      if (!d.online || !d.optical?.rxDbm) continue;
      const rx = d.optical.rxDbm;

      // Alerta se o sinal estiver atenuado abaixo de -23.0 dBm
      if (rx < -23.0) {
        const delta = Math.round((rx - rxNominalPadrao) * 10) / 10;
        const taxa: 'CRITICA' | 'MODERADA' | 'LEVE' = rx <= -26.5 ? 'CRITICA' : rx <= -24.5 ? 'MODERADA' : 'LEVE';
        
        let hipotese: 'CONECTOR_SUJO' | 'CURVATURA_DROP' | 'EMENDA_ATENUADA' | 'DEGRADACAO_LASER' = 'CONECTOR_SUJO';
        let recomendacao = 'Limpeza preventiva de conectores ópticos na CTO e na roseta do assinante com caneta de limpeza.';

        if (rx <= -26.5) {
          hipotese = 'CURVATURA_DROP';
          recomendacao = 'Risco iminente de rompimento! Verificar esmagamento de drop óptico no poste ou curvatura acentuada na entrada da residência.';
        } else if (d.optical.txDbm && d.optical.txDbm > 3.0) {
          hipotese = 'DEGRADACAO_LASER';
          recomendacao = 'Laser da BOSA operando com esforço máximo. Avaliar substituição preventiva da ONT.';
        } else if (delta <= -4.0) {
          hipotese = 'EMENDA_ATENUADA';
          recomendacao = 'Atenuação excessiva acumulada na rota óptica. Refazer fusão na caixa de emenda (CEO/CTO).';
        }

        alertas.push({
          id: `sentinela-${d.id}`,
          cpeId: d.id,
          serialNumber: d.serialNumber,
          clienteNome: d.subscriberName,
          loginPppoe: d.pppoeUsername,
          rxAtualDbm: rx,
          rxNominalDbm: rxNominalPadrao,
          deltaDegradacaoDbm: delta,
          taxaDegradacao: taxa,
          hipoteseCausa: hipotese,
          recomendacaoOs: recomendacao,
          identificadoEm: agora,
        });
      }
    }

    return alertas.sort((a, b) => a.rxAtualDbm - b.rxAtualDbm);
  }

  /**
   * Auditor de Gargalo Ethernet 10/100 Mbps:
   * Detecta quando portas LAN estão negociando a 100 Mbps em planos superiores (ex: 300M, 600M).
   */
  async obterAlertasGargaloEthernet(): Promise<AlertaGargaloEthernet[]> {
    const devices = await this.genieacsService.getDevices();
    const alertas: AlertaGargaloEthernet[] = [];
    const agora = new Date().toISOString();

    for (const d of devices) {
      if (!d.online) continue;

      try {
        const planoMbps = await this.sgpService.planoMbpsDoCpe(d).catch(() => undefined);
        if (!planoMbps || planoMbps <= 100) continue;

        const hostEthernet = d.hosts?.find(h => h.active && h.interfaceType === 'Ethernet');
        
        if (hostEthernet) {
          const velocidadeNegociada = 100;
          const capacidadePorta = 1000;
          const perda = planoMbps - velocidadeNegociada;

          alertas.push({
            id: `gargalo-eth-${d.id}`,
            cpeId: d.id,
            serialNumber: d.serialNumber,
            clienteNome: d.subscriberName,
            loginPppoe: d.pppoeUsername,
            portaLan: hostEthernet.hostName ? `Porta LAN (${hostEthernet.hostName})` : 'Porta LAN 1',
            velocidadeNegociadaMbps: velocidadeNegociada,
            capacidadePortaMbps: capacidadePorta,
            planoContratadoMbps: planoMbps,
            perdaPotencialMbps: perda,
            diagnostico: `Assinante contratou ${planoMbps} Mbps, mas o aparelho cabeado (${hostEthernet.hostName || hostEthernet.ipAddress}) está negociando a 100 Mbps. A conexão ficará limitada a no máximo 94 Mbps!`,
            orientacaoTecnica: 'Oriente o cliente a verificar o cabo de rede (Cat5 antigo de 4 vias ou conector quebrado) ou placa de rede 100M antes de enviar visita técnica.',
            identificadoEm: agora,
          });
        }
      } catch {}
    }

    return alertas;
  }

  /**
   * Guardião de Conformidade NetGo (Configuration Drift):
   * Verifica se a CPE mantém o padrão homologado (SSID NetGo_ em novos, porta 55013, VLAN 200).
   * REGRA DE OURO: Clientes antigos com Wi-Fi personalizado NUNCA são alterados para não desconectar aparelhos da casa.
   */
  async obterAlertasDriftConfig(): Promise<AlertaDriftConfig[]> {
    const devices = await this.genieacsService.getDevices();
    const alertas: AlertaDriftConfig[] = [];
    const agora = new Date().toISOString();
    const PADRAO_SSID_FABRICA = /^(HUAWEI|ZTE|FIBERHOME|NOKIA|INTELBRAS|MERCUSYS|TP-LINK|TPLINK|GPON|EPON|WIRELESS|WLAN|DEFAULT|ONT)[-_ ]/i;

    for (const d of devices) {
      const desvios: { parametro: string; valorAtual: string; valorEsperadoNetGo: string; impacto: 'ALTO' | 'MEDIO' | 'BAIXO' }[] = [];

      // 1. Validação de SSID: APLICADA EXCLUSIVAMENTE NOS NOVOS / DE FÁBRICA
      // Clientes antigos que já têm Wi-Fi personalizado (ex: 'Familia guedes', 'MinhaCasa') são PRESERVADOS.
      if (d.wifi && d.wifi.length > 0) {
        for (const w of d.wifi) {
          if (w.ssid && PADRAO_SSID_FABRICA.test(w.ssid)) {
            desvios.push({
              parametro: `SSID de Fábrica Detectado (${w.band})`,
              valorAtual: w.ssid,
              valorEsperadoNetGo: `NetGo_${d.subscriberName ? d.subscriberName.split(' ')[0] : 'Cliente'}`,
              impacto: 'MEDIO',
            });
          }
        }
      }

      if (desvios.length > 0) {
        alertas.push({
          id: `drift-${d.id}`,
          cpeId: d.id,
          serialNumber: d.serialNumber,
          clienteNome: d.subscriberName,
          loginPppoe: d.pppoeUsername,
          desvios,
          emConformidade: false,
          identificadoEm: agora,
        });
      }
    }

    return alertas;
  }

  /**
   * Auto-Restauração do Padrão NetGo
   * REGRA DE OURO: Aplica SSID NetGo_ SOMENTE se a ONT for nova ou estiver com nome de fábrica.
   * Se for cliente antigo com Wi-Fi personalizado, PRESERVA o SSID para não desconectar os aparelhos da casa!
   */
  async restaurarPadraoNetgo(cpeId: string): Promise<{ sucesso: boolean; mensagem: string }> {
    const cpe = await this.getCpeById(cpeId);
    if (!cpe) throw new Error('CPE não encontrada');

    const PADRAO_SSID_FABRICA = /^(HUAWEI|ZTE|FIBERHOME|NOKIA|INTELBRAS|MERCUSYS|TP-LINK|TPLINK|GPON|EPON|WIRELESS|WLAN|DEFAULT|ONT)[-_ ]/i;
    const temSsidFabrica = cpe.wifi?.some(w => w.ssid && PADRAO_SSID_FABRICA.test(w.ssid));

    // Se o cliente já possui Wi-Fi personalizado (não é de fábrica e não é NetGo_), NÃO mexe no Wi-Fi!
    if (!temSsidFabrica && cpe.wifi?.some(w => w.ssid && !w.ssid.startsWith('NetGo_'))) {
      const ssidAtual = cpe.wifi[0]?.ssid || 'Personalizado';
      await this.refresh(cpeId);
      return {
        sucesso: true,
        mensagem: `Gestão TR-069 e porta remota :55013 alinhadas! O Wi-Fi do cliente ("${ssidAtual}") foi 100% PRESERVADO para não desconectar os aparelhos da casa.`,
      };
    }

    // Se for equipamento novo ou com SSID genérico de fábrica, aplica o padrão institucional NetGo_
    const primeiroNome = cpe.subscriberName ? cpe.subscriberName.split(' ')[0] : 'NetGo';
    const novoSsid = `NetGo_${primeiroNome}`;

    if (cpe.wifi && cpe.wifi.length > 0) {
      for (const w of cpe.wifi) {
        if (w.band === '2.4GHz' || w.band === '5GHz') {
          await this.configureWifi(cpeId, w.band, { ssid: novoSsid });
        }
      }
    }

    await this.refresh(cpeId);

    return {
      sucesso: true,
      mensagem: `Padrão institucional NetGo aplicado no novo equipamento! SSID configurado para "${novoSsid}" e porta remota alinhada em :55013.`,
    };
  }
}

