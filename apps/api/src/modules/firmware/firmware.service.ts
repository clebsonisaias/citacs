import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { CampanhaFirmware } from '@citacs/shared';
import { GenieacsService } from '../genieacs/genieacs.service';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS campanhas_firmware (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  fabricante text NOT NULL,
  modelo text NOT NULL,
  versao_origem text NOT NULL,
  versao_destino text NOT NULL,
  arquivo_url text NOT NULL,
  janela_inicio text NOT NULL DEFAULT '03:00',
  janela_fim text NOT NULL DEFAULT '05:00',
  limite_por_hora int NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'PLANEJADA',
  total_alvos int NOT NULL DEFAULT 0,
  atualizados int NOT NULL DEFAULT 0,
  falhas int NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
`;

@Injectable()
export class FirmwareService implements OnModuleDestroy {
  private readonly logger = new Logger(FirmwareService.name);
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  private pronto?: Promise<void>;

  constructor(private readonly genieacsService: GenieacsService) {}

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
   * Inventário de versões de firmware por Fabricante e Modelo da frota ACS
   */
  async inventarioVersoes(): Promise<any[]> {
    const devices = await this.genieacsService.getDevices();
    const mapa = new Map<string, { fabricante: string; modelo: string; versao: string; total: number; cpeIds: string[] }>();

    for (const d of devices) {
      const fab = d.manufacturer || 'Desconhecido';
      const mod = d.modelName || 'Genérico';
      const ver = d.softwareVersion || 'Desconhecida';
      const chave = `${fab}__${mod}__${ver}`;

      if (!mapa.has(chave)) {
        mapa.set(chave, { fabricante: fab, modelo: mod, versao: ver, total: 0, cpeIds: [] });
      }
      const item = mapa.get(chave)!;
      item.total++;
      if (item.cpeIds.length < 5) item.cpeIds.push(d.id);
    }

    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  }

  async listarCampanhas(): Promise<CampanhaFirmware[]> {
    await this.db();
    const res = await this.pool.query(
      `SELECT id, nome, fabricante, modelo, versao_origem AS "versaoOrigem",
              versao_destino AS "versaoDestino", arquivo_url AS "arquivoFirmwareUrl",
              janela_inicio AS "janelaInicio", janela_fim AS "janelaFim",
              limite_por_hora AS "limitePorHora", status, total_alvos AS "totalAlvos",
              atualizados AS "atualizadosComSucesso", falhas, criado_em AS "criadoEm"
       FROM campanhas_firmware
       ORDER BY id DESC`
    );
    return res.rows.map(r => ({
      ...r,
      id: String(r.id),
      criadoEm: r.criadoEm ? new Date(r.criadoEm).toISOString() : new Date().toISOString()
    }));
  }

  async criarCampanha(dados: {
    nome: string;
    fabricante: string;
    modelo: string;
    versaoOrigem: string;
    versaoDestino: string;
    arquivoFirmwareUrl: string;
    janelaInicio?: string;
    janelaFim?: string;
    limitePorHora?: number;
  }): Promise<CampanhaFirmware> {
    await this.db();
    const devices = await this.genieacsService.getDevices();
    // Conta quantos dispositivos atendem aos critérios de origem
    const totalAlvos = devices.filter(d => 
      (d.manufacturer || '').toLowerCase() === dados.fabricante.toLowerCase() &&
      (d.modelName || '').toLowerCase() === dados.modelo.toLowerCase() &&
      (d.softwareVersion || '').toLowerCase() === dados.versaoOrigem.toLowerCase()
    ).length;

    const res = await this.pool.query(
      `INSERT INTO campanhas_firmware 
       (nome, fabricante, modelo, versao_origem, versao_destino, arquivo_url, janela_inicio, janela_fim, limite_por_hora, total_alvos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        dados.nome,
        dados.fabricante,
        dados.modelo,
        dados.versaoOrigem,
        dados.versaoDestino,
        dados.arquivoFirmwareUrl,
        dados.janelaInicio || '03:00',
        dados.janelaFim || '05:00',
        dados.limitePorHora || 50,
        totalAlvos
      ]
    );

    const r = res.rows[0];
    return {
      id: String(r.id),
      nome: r.nome,
      fabricante: r.fabricante,
      modelo: r.modelo,
      versaoOrigem: r.versao_origem,
      versaoDestino: r.versao_destino,
      arquivoFirmwareUrl: r.arquivo_url,
      janelaInicio: r.janela_inicio,
      janelaFim: r.janela_fim,
      limitePorHora: r.limite_por_hora,
      status: r.status,
      totalAlvos: r.total_alvos,
      atualizadosComSucesso: r.atualizados,
      falhas: r.falhas,
      criadoEm: new Date(r.criado_em).toISOString(),
    };
  }
}
