"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { AiCopilotDrawer } from "@/components/ai/ai-copilot-drawer";
import { OpticalGauge } from "@/components/cpe/optical-gauge";
import { CpeDevice } from "@citacs/shared";
import Link from "next/link";
import { 
  Radio, 
  Search, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Cpu, 
  ArrowRight,
  Wifi,
  ExternalLink
} from "lucide-react";

export default function DashboardPage() {
  const [cpes, setCpes] = useState<CpeDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
      console.warn("Usando mock enquanto a API carrega", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCpes();
  }, [search]);

  // Fallback demo CPE se a lista estiver vazia (para o usuário ver a interface de imediato)
  const displayCpes: CpeDevice[] = cpes.length > 0 ? cpes : [
    {
      id: "demo-ont-1",
      serialNumber: "HWTC12345678",
      manufacturer: "Huawei",
      modelName: "EchoLife HG8145V5",
      softwareVersion: "V5R019C00S105",
      macAddress: "48:57:02:11:22:33",
      ipAddress: "100.64.12.45",
      pppoeUsername: "cliente.joao@citmax",
      online: true,
      lastInform: new Date().toISOString(),
      registeredAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      optical: {
        rxDbm: -21.4,
        txDbm: 2.3,
        status: "optimal",
      },
      wifi: [
        { index: 1, band: "2.4GHz", ssid: "CITmax_Joao_2G", enabled: true, channel: 6 },
        { index: 2, band: "5GHz", ssid: "CITmax_Joao_5G", enabled: true, channel: 36 },
      ],
    },
    {
      id: "demo-ont-2",
      serialNumber: "ZTEG98765432",
      manufacturer: "ZTE",
      modelName: "F670L",
      softwareVersion: "V9.0.10P1N1",
      macAddress: "70:A8:E3:44:55:66",
      ipAddress: "100.64.12.89",
      pppoeUsername: "cliente.maria@citmax",
      online: true,
      lastInform: new Date().toISOString(),
      registeredAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      optical: {
        rxDbm: -27.8,
        txDbm: 1.8,
        status: "critical",
      },
      wifi: [
        { index: 1, band: "2.4GHz", ssid: "Maria_WiFi", enabled: true, channel: 11 },
      ],
    },
  ];

  const total = displayCpes.length;
  const onlineCount = displayCpes.filter((c) => c.online).length;
  const criticalCount = displayCpes.filter((c) => c.optical?.status === "critical").length;

  return (
    <>
      <Header 
        copilotOpen={copilotOpen} 
        onOpenCopilot={() => setCopilotOpen(!copilotOpen)} 
      />

      <main className="p-6 space-y-6 flex-1">
        {/* Banner de Boas-Vindas & Status */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-card via-card/80 to-primary/10 border border-border">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Painel de Operações TR-069
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-semibold">
                CITacs AI
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              GenieACS integrado via NBI direta. Telemetria e diagnósticos assistidos por IA em tempo real.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedCpe(displayCpes[0] || null);
                setCopilotOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>Diagnosticar com Copilot IA</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total de CPEs</p>
              <h3 className="text-2xl font-bold mt-1 text-white">{total}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center border border-primary/30">
              <Radio className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">CPEs Online</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-400">{onlineCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Atenuação Crítica (&lt; -27 dBm)</p>
              <h3 className="text-2xl font-bold mt-1 text-rose-400">{criticalCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Motor de IA</p>
              <h3 className="text-sm font-semibold mt-1 text-white">Multi-Provider Ativo</h3>
              <p className="text-[10px] text-muted-foreground">OpenAI + Heurística Local</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Busca e Lista de CPEs */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por Serial, MAC, Modelo ou PPPoE..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              onClick={fetchCpes}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary hover:bg-accent border border-border text-xs text-foreground transition-colors self-end"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Sincronizar ACS</span>
            </button>
          </div>

          {/* Cards de Dispositivos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayCpes.map((cpe) => (
              <div
                key={cpe.id}
                className="p-5 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all space-y-4 group relative"
              >
                {/* Header da CPE */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white group-hover:text-primary transition-colors">
                        {cpe.subscriberName || cpe.serialNumber}
                      </h4>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          cpe.online ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                        }`}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      {cpe.subscriberName ? `${cpe.serialNumber} • ` : ""}{cpe.manufacturer} • {cpe.modelName}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedCpe(cpe);
                      setCopilotOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/20 text-primary text-xs font-medium border border-primary/30 hover:bg-primary/30 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Diagnosticar IA</span>
                  </button>
                </div>

                {/* Potência Óptica */}
                <OpticalGauge optical={cpe.optical} />

                {/* Metadados Técnicos */}
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/40 text-muted-foreground font-mono">
                  <div>
                    <span className="text-zinc-500 block">MAC:</span>
                    <span className="text-foreground">{cpe.macAddress || "N/D"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">IP WAN:</span>
                    <span className="text-foreground">{cpe.ipAddress || "N/D"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Usuário PPPoE:</span>
                    <span className="text-foreground truncate block">{cpe.pppoeUsername || "N/D"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Último Inform:</span>
                    <span className="text-foreground">
                      {new Date(cpe.lastInform).toLocaleTimeString("pt-BR")}
                    </span>
                  </div>
                </div>

                {/* Footer do Card */}
                <div className="pt-2 flex items-center justify-between border-t border-border/40">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Wifi className="w-3.5 h-3.5 text-primary" />
                    <span>{cpe.wifi?.length || 0} Redes Wi-Fi configuradas</span>
                  </div>

                  <Link
                    href={`/cpes/${encodeURIComponent(cpe.id)}`}
                    className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                  >
                    <span>Gerenciar Completo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Drawer Lateral do Copilot IA */}
      <AiCopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        selectedCpe={selectedCpe}
      />
    </>
  );
}
