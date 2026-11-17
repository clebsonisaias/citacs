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
import { GenieacsService } from '../genieacs/genieacs.service';
import { SgpService } from '../sgp/sgp.service';
import { filtrar, motivoFalhaIa, paraIa } from './copilot-util';

/** Ferramentas do chat. Só leitura: a IA não tem como reiniciar, resetar nem mudar Wi-Fi. */
const FERRAMENTAS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'buscar_roteadores',
      description:
        'Lista os roteadores do ACS com o cliente do SGP (nome, login, plano, se está conectado). ' +
        'Use "texto" para filtrar por nome do cliente, login PPPoE ou serial. Sem texto, lista todos.',
      parameters: { type: 'object', properties: { texto: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'diagnosticar_roteador',
      description:
        'Diagnóstico por camadas (fibra, WAN, Wi-Fi) de um roteador, pelo id que buscar_roteadores devolve. Só lê; não muda nada.',
      parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
  },
];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI | null = null;
  private readonly allowedOpenAiTenants: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly genieacs: GenieacsService,
    private readonly sgp: SgpService,
  ) {
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

  /** Busca roteadores do ACS com o dono pelo SGP. */
  private async buscarRoteadores(texto?: string) {
    const cpes = await this.genieacs.getDevices();
    // ponytail: uma consulta ao SGP por roteador (com cache de 10 min). Serve para dezenas;
    // com a frota inteira no ACS, guardar o vínculo roteador→cliente e buscar nele.
    const lista = await Promise.all(
      cpes.map(async (c) => {
        const info = this.sgp.configurado ? await this.sgp.clienteDoRoteador(c).catch(() => null) : null;
        return paraIa(c, info?.cliente ?? null);
      }),
    );
    return filtrar(lista, texto);
  }

  private async diagnosticarRoteador(id: string) {
    const found = await this.genieacs.getDeviceComParams(String(id).slice(0, 200));
    if (!found) return { erro: 'Roteador não encontrado no ACS.' };
    const planoMbps = await this.sgp.planoMbpsDoCpe(found.cpe);
    const d = diagnosticar(found.params, { online: found.cpe.online, ultimoInform: found.cpe.lastInform, planoMbps });
    return {
      id: found.cpe.id,
      online: found.cpe.online,
      ultimoInform: found.cpe.lastInform,
      rxDbm: found.cpe.optical?.rxDbm ?? null,
      planoMbps: planoMbps ?? null,
      resumo: d.resumo,
      achados: d.achados,
      propostas: d.propostas.map((p) => ({ titulo: p.titulo, motivo: p.motivo, tradeoff: p.tradeoff })),
    };
  }

  private executar(nome: string, args: any): Promise<unknown> {
    if (nome === 'buscar_roteadores') return this.buscarRoteadores(typeof args?.texto === 'string' ? args.texto : undefined);
    if (nome === 'diagnosticar_roteador') return this.diagnosticarRoteador(String(args?.id ?? ''));
    return Promise.resolve({ erro: `Ferramenta desconhecida: ${nome}` });
  }

  /**
   * Chat do Copilot. A IA consulta o ACS e o SGP pelas ferramentas acima, só para leitura.
   */
  async chatWithCopilot(messages: AiChatMessage[], cpeId?: string, tenantId?: string): Promise<AiChatMessage> {
    const resposta = (content: string): AiChatMessage => ({
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
    });
    if (!this.isTenantAllowedForOpenAi(tenantId) || !this.openai) {
      return resposta('O chat está desligado: não há chave da OpenAI configurada no servidor. O botão "Diagnosticar com IA" na página do roteador funciona mesmo assim.');
    }

    const systemPrompt = `Você é o Copilot de NOC do CITacs, da NetGo: especialista em GPON, TR-069 e Wi-Fi. Responda em português do Brasil, curto e prático, para técnicos de suporte.
Dados:
- Use buscar_roteadores para achar um roteador pelo nome do cliente, login ou serial, ou para listar a rede. Use diagnosticar_roteador para ver sinal, WAN e Wi-Fi de um roteador.
- Nunca invente cliente, medição ou estado: se não consultou, consulte; se a ferramenta não trouxe, diga que não sabe.
- Se a busca trouxer mais de um cliente parecido, pergunte qual é. Se loginConfere for false, avise que o vínculo pelo IP pode estar desatualizado.
- Você só lê. Não reinicia, não reseta e não muda Wi-Fi. Se pedirem isso, diga que não pode e indique o botão na página do roteador ("Reiniciar ONT" ou a área de Wi-Fi), sem pedir mais dados.
Método:
- Separe as camadas: Wi-Fi (canal, DFS em 52-140, largura, sinal), fibra (Rx abaixo de -25 dBm é ruim) e WAN/ISP.
- Toda mudança sugerida precisa de evidência e do valor para desfazer. Nada de reboot como receita genérica nem canal universal.
${cpeId ? `\nO técnico está com a página deste roteador aberta: id "${cpeId.replace(/[^\w.%:-]/g, '').slice(0, 200)}". "Esse roteador" ou "esse cliente" se refere a ele.` : ''}`;

    // Só user/assistant vêm do navegador: um "system" ali seria o usuário reescrevendo as regras.
    const conversa: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-20)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: String(m.content ?? '') })),
    ];

    try {
      for (let rodada = 0; rodada < 5; rodada++) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: conversa,
          tools: FERRAMENTAS,
          temperature: 0.3,
        });
        const msg = completion.choices[0]?.message;
        if (!msg?.tool_calls?.length) return resposta(msg?.content || 'Não consegui montar uma resposta.');

        conversa.push(msg);
        for (const chamada of msg.tool_calls) {
          let args: unknown = {};
          try {
            args = JSON.parse(chamada.function.arguments || '{}');
          } catch {
            /* argumento inválido vira objeto vazio */
          }
          const resultado = await this.executar(chamada.function.name, args).catch((e: Error) => ({ erro: e.message }));
          conversa.push({ role: 'tool', tool_call_id: chamada.id, content: JSON.stringify(resultado) });
        }
      }
      return resposta('A consulta ficou longa demais. Tente perguntar sobre um cliente ou roteador por vez.');
    } catch (err: any) {
      this.logger.error(`Erro no chat OpenAI: ${err.message}`);
      return resposta(`Não consegui responder agora: ${motivoFalhaIa(err.message)}. O botão "Diagnosticar com IA" na página do roteador funciona mesmo assim.`);
    }
  }
}
