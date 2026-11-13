"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { 
  FileText, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  Radio, 
  Sparkles, 
  UserCheck, 
  ShieldCheck,
  RefreshCw,
  Terminal
} from "lucide-react";

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  provider: "CITmax" | "Netgo";
  action: string;
  cpeSerial: string;
  status: "success" | "pending" | "failed";
  details: string;
}

const MOCK_LOGS: AuditLog[] = [
  {
    id: "log-1",
    timestamp: "2026-11-13T06:54:25Z",
    user: "admin@citmax.com.br",
    provider: "CITmax",
    action: "AI Copilot NOC Chat",
    cpeSerial: "HWTC12345678",
    status: "success",
    details: "Consulta de diagnóstico de atenuação e espectro de canal DFS 5GHz.",
  },
  {
    id: "log-2",
    timestamp: "2026-11-13T06:40:12Z",
    user: "suporte@netgo.psi.br",
    provider: "Netgo",
    action: "Wi-Fi Reconfiguration (TR-069)",
    cpeSerial: "ZTEG98765432",
    status: "success",
    details: "Alteração de SSID e senha do rádio 5GHz com aplicação imediata.",
  },
  {
    id: "log-3",
    timestamp: "2026-11-13T06:22:05Z",
    user: "admin@citmax.com.br",
    provider: "CITmax",
    action: "Device Reboot Command",
    cpeSerial: "HWTC12345678",
    status: "success",
    details: "Comando de reinicialização remota enviado via Connection Request :7547.",
  },
  {
    id: "log-4",
    timestamp: "2026-11-13T05:15:40Z",
    user: "sistema_seed@genieacs",
    provider: "CITmax",
    action: "Preset Provisioning",
    cpeSerial: "ITBS45678901",
    status: "success",
    details: "Aplicação do preset de inventário automático no evento 0 BOOTSTRAP.",
  }
];

export default function LogsPage() {
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<"all" | "CITmax" | "Netgo">("all");

  const filtered = MOCK_LOGS.filter((log) => {
    const matchesSearch = 
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.cpeSerial.toLowerCase().includes(search.toLowerCase()) ||
      log.user.toLowerCase().includes(search.toLowerCase());
    const matchesProvider = providerFilter === "all" || log.provider === providerFilter;
    return matchesSearch && matchesProvider;
  });

  return (
    <>
      <Header />

      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Banner Top */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-mono font-medium mb-1">
              <FileText className="w-3.5 h-3.5" />
              Trilha de Auditoria &amp; Comandos
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Logs &amp; Atividades de TR-069
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Registro completo de comandos remotos, diagnósticos de IA e alterações de configuração em CPEs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setProviderFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                providerFilter === "all" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setProviderFilter("CITmax")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                providerFilter === "CITmax" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              CITmax
            </button>
            <button
              onClick={() => setProviderFilter("Netgo")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                providerFilter === "Netgo" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              Netgo
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar logs por comando, serial da ONT ou usuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-xs sm:text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
          />
        </div>

        {/* Logs Table / Cards */}
        <div className="space-y-3">
          {filtered.map((log) => (
            <div
              key={log.id}
              className="p-4 sm:p-5 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs sm:text-sm"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-white">{log.action}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-primary/20 text-primary font-mono font-bold">
                    {log.provider}
                  </span>
                  <span className="text-muted-foreground font-mono">ONT: {log.cpeSerial}</span>
                  <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Executado com Sucesso
                  </span>
                </div>
                <p className="text-muted-foreground leading-relaxed">{log.details}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground border-t md:border-t-0 pt-2 md:pt-0 border-border/60">
                <div className="flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-primary" />
                  <span className="truncate max-w-[140px]">{log.user}</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[11px]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{new Date(log.timestamp).toLocaleTimeString("pt-BR")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
