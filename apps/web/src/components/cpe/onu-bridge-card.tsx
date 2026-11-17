"use client";

import { useEffect, useState } from "react";
import { OnuBridgeTelemetry } from "@citacs/shared";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Cable,
  CheckCircle2,
  Cpu,
  HelpCircle,
  Layers,
  Loader2,
  MapPin,
  Radio,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react";

interface OnuBridgeCardProps {
  cpeId: string;
  routerOpticalRx?: number | null;
  routerModel?: string;
}

export function OnuBridgeCard({ cpeId, routerOpticalRx, routerModel }: OnuBridgeCardProps) {
  const [data, setData] = useState<OnuBridgeTelemetry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const carregarTelemetria = () => {
    // Prioridade máxima: se o CPE for ONT com sinal óptico no ACS, aborta
    if (routerOpticalRx !== null && routerOpticalRx !== undefined) return;

    setLoading(true);
    setError("");
    fetch(`/api/cpes/${encodeURIComponent(cpeId)}/onu-bridge`)
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.message || `Erro ${res.status}`);
        setData(json);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (routerOpticalRx === null || routerOpticalRx === undefined) {
      carregarTelemetria();
    }
  }, [cpeId, routerOpticalRx]);

  // Se o próprio roteador já reporta sinal óptico direto pelo ACS (é uma ONT),
  // o dado do ACS tem prioridade total e este card nunca é exibido.
  if (routerOpticalRx !== null && routerOpticalRx !== undefined) {
    return null;
  }

  const rx = data?.sinalRxDbm;
  const tx = data?.sinalTxDbm;
  const oltRx = data?.sinalOltRxDbm;

  // Classificação do sinal óptico
  let statusColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  let statusText = "Sinal Óptico Excelente";
  let Icon = CheckCircle2;
  let barBg = "bg-emerald-500";

  if (rx !== null && rx !== undefined) {
    if (rx < -27) {
      statusColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";
      statusText = "Sinal Crítico (Risco de Queda)";
      Icon = AlertCircle;
      barBg = "bg-rose-500";
    } else if (rx < -25) {
      statusColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
      statusText = "Sinal em Alerta / Atenuado";
      Icon = AlertTriangle;
      barBg = "bg-amber-500";
    }
  }

  const minDb = -32;
  const maxDb = -8;
  const clampedRx = rx != null ? Math.max(minDb, Math.min(maxDb, rx)) : -20;
  const percent = Math.round(((clampedRx - minDb) / (maxDb - minDb)) * 100);

  return (
    <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-white">Telemetria Óptica (GPON / SGP)</h3>
        </div>
        <button
          onClick={carregarTelemetria}
          disabled={loading}
          title="Atualizar telemetria da OLT"
          className="p-1 rounded-lg text-muted-foreground hover:text-white hover:bg-secondary/60 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
        </button>
      </div>

      {loading && !data && (
        <p className="text-xs text-muted-foreground flex items-center gap-2 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          Consultando telemetria da ONU Bridge na OLT...
        </p>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          {error}
        </div>
      )}

      {data && !data.encontrado && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/30 border border-border text-xs text-muted-foreground">
          <HelpCircle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-zinc-300 font-medium">Nenhum sinal GPON integrado</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              O roteador {routerModel || "no ACS"} não possui transceiver óptico e nenhuma ONU externa foi localizada no SGP para este contrato.
            </p>
          </div>
        </div>
      )}

      {data && data.encontrado && (
        <div className="space-y-4 animate-in fade-in">
          {/* Identificação de equipamento externo */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
            <div className="flex items-center justify-between font-medium text-amber-300">
              <span className="flex items-center gap-1.5">
                <Cable className="w-3.5 h-3.5" />
                ONU Bridge Externa ({data.fabricante || "Intelbras"})
              </span>
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                {data.serialFormatado || data.serial}
              </span>
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              O roteador no ACS ({routerModel || "Huawei"}) opera apenas como Wi-Fi Gateway. O sinal óptico abaixo é lido diretamente da OLT na ONU Bridge do cliente.
            </p>
          </div>

          {/* Gauge de Sinal */}
          {rx !== null && rx !== undefined ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-4 h-4 ${statusColor.split(" ")[0]}`} />
                  <span className="text-xs font-semibold text-foreground">{statusText}</span>
                </div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold border ${statusColor}`}>
                  Rx: {rx.toFixed(2)} dBm
                </span>
              </div>

              {/* Barra */}
              <div className="space-y-1">
                <div className="w-full h-2 rounded-full bg-secondary overflow-hidden relative">
                  <div
                    className={`h-full transition-all duration-500 ${barBg}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>-32 dBm (Crítico)</span>
                  <span>-25 dBm</span>
                  <span>-8 dBm (Forte)</span>
                </div>
              </div>

              {/* Submétricas ópticas */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs font-mono">
                {tx !== null && tx !== undefined && (
                  <div className="p-2 rounded-lg bg-secondary/30 border border-border/30">
                    <span className="text-muted-foreground text-[10px] block">Tx da ONU:</span>
                    <span className="text-foreground font-medium">+{tx.toFixed(2)} dBm</span>
                  </div>
                )}
                {oltRx !== null && oltRx !== undefined && (
                  <div className="p-2 rounded-lg bg-secondary/30 border border-border/30">
                    <span className="text-muted-foreground text-[10px] block">Rx na OLT:</span>
                    <span className="text-foreground font-medium">{oltRx.toFixed(2)} dBm</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-secondary/40 border border-border text-xs text-muted-foreground">
              Aguardando próxima medição óptica da OLT...
            </div>
          )}

          {/* Dados Físicos da Fibra & OLT */}
          <div className="space-y-2 text-xs pt-2 border-t border-border/40 font-mono">
            {data.oltNome && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Server className="w-3 h-3" /> OLT:
                </span>
                <span className="text-foreground font-medium truncate max-w-[180px]" title={data.oltNome}>
                  {data.oltNome}
                </span>
              </div>
            )}

            {(data.slot !== undefined || data.pon !== undefined) && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Slot / PON / ONT:
                </span>
                <span className="text-foreground font-medium">
                  {data.slot ?? 0}/{data.pon ?? 0} (ID: {data.onuid ?? "-"})
                </span>
              </div>
            )}

            {data.cto && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Caixa (CTO):
                </span>
                <span className="text-foreground font-medium text-sky-400">
                  {data.cto} {data.ctoPorta ? `· P${data.ctoPorta}` : ""}
                </span>
              </div>
            )}

            {data.distanciaMetros !== null && data.distanciaMetros !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Distância da Fibra:
                </span>
                <span className="text-foreground font-medium">
                  {data.distanciaMetros.toLocaleString("pt-BR")} m ({(data.distanciaMetros / 1000).toFixed(2)} km)
                </span>
              </div>
            )}

            {data.temperaturaC !== null && data.temperaturaC !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Cpu className="w-3 h-3" /> Temperatura / Tensão:
                </span>
                <span className="text-foreground font-medium">
                  {data.temperaturaC} °C {data.voltagemV ? `· ${data.voltagemV} V` : ""}
                </span>
              </div>
            )}

            {data.tempoOnline && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Uptime na OLT:
                </span>
                <span className="text-emerald-400 font-medium truncate max-w-[170px]" title={data.tempoOnline}>
                  {data.tempoOnline}
                </span>
              </div>
            )}

            {data.ultimoMotivoQueda && (
              <div className="flex justify-between items-center pt-1 border-t border-border/30 text-[11px]">
                <span className="text-muted-foreground">Última Queda:</span>
                <span className="text-amber-400 font-medium">
                  {data.ultimoMotivoQueda.toLowerCase().includes("dying")
                    ? "Falta de Energia (Dying Gasp)"
                    : data.ultimoMotivoQueda}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
