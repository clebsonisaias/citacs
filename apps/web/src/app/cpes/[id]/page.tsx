"use client";

import { useEffect, useState, use } from "react";
import { Header } from "@/components/layout/header";
import { AiCopilotDrawer } from "@/components/ai/ai-copilot-drawer";
import { OpticalGauge } from "@/components/cpe/optical-gauge";
import { WifiManager } from "@/components/cpe/wifi-manager";
import { LanDevices } from "@/components/cpe/lan-devices";
import { NetworkDiagnostics } from "@/components/cpe/network-diagnostics";
import { ClienteCard } from "@/components/cpe/cliente-card";
import { CpeDevice, AiDiagnosticResult } from "@citacs/shared";
import Link from "next/link";
import { 
  ArrowLeft, 
  Sparkles, 
  RefreshCw, 
  RotateCcw, 
  Wifi, 
  Radio, 
  Loader2,
  AlertCircle
} from "lucide-react";

export default function CpeDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const cpeId = decodeURIComponent(resolvedParams.id);

  const [cpe, setCpe] = useState<CpeDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [diagnostic, setDiagnostic] = useState<AiDiagnosticResult | null>(null);
  const [rebooting, setRebooting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadCpe = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/cpes/${encodeURIComponent(cpeId)}`);
      if (res.ok) {
        const data = await res.json();
        setCpe(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.message || `Erro ${res.status} ao consultar dispositivo`);
        setCpe(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Falha na comunicação com o servidor CITacs");
      setCpe(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCpe();
  }, [cpeId]);

  const handleReboot = async () => {
    if (!cpe) return;
    if (!confirm(`Deseja realmente enviar comando de Reboot para ${cpe.serialNumber}?`)) return;
    setRebooting(true);
    try {
      const res = await fetch(`/api/cpes/${encodeURIComponent(cpe.id)}/reboot`, { method: "POST" });
      if (res.ok) {
        alert("Comando de Reboot TR-069 disparado com sucesso!");
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Falha ao reiniciar: ${err.message || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Falha ao comunicar com o GenieACS: ${err.message}`);
    } finally {
      setRebooting(false);
    }
  };

  const handleRefresh = async () => {
    if (!cpe) return;
    setRefreshing(true);
    try {
      const res = await fetch(`/api/cpes/${encodeURIComponent(cpe.id)}/refresh`, { method: "POST" });
      if (res.ok) {
        alert("Comando de atualização de parâmetros TR-069 enviado! Recarregando dados...");
        await loadCpe();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Falha ao atualizar parâmetros: ${err.message || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Falha ao atualizar parâmetros: ${err.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDiagnose = () => {
    setCopilotOpen(true);
  };

  if (loading && !cpe) {
    return (
      <>
        <Header 
          copilotOpen={copilotOpen} 
          onOpenCopilot={() => setCopilotOpen(!copilotOpen)} 
        />
        <main className="p-6 flex-1 max-w-7xl mx-auto w-full flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-white">Carregando dados da CPE via TR-069...</p>
            <p className="text-xs text-muted-foreground font-mono">{cpeId}</p>
          </div>
        </main>
      </>
    );
  }

  if (!loading && !cpe) {
    return (
      <>
        <Header 
          copilotOpen={copilotOpen} 
          onOpenCopilot={() => setCopilotOpen(!copilotOpen)} 
        />
        <main className="p-6 flex-1 max-w-7xl mx-auto w-full flex items-center justify-center min-h-[60vh]">
          <div className="p-8 rounded-2xl bg-card border border-border text-center max-w-md space-y-4">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Dispositivo não encontrado</h3>
            <p className="text-xs text-muted-foreground">
              A CPE <span className="font-mono text-foreground font-semibold">{cpeId}</span> não foi localizada no GenieACS.
              {errorMessage && <span className="block mt-1 text-red-400">{errorMessage}</span>}
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={loadCpe}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-accent border border-border text-xs text-foreground transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar Novamente</span>
              </button>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar ao Painel</span>
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  // Neste ponto cpe é garantidamente real
  const currentCpe = cpe!;

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
                  {currentCpe.subscriberName ? `${currentCpe.subscriberName} (${currentCpe.serialNumber})` : currentCpe.serialNumber}
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
                {currentCpe.manufacturer} • {currentCpe.modelName} • Firmware: {currentCpe.softwareVersion || "N/D"}
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
          {/* Coluna 1: Cliente, Sinal Óptico e Rede */}
          <div className="space-y-6">
            <ClienteCard cpeId={currentCpe.id} loginRoteador={currentCpe.pppoeUsername} />
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
                    {currentCpe.lastInform ? new Date(currentCpe.lastInform).toLocaleString("pt-BR") : "N/D"}
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

            {/* Dispositivos Conectados na LAN (Wi-Fi e Cabo) */}
            <LanDevices hosts={currentCpe.hosts} />

            {/* Diagnósticos de Rede & Speedtest TR-143 */}
            <NetworkDiagnostics cpeId={currentCpe.id} />
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
