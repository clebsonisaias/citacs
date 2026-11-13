import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  CpeDevice,
  AiDiagnosticResult,
  AiSuggestedAction,
  AiChatMessage,
} from '@citacs/shared';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log('Provedor de IA OpenAI inicializado com sucesso.');
    } else {
      this.logger.warn(
        'OPENAI_API_KEY não definida. Usando motor analítico heurístico local como fallback.'
      );
    }
  }

  /**
   * Diagnostica uma CPE com base em seus parâmetros TR-069
   */
  async diagnoseCpe(cpe: CpeDevice): Promise<AiDiagnosticResult> {
    const issues: string[] = [];
    const suggestedActions: AiSuggestedAction[] = [];
    let severity: AiDiagnosticResult['severity'] = 'healthy';

    // 1. Análise de Sinal Óptico
    const rx = cpe.optical?.rxDbm;
    if (rx !== null && rx !== undefined) {
      if (rx < -27.0) {
        severity = 'critical';
        issues.push(
          `Atenuação óptica crítica: Sinal Rx em ${rx} dBm (abaixo do limiar aceitável de -25 dBm). Alto risco de perda de pacotes e desautenticação GPON.`
        );
        suggestedActions.push({
          id: 'action-fiber-check',
          title: 'Ordem de Reparo de Fibra',
          description: 'Enviar equipe para limpeza de conector ou fusão na CTO.',
          commandType: 'externalDispatch',
          parameters: { reason: 'optical_loss', rxDbm: rx },
          riskLevel: 'low',
        });
      } else if (rx < -24.5) {
        if ((severity as string) !== 'critical') severity = 'warning';
        issues.push(
          `Atenuação óptica em alerta: Sinal Rx em ${rx} dBm. Próximo ao limite operacional.`
        );
      } else if (rx > -8.0) {
        if ((severity as string) !== 'critical') severity = 'warning';
        issues.push(
          `Saturação de receptor óptico: Sinal Rx muito alto (${rx} dBm). Possível ausência de splitter na rede PON.`
        );
      }
    }

    // 2. Análise de Status de Conexão
    if (!cpe.online) {
      severity = 'critical';
      issues.push(
        `Dispositivo Offline: Último contato TR-069 registrado em ${new Date(cpe.lastInform).toLocaleString('pt-BR')}.`
      );
      suggestedActions.push({
        id: 'action-ping-gateway',
        title: 'Verificar Rota de Rede',
        description: 'Tentar comunicação direta via ICMP no IP da WAN.',
        commandType: 'pingDiagnostic',
        parameters: { target: cpe.ipAddress },
        riskLevel: 'low',
      });
    }

    // 3. Análise de Wi-Fi
    if (cpe.wifi && cpe.wifi.length > 0) {
      const radio24 = cpe.wifi.find((w) => w.band === '2.4GHz');
      if (radio24 && radio24.enabled) {
        if (radio24.channel === 12 || radio24.channel === 13) {
          issues.push(
            `Canal Wi-Fi 2.4GHz (${radio24.channel}) pode ser incompatível com dispositivos legados.`
          );
          suggestedActions.push({
            id: 'action-fix-wifi-channel',
            title: 'Mudar Canal 2.4GHz para Automático/Canal 6',
            description: 'Redefinir o canal para o padrão mais estável.',
            commandType: 'wifiConfig',
            parameters: { band: '2.4GHz', channel: 6 },
            riskLevel: 'low',
          });
        }
      }
    }

    // Ação comum: Reboot preventivo se houver instabilidade
    if (severity === 'warning' || severity === 'critical') {
      suggestedActions.push({
        id: 'action-reboot',
        title: 'Reiniciar Dispositivo (Reboot)',
        description: 'Enviar comando TR-069 para reinicialização suave da ONT.',
        commandType: 'reboot',
        parameters: { cpeId: cpe.id },
        riskLevel: 'medium',
      });
    }

    // Se temos OpenAI configurada, enriquecemos a análise com LLM
    if (this.openai) {
      try {
        const prompt = `Você é um engenheiro de NOC especializado em redes GPON, TR-069 e Wi-Fi de provedores de internet (ISPs).
Analise os dados desta ONT e emita um laudo técnico conciso em português do Brasil:
- Fabricante/Modelo: ${cpe.manufacturer} ${cpe.modelName}
- Serial: ${cpe.serialNumber}
- Status: ${cpe.online ? 'Online' : 'Offline'}
- Último Inform: ${cpe.lastInform}
- Potência Óptica Rx: ${cpe.optical?.rxDbm ?? 'N/D'} dBm
- Potência Óptica Tx: ${cpe.optical?.txDbm ?? 'N/D'} dBm
- Wi-Fi Configurado: ${JSON.stringify(cpe.wifi)}
- Problemas já identificados: ${issues.join(' | ') || 'Nenhum aparente'}

Retorne um resumo de 2 a 3 parágrafos explicando a causa raiz e o impacto para a experiência de navegação do cliente.`;

        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 300,
        });

        const rootCauseAnalysis = completion.choices[0]?.message?.content || 'Análise automática indisponível.';

        return {
          summary:
            severity === 'healthy'
              ? 'Dispositivo operando em parâmetros ideais de sinal óptico e conectividade.'
              : `Atenção requerida: ${issues.length} problema(s) detectado(s).`,
          severity,
          identifiedIssues: issues.length ? issues : ['Nenhum problema anômalo detectado.'],
          rootCauseAnalysis,
          suggestedActions,
          generatedReport: `Relatório Técnico de Diagnóstico CITacs - ONT ${cpe.serialNumber}\nStatus: ${severity.toUpperCase()}\n\n${rootCauseAnalysis}`,
          analyzedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        this.logger.error(`Erro ao consultar OpenAI: ${err.message}`);
      }
    }

    // Fallback heurístico inteligente
    const summary =
      severity === 'healthy'
        ? 'Dispositivo operando em parâmetros ideais de sinal óptico e conectividade.'
        : `Atenção requerida: ${issues.length} apontamento(s) de telemetria.`;

    const rootCauseAnalysis =
      severity === 'healthy'
        ? 'Nenhuma anomalia de sinal óptico ou de canal Wi-Fi detectada. A ONT está respondendo aos períodos normais de Inform.'
        : `Identificamos que os principais parâmetros afetados são:\n${issues.map((i) => `• ${i}`).join('\n')}\nRecomenda-se executar as ações sugeridas abaixo para normalizar a conexão.`;

    return {
      summary,
      severity,
      identifiedIssues: issues.length ? issues : ['Sem anomalias registradas.'],
      rootCauseAnalysis,
      suggestedActions,
      generatedReport: `Laudo Técnico CITacs (Heurística Local)\nSerial: ${cpe.serialNumber}\nGravidade: ${severity.toUpperCase()}\n${rootCauseAnalysis}`,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Chat interativo com o Copilot sobre um dispositivo ou suporte geral
   */
  async chatWithCopilot(messages: AiChatMessage[], cpeContext?: CpeDevice): Promise<AiChatMessage> {
    const systemPrompt = `Você é o Copilot de IA do CITacs, assistente especialista em redes de telecomunicações, GPON, TR-069 e suporte técnico a provedores de internet.
Responda de forma direta, técnica, precisa e prestativa em Português do Brasil.
${cpeContext ? `Contexto atual da CPE em análise:\n${JSON.stringify(cpeContext, null, 2)}` : ''}`;

    if (this.openai) {
      try {
        const formattedMessages: OpenAI.ChatCompletionMessageParam[] = [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          })),
        ];

        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: formattedMessages,
          temperature: 0.5,
        });

        const replyContent = completion.choices[0]?.message?.content || 'Desculpe, não consegui processar a resposta.';

        return {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: replyContent,
          timestamp: new Date().toISOString(),
        };
      } catch (err: any) {
        this.logger.error(`Erro no chat OpenAI: ${err.message}`);
      }
    }

    // Fallback de chat se OpenAI não estiver configurada
    const lastUserMessage = messages[messages.length - 1]?.content.toLowerCase() || '';
    let reply = 'Estou operando no modo de análise local. ';

    if (lastUserMessage.includes('sinal') || lastUserMessage.includes('potencia') || lastUserMessage.includes('optico')) {
      reply += `O sinal óptico da ONT está em ${cpeContext?.optical?.rxDbm ?? 'N/D'} dBm. Valores entre -8 e -24.5 dBm são considerados ideais em redes GPON classe B+/C+.`;
    } else if (lastUserMessage.includes('wifi') || lastUserMessage.includes('wi-fi') || lastUserMessage.includes('canal')) {
      reply += 'Para redes Wi-Fi 2.4GHz, os únicos canais que não sofrem sobreposição mútua são 1, 6 e 11. Em 5GHz, prefira canais baixos (36-48) para evitar interferências de radar DFS.';
    } else if (lastUserMessage.includes('reiniciar') || lastUserMessage.includes('reboot')) {
      reply += 'Você pode disparar um reboot seguro diretamente pelo botão de Ação Rápida ou aba Diagnóstico. A CPE receberá o comando na próxima sessão TR-069 ou via Connection Request.';
    } else {
      reply += `Recebi sua solicitação: "${messages[messages.length - 1]?.content}". Você pode me perguntar sobre sinais de fibra, diagnóstico de Wi-Fi, comandos TR-069 e procedimentos de atendimento ao cliente.`;
    }

    return {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: reply,
      timestamp: new Date().toISOString(),
    };
  }
}
