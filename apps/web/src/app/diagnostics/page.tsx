"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { 
  Cpu, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Play, 
  Radio, 
  Wifi, 
  ArrowRight,
  ShieldAlert,
  Search
} from "lucide-react";
import Link from "next/link";

interface DiagnosticIssue {
  id: string;
  cpeSerial: string;
  manufacturer: string;
  subscriber: string;
  severity: "critical" | "warning";
  category: "optical" | "wifi" | "connectivity";
  description: string;
  suggestedAction: string;
}

const MOCK_ISSUES: DiagnosticIssue[] = [
  {
    id: "iss-1",
    cpeSerial: "HWTC12345678",
    manufacturer: "Huawei HG8145V5",
    subscriber: "joao.silva@citmax",
    severity: "critical",
    category: "optical",
    description: "Sinal Rx em -27.8 dBm (Crítico). Alto risco de perda de pacotes GPON e quedas de chamadas VoIP.",
    suggestedAction: "Despachar equipe para limpeza de conector na CTO ou troca de drop óptico.",
  },
  {
    id: "iss-2",
    cpeSerial: "ZTEG98765432",
    manufacturer: "ZTE F670L",
    subscriber: "maria.souza@netgo",
    severity: "warning",
    category: "wifi",
    description: "Canal 5GHz operando no Canal 56 (Faixa de Radar DFS). Sujeito a silenciamento involuntário por radar.",
    suggestedAction: "Migrar canal 5GHz para faixa não-DFS (Canal 36 ou 149) via TR-069 com 1 clique.",
  },
  {
    id: "iss-3",
    cpeSerial: "ITBS45678901",
    manufacturer: "Intelbras GF1200",
    subscriber: "carlos.mendonca@citmax",
    severity: "warning",
    category: "wifi",
    description: "Canal 2.4GHz operando no canal 12 (incompatível com dispositivos legados de 2.4GHz).",
    suggestedAction: "Ajustar canal 2.4GHz para canal 6 com largura de 20MHz para máxima estabilidade.",
  },
  {
    id: "iss-4",
    cpeSerial: "FHTT88990011",
    manufacturer: "Fiberhome AN5506",
    subscriber: "ana.lima@netgo",
    severity: "critical",
    category: "connectivity",
    description: "Dispositivo sem Inform TR-069 há mais de 48 horas. PPPoE desconectado.",
    suggestedAction: "Verificar alimentação elétrica na residência ou rompimento de cabo na caixa de emenda.",
  }
];

export default function DiagnosticsPage() {
  const [filter, setFilter] = useState<"all" | "critical" | "warning">("all");
  const [scanning, setScanning] = useState(false);
  const [scanDone, setScanDone] = useState(false);

  const handleScan = () => {
    setScanning(true);
    setScanDone(false);
    setTimeout(() => {
      setScanning(false);
      setScanDone(true);
    }, 2000);
  };

  const filtered = MOCK_ISSUES.filter((i) => {
    if (filter === "all") return true;
    return i.severity === filter;
  });

  return (
    <>
      <Header />

      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Banner Top */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-card via-card to-primary/10 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-mono font-medium mb-1">
              <Cpu className="w-3.5 h-3.5" />
              Telemetria &amp; Varredura Automatizada
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Diagnósticos em Lote de Frota
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Varredura proativa de anomalias ópticas, interferências de canais Wi-Fi e falhas de conexão TR-069.
            </p>
          </div>

          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm shadow-lg hover:bg-primary/90 transition-all self-start md:self-auto shrink-0 disabled:opacity-50"
          >
            {scanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Varrendo Rede GPON...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Executar Varredura com IA</span>
              </>
            )}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-xs text-muted-foreground font-medium">Anomalias Detectadas</div>
            <div className="text-xl sm:text-2xl font-bold text-white mt-1">4</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Em análise proativa</div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-xs text-muted-foreground font-medium">Sinal Óptico Crítico</div>
            <div className="text-xl sm:text-2xl font-bold text-red-400 mt-1">1</div>
            <div className="text-[11px] text-red-400/80 mt-0.5">Rx abaixo de -27 dBm</div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-xs text-muted-foreground font-medium">Wi-Fi em Risco / DFS</div>
            <div className="text-xl sm:text-2xl font-bold text-amber-400 mt-1">2</div>
            <div className="text-[11px] text-amber-400/80 mt-0.5">Canais DFS ou sobrepostos</div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="text-xs text-muted-foreground font-medium">CPEs Offline</div>
            <div className="text-xl sm:text-2xl font-bold text-zinc-400 mt-1">1</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Sem inform recente</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            Todas as Anomalias (4)
          </button>
          <button
            onClick={() => setFilter("critical")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "critical" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            Críticas (2)
          </button>
          <button
            onClick={() => setFilter("warning")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "warning" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            Alertas Wi-Fi (2)
          </button>
        </div>

        {/* Issue Cards */}
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      item.severity === "critical"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {item.severity === "critical" ? "Crítico" : "Aviso"}
                  </span>
                  <span className="font-mono font-bold text-white text-xs sm:text-sm">{item.cpeSerial}</span>
                  <span className="text-xs text-muted-foreground">({item.manufacturer})</span>
                  <span className="text-[11px] px-2 py-0.2 rounded bg-secondary text-primary font-mono">{item.subscriber}</span>
                </div>

                <p className="text-xs sm:text-sm text-foreground leading-relaxed">{item.description}</p>

                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-primary font-medium">Recomendação IA:</span>
                  <span>{item.suggestedAction}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                <Link
                  href={`/cpes/${item.cpeSerial}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 text-xs font-semibold transition-all"
                >
                  <span>Gerenciar ONT</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
