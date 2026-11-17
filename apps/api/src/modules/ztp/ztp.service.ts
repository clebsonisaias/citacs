import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { ZtpProvisionInfo, ZtpRegistroLog } from '@citacs/shared';
import { SgpService } from '../sgp/sgp.service';
import { GenieacsService } from '../genieacs/genieacs.service';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ztp_logs (
  id serial PRIMARY KEY,
  serial text NOT NULL,
  mac text,
  fabricante text,
  modelo text,
  cliente_nome text,
  contrato_id text,
  pppoe_login text,
  vlan int,
  wifi_ssid text,
  status text NOT NULL,
  detalhes text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ztp_logs_serial ON ztp_logs(serial);
CREATE INDEX IF NOT EXISTS idx_ztp_logs_criado_em ON ztp_logs(criado_em DESC);
`;

@Injectable()
export class ZtpService implements OnModuleDestroy {
  private readonly logger = new Logger(ZtpService.name);
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  private pronto?: Promise<void>;

  constructor(
    private readonly sgpService: SgpService,
    private readonly genieacsService: GenieacsService,
  ) {}

  private db() {
    return (this.pronto ??= this.pool.query(SCHEMA).then(
      () => undefined,
      (e) => {
        this.pronto = undefined;
        throw e;
      },
    ));
  }

  async onModuleDestroy() {
    await this.pool.end().catch(() => undefined);
  }

  /**
   * Resolve credenciais de auto-provisionamento Zero-Touch quando a ONT conecta no ACS.
   */
  async resolverProvisao(params: {
    serial: string;
    mac?: string;
    fabricante?: string;
    modelo?: string;
  }): Promise<ZtpProvisionInfo> {
    await this.db();
    const rawSerial = (params.serial || '').trim();
    const rawMac = (params.mac || '').replace(/[:-]/g, '').toLowerCase().trim();
    const serialLimpo = rawSerial.replace(/[:-]/g, '').toUpperCase();

    this.logger.log(`[ZTP] Requisição de provisionamento recebida - Serial: ${rawSerial}, MAC: ${rawMac || 'N/A'}`);

    // 1. Busca direta ultrarrápida por phy_addr no SGP FTTX (~200ms)
    let onuEncontrada: any = await this.sgpService.buscarOnuPorPhyAddr(rawSerial);
    if (!onuEncontrada && rawMac) {
      onuEncontrada = await this.sgpService.buscarOnuPorPhyAddr(rawMac);
    }

    // 2. Fallback na lista geral caso seja serial truncado ou divergence
    const onus = !onuEncontrada ? await this.sgpService.listarOnusComTelemetria() : [];

    if (onus && onus.length > 0) {
      onuEncontrada = onus.find((onu: any) => {
        const phy = String(onu.phy_addr || '').replace(/[:-]/g, '').toUpperCase();
        if (!phy) return false;

        // Compara direto se o phy_addr bate com o serial
        if (phy === serialLimpo) return true;

        // Decodifica se for hex (ex: 48575443... -> HWTC...)
        let decoded = '';
        if (phy.length >= 8) {
          try {
            decoded = Buffer.from(phy.slice(0, 8), 'hex').toString('utf8').toUpperCase() + phy.slice(8);
          } catch {}
        }

        if (decoded && (decoded === serialLimpo || serialLimpo.includes(decoded) || decoded.includes(serialLimpo))) {
          return true;
        }

        // Se o serial do ACS tiver apenas a parte final (ex: 5A7E8E43)
        if (serialLimpo.length >= 8 && (phy.endsWith(serialLimpo) || (decoded && decoded.endsWith(serialLimpo)))) {
          return true;
        }

        // Se passou MAC, compara com o phy_addr ou campos de mac
        if (rawMac) {
          const phyMac = phy.toLowerCase();
          if (phyMac === rawMac) return true;
        }

        return false;
      });
    }

    // Se NÃO achou a ONU no SGP (o instalador ainda não autorizou ou serial incorreto)
    if (!onuEncontrada || !onuEncontrada.service_login) {
      this.logger.warn(`[ZTP] Serial ${rawSerial} não localizado ou sem login no SGP FTTX`);

      await this.pool.query(
        `INSERT INTO ztp_logs (serial, mac, fabricante, modelo, status, detalhes)
         VALUES ($1, $2, $3, $4, 'PENDENTE_SGP', $5)`,
        [
          rawSerial,
          params.mac || null,
          params.fabricante || null,
          params.modelo || null,
          'Equipamento conectado ao ACS mas ainda não autorizado no contrato no SGP FTTX',
        ],
      ).catch(() => undefined);

      return {
        autorizado: false,
        motivo: 'ONT conectada ao ACS, aguardando autorização no SGP FTTX',
        serial: rawSerial,
        mac: params.mac,
      };
    }

    // Achou a ONU autorizada no SGP!
    const login = onuEncontrada.service_login.trim();
    const clienteNome = onuEncontrada.service_cliente || 'Cliente CITmax';
    const contratoId = onuEncontrada.service_contrato || onuEncontrada.contrato;
    const vlan = onuEncontrada.vlan ? Number(onuEncontrada.vlan) : undefined;
    const oltNome = onuEncontrada.olt_name;
    const cto = onuEncontrada.cto;

    // Formata o primeiro nome do assinante sem acentos (ex: JOSÉ -> Jose)
    const extrairPrimeiroNome = (nomeCompleto: string) => {
      const primeiro = (nomeCompleto || '').trim().split(' ')[0] || 'Cliente';
      const semAcento = primeiro.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return semAcento.charAt(0).toUpperCase() + semAcento.slice(1).toLowerCase();
    };

    const nomeFormatado = extrairPrimeiroNome(clienteNome);
    // Padrão institucional exclusivo NetGo: NetGo_xxxx
    let wifiSsid = `NetGo_${nomeFormatado}`;
    let pppoeSenha = '123';
    let wifiSenha = '';

    try {
      const url = process.env.SGP_URL || 'https://conect.sgp.net.br';
      const app = process.env.SGP_APP || '';
      const token = process.env.SGP_TOKEN || '';

      const form = new FormData();
      form.set('app', app);
      form.set('token', token);
      form.set('login', login);

      const r = await fetch(`${url}/api/ura/consultacliente/`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(10_000),
      });

      if (r.ok) {
        const d: any = await r.json();
        const contrato = d?.contratos?.[0];
        if (contrato) {
          if (contrato.servico_senha) {
            pppoeSenha = contrato.servico_senha;
          }
          if (contrato.servico_wifi_ssid) {
            const custom = contrato.servico_wifi_ssid.replace(/^NetGo_/i, '').trim();
            wifiSsid = `NetGo_${custom || nomeFormatado}`;
          }
          if (contrato.servico_wifi_password) {
            wifiSenha = contrato.servico_wifi_password;
          } else if (contrato.telefones?.[0]?.contato) {
            // Usa os 8 dígitos do telefone como senha padrão inicial de Wi-Fi
            const telLimpo = contrato.telefones[0].contato.replace(/\D/g, '');
            if (telLimpo.length >= 8) {
              wifiSenha = telLimpo.slice(-8);
            }
          }
        }
      }
    } catch (e) {
      this.logger.warn(`[ZTP] Falha ao consultar senha PPPoE detalhada do login ${login}: ${(e as Error).message}`);
    }

    if (!wifiSenha) {
      wifiSenha = 'netgo' + (contratoId || '12345');
    }

    // Registra o sucesso no banco de auditoria ZTP
    await this.pool.query(
      `INSERT INTO ztp_logs (serial, mac, fabricante, modelo, cliente_nome, contrato_id, pppoe_login, vlan, wifi_ssid, status, detalhes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'SUCESSO', $10)`,
      [
        rawSerial,
        params.mac || null,
        params.fabricante || onuEncontrada.type || null,
        params.modelo || null,
        clienteNome,
        String(contratoId),
        login,
        vlan || null,
        wifiSsid,
        `Auto-provisionado com sucesso para ${clienteNome} (OLT: ${oltNome || 'N/A'}, CTO: ${cto || 'N/A'})`,
      ],
    ).catch((e) => this.logger.error(`[ZTP] Falha ao gravar log no banco: ${e.message}`));

    this.logger.log(`[ZTP] ✅ Sucesso! Provisionando ONT ${rawSerial} -> Login: ${login}, Contrato: ${contratoId}`);

    return {
      autorizado: true,
      serial: rawSerial,
      mac: params.mac,
      clienteNome,
      contratoId,
      pppoeLogin: login,
      pppoeSenha,
      vlan,
      wifiSsid,
      wifiSenha,
      oltNome,
      cto,
    };
  }

  /**
   * Lista o histórico recente de ativações ZTP para o painel NOC.
   */
  async listarLogs(limite: number = 50): Promise<ZtpRegistroLog[]> {
    await this.db();
    const res = await this.pool.query(
      `SELECT id, serial, mac, fabricante, modelo, cliente_nome AS "clienteNome",
              contrato_id AS "contratoId", pppoe_login AS "pppoeLogin", vlan,
              wifi_ssid AS "wifiSsid", status, detalhes, criado_em AS "criadoEm"
       FROM ztp_logs
       ORDER BY criado_em DESC
       LIMIT $1`,
      [limite],
    );

    return res.rows.map((r) => ({
      id: r.id,
      serial: r.serial,
      mac: r.mac,
      fabricante: r.fabricante,
      modelo: r.modelo,
      clienteNome: r.clienteNome,
      contratoId: r.contratoId,
      pppoeLogin: r.pppoeLogin,
      vlan: r.vlan,
      wifiSsid: r.wifiSsid,
      status: r.status,
      detalhes: r.detalhes,
      criadoEm: r.criadoEm ? new Date(r.criadoEm).toISOString() : new Date().toISOString(),
    }));
  }
}
