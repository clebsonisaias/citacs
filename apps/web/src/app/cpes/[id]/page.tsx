"use client";

import { useEffect, useState, use } from "react";
import { Header } from "@/components/layout/header";
import { AiCopilotDrawer } from "@/components/ai/ai-copilot-drawer";
import { OpticalGauge } from "@/components/cpe/optical-gauge";
import { WifiManager } from "@/components/cpe/wifi-manager";
import { CpeDevice, AiDiagnosticResult } from "@citacs/shared";
import Link from "next/link";
import { 
  ArrowLeft, 
  Sparkles, 
  RefreshCw, 
  RotateCcw, 
  Trash2, 
  Cpu, 
  Wifi, 
  Radio, 
  ShieldAlert,
  Activity,
  CheckCircle2,
  Clock
} from "lucide-react";

export default function CpeDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const cpeId = decodeURIComponent(resolvedParams.id);

  const [cpe, setCpe] = useState<CpeDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [diagnostic, setDiagnostic] = useState<AiDiagnosticResult | null>(null);
  const [rebooting, setRebooting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadCpe = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cpes/${encodeURIComponent(cpeId)}`);
      if (res.ok) {
        const data = await res.json();
        setCpe(data);
      }
    } catch (err) {
      console.warn("Usando mock enquanto a API carrega", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCpe();
  }, [cpeId]);

  // Fallback se não encontrado
  const currentCpe: CpeDevice = cpe || {
    id: cpeId,
    serialNumber: "HWTC12345678",
    manufacturer: "Huawei",
    modelName: "EchoLife HG8145V5",
    softwareVersion: "V5R019C00S105",
    hardwareVersion: "HG8145V5-HW01",
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
  };

  const handleReboot = async () => {
    if (!confirm(`Deseja realmente enviar comando de Reboot para ${currentCpe.serialNumber}?`)) return;
    setRebooting(true);
    try {
      await fetch(`/api/cpes/${encodeURIComponent(currentCpe.id)}/reboot`, { method: "POST" });
      alert("Comando de Reboot TR-069 disparado com sucesso!");
    } catch (err) {
      alert("Falha ao comunicar com o GenieACS.");
    } finally {
      setRebooting(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch(`/api/cpes/${encodeURIComponent(currentCpe.id)}/refresh`, { method: "POST" });
      alert("Comando de atualização de parâmetros TR-069 enviado!");
      await loadCpe();
    } catch (err) {
      alert("Falha ao atualizar parâmetros.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleDiagnose = async () => {
    setCopilotOpen(true);
  };

  return (
    <>
      <Header 
        copilotOpen={copilotOpen} 
        onOpenCopilot={() => setCopilotOpen(!copilotOpen)} 
      />

      <main className="p-6 space-y-6 flex-1 max-w-7xl mx-auto w-full">
        {/* Top Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white font-mono">
                  {currentCpe.serialNumber}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    currentCpe.online
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                  }`}
                >
                  {currentCpe.online ? "Online (TR-069)" : "Offline"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {currentCpe.manufacturer} • {currentCpe.modelName} • Firmware: {currentCpe.softwareVersion}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary hover:bg-accent border border-border text-xs text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Atualizar Parâmetros</span>
            </button>

            <button
              onClick={handleReboot}
              disabled={rebooting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${rebooting ? "animate-spin" : ""}`} />
              <span>Reiniciar ONT</span>
            </button>

            <button
              onClick={handleDiagnose}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Diagnosticar com IA</span>
            </button>
          </div>
        </div>

        {/* Informações Centrais em Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1: Sinal Óptico e Rede */}
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
              <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" />
                <span>Telemetria Óptica (GPON)</span>
              </h3>
              <OpticalGauge optical={currentCpe.optical} />
              
              <div className="space-y-2 text-xs pt-2 border-t border-border/40 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Endereço IP WAN:</span>
                  <span className="text-foreground font-medium">{currentCpe.ipAddress || "N/D"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Endereço MAC:</span>
                  <span className="text-foreground font-medium">{currentCpe.macAddress || "N/D"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Login PPPoE:</span>
                  <span className="text-foreground font-medium">{currentCpe.pppoeUsername || "N/D"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Hardware:</span>
                  <span className="text-foreground font-medium">{currentCpe.hardwareVersion || "N/D"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Último Inform:</span>
                  <span className="text-foreground font-medium">
                    {new Date(currentCpe.lastInform).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>
            </div>

            {/* Card de Alerta Inteligente */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 space-y-2">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                <Sparkles className="w-4 h-4" />
                <span>Copilot Insight</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Esta ONT está sincronizada com o GenieACS na VPS. Você pode acionar o assistente lateral para avaliar quedas de conexão, mudar canais e obter diagnósticos automáticos.
              </p>
            </div>
          </div>

          {/* Coluna 2 e 3: Gestão de Wi-Fi e Ferramentas */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-primary" />
                  <span>Configurações das Redes Wi-Fi</span>
                </h3>
                <span className="text-xs text-muted-foreground">TR-069 WLANConfiguration</span>
              </div>

              <WifiManager
                cpeId={currentCpe.id}
                wifiRadios={currentCpe.wifi}
                onUpdated={loadCpe}
              />
            </div>
          </div>
        </div>
      </main>

      <AiCopilotDrawer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        selectedCpe={currentCpe}
      />
    </>
  );
}
