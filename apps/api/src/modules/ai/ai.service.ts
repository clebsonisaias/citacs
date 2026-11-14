import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  CpeDevice,
  AiDiagnosticResult,
  AiSuggestedAction,
  AiChatMessage,
} from '@citacs/shared';
import { diagnosticar } from '../genieacs/diagnostico';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI | null = null;
  private readonly allowedOpenAiTenants: string[];

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const allowed = this.configService.get<string>('OPENAI_ALLOWED_TENANTS') || 'citmax,netgo';
    this.allowedOpenAiTenants = allowed
      .toLowerCase()
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.logger.log(
        `Provedor de IA OpenAI inicializado com sucesso. Autorizado exclusivamente para os provedores: [${this.allowedOpenAiTenants.join(', ')}]`
      );
    } else {
      this.logger.warn(
        'OPENAI_API_KEY não definida. Usando motor analítico heurístico local como fallback.'
      );
    }
  }

  /**
   * Verifica se o tenant/provedor é autorizado a consumir o token OpenAI da plataforma.
   * Regra: Exclusivo para CITmax e Netgo (ou conforme OPENAI_ALLOWED_TENANTS).
   */
  public isTenantAllowedForOpenAi(tenantId?: string, cpe?: CpeDevice): boolean {
    if (!this.openai) return false;

    // Se especificado tenantId direto
    if (tenantId) {
      const t = tenantId.toLowerCase().trim();
      return this.allowedOpenAiTenants.some((allowed) => t.includes(allowed));
    }

    // Se o CPE tem tenantId explícito
    if (cpe?.tenantId) {
      const t = cpe.tenantId.toLowerCase().trim();
      return this.allowedOpenAiTenants.some((allowed) => t.includes(allowed));
    }

    // Se o CPE possui indicação de provedor no PPPoE ou subscriber
    if (cpe?.pppoeUsername) {
      const u = cpe.pppoeUsername.toLowerCase();
      if (u.includes('netgo') || u.includes('citmax')) return true;
    }

    // Se não há identificador (uso padrão local/admin), assume o provedor primário CITmax / Netgo
    return this.allowedOpenAiTenants.includes('citmax') || this.allowedOpenAiTenants.includes('netgo');
  }

  /**
   * Diagnostica uma CPE com base em seus parâmetros TR-069
   * e regras avançadas de diagnóstico de Wi-Fi e fibra (baseado em wifi-optimizer).
   */
  async diagnoseCpe(cpe: CpeDevice, params: Record<string, string>, tenantId?: string, planoMbps?: number): Promise<AiDiagnosticResult> {
    const diag = diagnosticar(params, { online: cpe.online, ultimoInform: cpe.lastInform, planoMbps });
    const issues = diag.achados.map((a) => `[${a.camada}] ${a.mensagem}`);
    const gravs = new Set(diag.achados.map((a) => a.gravidade));
    const severity: AiDiagnosticResult['severity'] =
      !cpe.online || gravs.has('alta') ? 'critical' : gravs.has('media') ? 'warning' : gravs.has('baixa') ? 'info' : 'healthy';

    // Só ações com evidência e reversíveis (wifi-optimizer). Nada de reboot como receita genérica.
    const suggestedActions: AiSuggestedAction[] = diag.propostas.map((p) => ({
      id: p.id,
      title: p.titulo,
      description: `${p.motivo} Tradeoff: ${p.tradeoff} Para desfazer: canal ${p.reversao.channel}.`,
      commandType: 'wifiConfig',
      parameters: { ...p.parametros, rollback: p.reversao },
      riskLevel: 'low',
    }));
    if (diag.achados.some((a) => a.camada === 'fibra' && a.gravidade === 'alta')) {
      suggestedActions.push({
        id: 'action-fiber-check',
        title: 'Ordem de Reparo de Fibra',
        description: 'Enviar equipe para limpeza de conector ou fusão na CTO.',
        commandType: 'externalDispatch',
        parameters: { reason: 'optical_loss', rxDbm: cpe.optical?.rxDbm },
        riskLevel: 'low',
      });
    }
    const detalhe = diag.achados
      .map((a) => `• [${a.camada}] ${a.mensagem}\n  Evidência: ${a.evidencia.join('; ')}\n  Próximo teste: ${a.proximoTeste}${a.evitar ? `\n  Evitar: ${a.evitar}` : ''}`)
      .join('\n');

    // Se o provedor (CITmax ou Netgo) for autorizado para OpenAI, enriquecemos com LLM
    const canUseOpenAi = this.isTenantAllowedForOpenAi(tenantId, cpe);
    if (canUseOpenAi && this.openai) {
      try {
        const prompt = `Você é um engenheiro sênior de NOC especializado em redes GPON, TR-069 e otimização avançada de Wi-Fi (metodologia evidence-based wifi-optimizer) para os provedores CITmax e Netgo.
Analise a telemetria desta ONT e emita um laudo técnico conciso em português do Brasil:
- Fabricante/Modelo: ${cpe.manufacturer} ${cpe.modelName}
- Status: ${cpe.online ? 'Online' : 'Offline'}
- Último Inform: ${cpe.lastInform}
- Potência Óptica Rx: ${cpe.optical?.rxDbm ?? 'N/D'} dBm
- Potência Óptica Tx: ${cpe.optical?.txDbm ?? 'N/D'} dBm
- Wi-Fi Configurado: ${JSON.stringify(cpe.wifi)}
- Diagnóstico por camadas (regras locais, já com evidência):
${detalhe || 'Nenhuma anomalia nos dados do ACS.'}

Instruções específicas:
1. Parta do diagnóstico por camadas acima; não contradiga a evidência nem invente medições que não estão aqui.
2. Diga a camada provável, a confiança, a evidência a favor e contra, e o menor próximo teste.
3. Proponha só mudanças que testam a causa, uma por vez, com o valor para desfazer. Não recomende canal universal nem reboot genérico.
4. Retorne de 2 a 3 parágrafos objetivos para o técnico de suporte. Nenhuma configuração foi alterada.`;

        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 350,
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
          generatedReport: `Relatório Técnico NOC (OpenAI - Provedor Autorizado)\nONT: ${cpe.serialNumber}\nStatus: ${severity.toUpperCase()}\n\n${rootCauseAnalysis}`,
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

    const rootCauseAnalysis = detalhe ? `${diag.resumo}\n\n${detalhe}` : diag.resumo;

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
  async chatWithCopilot(
    messages: AiChatMessage[],
    cpeContext?: CpeDevice,
    tenantId?: string
  ): Promise<AiChatMessage> {
    const canUseOpenAi = this.isTenantAllowedForOpenAi(tenantId, cpeContext);

    const systemPrompt = `Você é o Copilot de IA de NOC do CITacs, especialista sênior em redes GPON, TR-069 e otimização avançada de Wi-Fi para os provedores CITmax e Netgo.
Metodologia Técnica (baseada em evidence-based wifi-optimizer):
1. Separação de Camadas: Sempre diferencie problemas de camada Wi-Fi (interferência de canais, canais DFS 5GHz, largura de banda 20/40/80MHz, atenuação de sinal) de problemas de fibra/GPON (Rx < -25 dBm) ou rota WAN/ISP.
2. Segurança e Reversibilidade: Toda alteração proposta de canal ou configuração deve ser justificada por evidência e acompanhada de valor de rollback.
3. Melhores Práticas de Rádio:
   - 2.4GHz: Priorize estabilidade com 20MHz e canais sem sobreposição (1, 6 e 11). Evite canais 12/13.
   - 5GHz: Identifique se canais entre 52 e 140 estão sob interferência de radar DFS e sugira migração para 36-48 ou 149-161.
4. Responda em Português do Brasil com clareza, concisão e foco prático para técnicos de suporte e NOC.
${cpeContext ? `Contexto atual da CPE em análise:\n${JSON.stringify(cpeContext, null, 2)}` : ''}`;

    if (canUseOpenAi && this.openai) {
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

    // Fallback de chat se não autorizado para OpenAI ou chave ausente
    const lastUserMessage = messages[messages.length - 1]?.content.toLowerCase() || '';
    let reply = !canUseOpenAi 
      ? 'Aviso: O motor OpenAI avançado está autorizado exclusivamente para os provedores CITmax e Netgo. Operando em modo heurístico local. '
      : 'Estou operando no modo de análise local. ';

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
