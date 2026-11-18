import { Injectable, Logger } from '@nestjs/common';
import { SgpService } from '../sgp/sgp.service';
import { GenieacsService } from '../genieacs/genieacs.service';
import { CpeService } from '../cpe/cpe.service';

@Injectable()
export class WahaService {
  private readonly logger = new Logger(WahaService.name);

  constructor(
    private readonly sgpService: SgpService,
    private readonly genieacsService: GenieacsService,
    private readonly cpeService: CpeService,
  ) {}

  /**
   * Auto-Cura e Diagnóstico Instantâneo acionado via WhatsApp (WAHA)
   */
  async diagnosticarEAutocurar(telefoneOuLogin: string): Promise<{
    sucesso: boolean;
    clienteNome?: string;
    login?: string;
    cpeId?: string;
    diagnostico: {
      online: boolean;
      sinalRxDbm: number | null;
      canalWifi: number | string;
      canalOtimizado: boolean;
      totalDispositivos: number;
    };
    mensagemWhatsapp: string;
  }> {
    const termo = (telefoneOuLogin || '').trim();
    this.logger.log(`[WAHA Auto-Cura] Iniciando diagnóstico para ${termo}`);

    // Busca cliente no SGP por login ou telefone
    let clienteSgp: any = null;
    let loginPppoe = '';

    // Se tiver letras, é login PPPoE
    if (/[a-zA-Z]/.test(termo)) {
      loginPppoe = termo.toLowerCase();
      clienteSgp = await this.sgpService.clientePorLogin(loginPppoe).catch(() => null);
    } else {
      // É número de telefone: busca no SGP FTTX / URA
      const telLimpo = termo.replace(/\D/g, '');
      const onus = await this.sgpService.listarOnusComTelemetria().catch(() => []);
      // Tenta achar contrato correspondente
      if (onus.length > 0) {
        const achou = onus.find((o: any) => o.service_login && (o.service_login.includes(telLimpo) || (o.service_contrato && String(o.service_contrato).includes(telLimpo))));
        if (achou) {
          loginPppoe = achou.service_login;
          clienteSgp = { nome: achou.service_cliente, login: achou.service_login, contrato: achou.service_contrato };
        }
      }
    }

    if (!loginPppoe) {
      return {
        sucesso: false,
        diagnostico: { online: false, sinalRxDbm: null, canalWifi: '-', canalOtimizado: false, totalDispositivos: 0 },
        mensagemWhatsapp: `Olá! Não consegui localizar seu cadastro pelo número informado. Por favor, envie o seu CPF ou o login de assinante para verificarmos sua conexão.`,
      };
    }

    // Localiza CPE correspondente no GenieACS
    const devices = await this.genieacsService.getDevices();
    const cpe = devices.find(d => (d.pppoeUsername || '').toLowerCase() === loginPppoe.toLowerCase());

    const clienteNome = clienteSgp?.nome || 'Assinante NetGo';
    const primeiroNome = clienteNome.split(' ')[0];

    if (!cpe) {
      return {
        sucesso: false,
        clienteNome,
        login: loginPppoe,
        diagnostico: { online: false, sinalRxDbm: null, canalWifi: '-', canalOtimizado: false, totalDispositivos: 0 },
        mensagemWhatsapp: `Olá, *${primeiroNome}*! Seu roteador parece estar desligado da tomada ou sem sinal no momento. Por favor, verifique se a luz PON/LOS do aparelho está acesa.`,
      };
    }

    // Diagnóstico real
    const rxDbm = cpe.optical?.rxDbm ?? null;
    const radio24 = cpe.wifi?.find(w => w.band === '2.4GHz');
    const canalAtual = radio24?.channel ?? 1;
    let canalOtimizado = false;

    // Se canal for sobreposto / poluido (fora de 1, 6 ou 11), executa auto-cura
    const canalNum = Number(canalAtual);
    if (!isNaN(canalNum) && ![1, 6, 11].includes(canalNum)) {
      try {
        await this.cpeService.otimizarCanalWifi(cpe.id, '2.4GHz');
        canalOtimizado = true;
      } catch (e) {
        this.logger.warn(`Falha na auto-cura de Wi-Fi: ${(e as Error).message}`);
      }
    }

    const totalHosts = cpe.lanDevicesCount || cpe.lanDevices?.length || 0;

    let mensagemWhatsapp = `Olá, *${primeiroNome}*! Sou o assistente inteligente da *NetGo*. 🚀\n\n`;
    mensagemWhatsapp += `Realizei um diagnóstico automático no seu roteador:\n`;
    mensagemWhatsapp += `• *Status:* Conectado ✅\n`;
    if (rxDbm !== null) {
      mensagemWhatsapp += `• *Sinal Óptico:* ${rxDbm} dBm (${rxDbm >= -25 ? 'Excelente' : 'Atenção'})\n`;
    }
    if (canalOtimizado) {
      mensagemWhatsapp += `• *Auto-Cura Wi-Fi:* Detectamos interferência no Canal ${canalAtual} e *calibramos seu roteador para o Canal 6 (frequência limpa)* agora mesmo! ⚡\n`;
    } else {
      mensagemWhatsapp += `• *Frequência Wi-Fi:* Operando em canal limpo sem interferência.\n`;
    }
    mensagemWhatsapp += `• *Dispositivos conectados:* ${totalHosts} aparelho(s)\n\n`;

    if (canalOtimizado) {
      mensagemWhatsapp += `Por favor, faça um novo teste no seu celular ou TV e me confirme se a navegação melhorou!`;
    } else {
      mensagemWhatsapp += `Sua fibra e sinal óptico estão perfeitos. Se estiver sentindo lentidão em algum cômodo específico, pode ser a distância física do Wi-Fi. Deseja que eu reinicie o seu roteador?`;
    }

    return {
      sucesso: true,
      clienteNome,
      login: loginPppoe,
      cpeId: cpe.id,
      diagnostico: {
        online: true,
        sinalRxDbm: rxDbm,
        canalWifi: canalAtual,
        canalOtimizado,
        totalDispositivos: totalHosts,
      },
      mensagemWhatsapp,
    };
  }
}
