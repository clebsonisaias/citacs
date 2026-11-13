"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { AiCopilotDrawer } from "@/components/ai/ai-copilot-drawer";
import { CpeDevice } from "@citacs/shared";
import Link from "next/link";
import { 
  Radio, 
  Search, 
  Filter, 
  RefreshCw, 
  Sparkles, 
  Wifi, 
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink
} from "lucide-react";

export default function CpesListPage() {
  const [cpes, setCpes] = useState<CpeDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "critical">("all");
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [selectedCpe, setSelectedCpe] = useState<CpeDevice | null>(null);

  const fetchCpes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cpes?search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setCpes(data);
      }
    } catch (err) {
      console.warn("Fallback mock", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCpes();
  }, [search]);

  const defaultList: CpeDevice[] = cpes.length > 0 ? cpes : [
    {
      id: "hw-1",
      serialNumber: "HWTC12345678",
      manufacturer: "Huawei",
      modelName: "EchoLife HG8145V5",
      softwareVersion: "V5R019C00S105",
      macAddress: "48:57:02:11:22:33",
      ipAddress: "100.64.12.45",
      pppoeUsername: "cliente.joao@citmax",
      online: true,
      lastInform: new Date().toISOString(),
      registeredAt: new Date().toISOString(),
      optical: { rxDbm: -21.4, txDbm: 2.3, status: "optimal" },
      wifi: [{ index: 1, band: "2.4GHz", ssid: "CITmax_Joao_2G", enabled: true, channel: 6 }],
    },
    {
      id: "zte-2",
      serialNumber: "ZTEG98765432",
      manufacturer: "ZTE",
      modelName: "F670L",
      softwareVersion: "V9.0.10P1N1",
      macAddress: "70:A8:E3:44:55:66",
      ipAddress: "100.64.12.89",
      pppoeUsername: "cliente.maria@citmax",
      online: true,
      lastInform: new Date().toISOString(),
      registeredAt: new Date().toISOString(),
      optical: { rxDbm: -27.8, txDbm: 1.8, status: "critical" },
      wifi: [{ index: 1, band: "2.4GHz", ssid: "Maria_WiFi", enabled: true, channel: 11 }],
    },
  ];

  const filteredCpes = defaultList.filter((cpe) => {
    if (statusFilter === "online") return cpe.online;
    if (statusFilter === "critical") return cpe.optical?.status === "critical";
    return true;
  });

  return (
    <>
      <Header 
        copilotOpen={copilotOpen} 
        onOpenCopilot={() => setCopilotOpen(!copilotOpen)} 
      />

      <main className="p-6 space-y-6 flex-1 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary" />
              <span>Inventário de Dispositivos (CPEs / ONTs)</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gerencie parâmetros TR-069, realize diagnósticos e reboots remotos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchCpes}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground hover:bg-secondary transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Filtrar por Serial, MAC, PPPoE..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos ({defaultList.length})
            </button>
            <button
              onClick={() => setStatusFilter("online")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === "online"
                  ? "bg-emerald-500 text-white"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Online
            </button>
            <button
              onClick={() => setStatusFilter("critical")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === "critical"
                  ? "bg-rose-500 text-white"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Sinal Crítico
            </button>
          </div>
        </div>

        {/* Tabela de Dispositivos */}
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-medium">
                <tr>
                  <th className="p-3.5">Dispositivo / Serial</th>
                  <th className="p-3.5">Modelo / Versão</th>
                  <th className="p-3.5">Rede & IP</th>
                  <th className="p-3.5">Sinal Óptico (Rx)</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredCpes.map((cpe) => (
                  <tr key={cpe.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="p-3.5">
                      <div className="font-semibold text-white font-mono">{cpe.serialNumber}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{cpe.macAddress || "Sem MAC"}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="text-foreground">{cpe.manufacturer} {cpe.modelName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{cpe.softwareVersion}</div>
                    </td>
                    <td className="p-3.5 font-mono">
                      <div className="text-foreground">{cpe.ipAddress || "N/D"}</div>
                      <div className="text-[11px] text-muted-foreground">{cpe.pppoeUsername || "Nenhum"}</div>
                    </td>
                    <td className="p-3.5">
                      {cpe.optical?.rxDbm !== null && cpe.optical?.rxDbm !== undefined ? (
                        <span
                          className={`px-2 py-0.5 rounded-full font-mono text-[11px] border font-semibold ${
                            cpe.optical.status === "optimal"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : cpe.optical.status === "warning"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}
                        >
                          {cpe.optical.rxDbm} dBm
                        </span>
                      ) : (
                        <span className="text-muted-foreground">N/D</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          cpe.online
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${cpe.online ? "bg-emerald-400" : "bg-zinc-400"}`} />
                        {cpe.online ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedCpe(cpe);
                            setCopilotOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
                          title="Diagnosticar com IA"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                        <Link
                          href={`/cpes/${encodeURIComponent(cpe.id)}`}
                          className="px-2.5 py-1 rounded-lg bg-secondary text-foreground hover:bg-accent border border-border text-xs font-medium transition-colors"
                        >
                          Ver Detalhes
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <AiCopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        selectedCpe={selectedCpe}
      />
    </>
  );
}
