"use client";

import { OpticalPower } from "@citacs/shared";
import { AlertCircle, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";

interface OpticalGaugeProps {
  optical?: OpticalPower;
}

export function OpticalGauge({ optical }: OpticalGaugeProps) {
  const rx = optical?.rxDbm;
  const tx = optical?.txDbm;

  if (rx === null || rx === undefined) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/40 border border-border text-xs text-muted-foreground">
        <HelpCircle className="w-4 h-4" />
        <span>Sinal óptico não reportado pela ONT</span>
      </div>
    );
  }

  // Define status
  let statusColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  let statusLabel = "Sinal Óptico Ideal";
  let Icon = CheckCircle2;

  if (optical?.status === "warning") {
    statusColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
    statusLabel = "Atenuação em Alerta";
    Icon = AlertTriangle;
  } else if (optical?.status === "critical") {
    statusColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";
    statusLabel = "Sinal Crítico / Perda";
    Icon = AlertCircle;
  }

  // Percentual aproximado para preenchimento de barra (-30 dBm a -10 dBm)
  const minDb = -32;
  const maxDb = -8;
  const clampedRx = Math.max(minDb, Math.min(maxDb, rx));
  const percent = Math.round(((clampedRx - minDb) / (maxDb - minDb)) * 100);

  return (
    <div className="p-3.5 rounded-xl bg-card border border-border space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${statusColor.split(" ")[0]}`} />
          <span className="text-xs font-semibold text-foreground">{statusLabel}</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold border ${statusColor}`}>
          Rx: {rx} dBm
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="w-full h-2 rounded-full bg-secondary overflow-hidden relative">
          <div
            className={`h-full transition-all duration-500 ${
              optical?.status === "optimal"
                ? "bg-emerald-500"
                : optical?.status === "warning"
                ? "bg-amber-500"
                : "bg-rose-500"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>-32 dBm (Crítico)</span>
          <span>-24.5 dBm</span>
          <span>-8 dBm (Forte)</span>
        </div>
      </div>

      {tx !== null && tx !== undefined && (
        <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40 flex justify-between font-mono">
          <span>Potência de Transmissão (Tx):</span>
          <span className="text-foreground font-medium">{tx} dBm</span>
        </div>
      )}
    </div>
  );
}
