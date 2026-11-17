"use client";

import { useEffect, useState } from "react";
import { PingDiagnosticResult } from "@citacs/shared";
import { 
  Activity, 
  Send, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Gauge, 
  ArrowRight, 
  Wifi, 
  RefreshCw,
  Server
} from "lucide-react";

interface NetworkDiagnosticsProps {
  cpeId: string;
}

export function NetworkDiagnostics({ cpeId }: NetworkDiagnosticsProps) {
  const [activeTab, setActiveTab] = useState<"ping" | "speedtest">("ping");
  const [pingHost, setPingHost] = useState("8.8.8.8");
  const [pingCount, setPingCount] = useState(4);
  const [downloadUrl, setDownloadUrl] = useState("http://speedtest.citmax.com.br/test100M.bin");

  const [triggeringPing, setTriggeringPing] = useState(false);
  const [triggeringSpeed, setTriggeringSpeed] = useState(false);
  const [pingResult, setPingResult] = useState<PingDiagnosticResult | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchPingResult = async () => {
    setLoadingResult(true);
    try {
      const res = await fetch(`/api/cpes/${encodeURIComponent(cpeId)}/diagnostics/ping`);
      if (res.ok) {
        const data = await res.json();
        setPingResult(data);
      }
    } catch {
      // Silencioso
    } finally {
      setLoadingResult(false);
    }
  };

  useEffect(() => {
    fetchPingResult();
  }, [cpeId]);

  const handleTriggerPing = async () => {
    setTriggeringPing(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/cpes/${encodeURIComponent(cpeId)}/diagnostics/ping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: pingHost, count: pingCount }),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        if (json.aplicada) {
          setStatusMessage("✅ Teste de Ping disparado via TR-069! Coletando resultados...");
        } else {
          setStatusMessage("🕒 Teste de Ping enfileirado no GenieACS! Será executado no próximo Inform do roteador.");
        }
        // Aguarda 4 segundos e tenta atualizar os resultados
        setTimeout(fetchPingResult, 4000);
      } else {
        alert(`Erro ao disparar diagnóstico: ${json.message || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Falha de comunicação: ${err.message}`);
    } finally {
      setTriggeringPing(false);
    }
  };

  const handleTriggerSpeedtest = async () => {
    setTriggeringSpeed(true);
    try {
      const res = await fetch(`/api/cpes/${encodeURIComponent(cpeId)}/diagnostics/speedtest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadUrl }),
      });

      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        if (json.aplicada) {
          alert("✅ Teste de velocidade TR-143 disparado com sucesso na ONT!");
        } else {
          alert("🕒 Teste de velocidade TR-143 enfileirado no GenieACS! Será iniciado no próximo Inform.");
        }
      } else {
        alert(`Erro ao iniciar Speedtest: ${json.message || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Falha de comunicação: ${err.message}`);
    } finally {
      setTriggeringSpeed(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
      {/* Header com Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-white">Diagnósticos de Rede & Latência (TR-069)</h3>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-secondary/50 p-1 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab("ping")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "ping"
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Send className="w-3 h-3" />
            <span>Ping & Latência</span>
          </button>
          <button
            onClick={() => setActiveTab("speedtest")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "speedtest"
                ? "bg-emerald-600 text-white font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Gauge className="w-3 h-3" />
            <span>Speedtest TR-143</span>
          </button>
        </div>
      </div>

      {/* Conteúdo Aba 1: Ping */}
      {activeTab === "ping" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] text-muted-foreground block">Destino do Ping (IP ou Host):</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pingHost}
                  onChange={(e) => setPingHost(e.target.value)}
                  placeholder="Ex: 8.8.8.8 ou 1.1.1.1"
                  className="flex-1 bg-secondary/50 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                />
                <button
                  onClick={handleTriggerPing}
                  disabled={triggeringPing || !pingHost}
                  className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {triggeringPing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Testar Agora</span>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground block">Pacotes:</label>
              <select
                value={pingCount}
                onChange={(e) => setPingCount(Number(e.target.value))}
                className="w-full bg-secondary/50 border border-border rounded-xl px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value={4}>4 Pacotes (Rápido)</option>
                <option value={8}>8 Pacotes</option>
                <option value={10}>10 Pacotes (Acurado)</option>
              </select>
            </div>
          </div>

          {/* Atalhos Rápidos */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground">Destinos frequentes:</span>
            <button
              onClick={() => setPingHost("8.8.8.8")}
              className="text-[10px] px-2 py-0.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors font-mono"
            >
              Google (8.8.8.8)
            </button>
            <button
              onClick={() => setPingHost("1.1.1.1")}
              className="text-[10px] px-2 py-0.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors font-mono"
            >
              Cloudflare (1.1.1.1)
            </button>
            <button
              onClick={() => setPingHost("100.65.0.1")}
              className="text-[10px] px-2 py-0.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors font-mono"
            >
              Gateway BRAS (100.65.0.1)
            </button>
          </div>

          {statusMessage && (
            <p className="text-xs text-primary bg-primary/10 border border-primary/20 rounded-xl p-2.5 leading-relaxed">
              {statusMessage}
            </p>
          )}

          {/* Resultados de Latência */}
          <div className="pt-2 border-t border-border/40">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-white">Último Resultado na ONT:</span>
              <button
                onClick={fetchPingResult}
                disabled={loadingResult}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${loadingResult ? "animate-spin" : ""}`} />
                <span>Atualizar Resultados</span>
              </button>
            </div>

            {pingResult && pingResult.host ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                {/* Latência Média */}
                <div className="p-3 rounded-xl bg-card border border-border">
                  <span className="text-[10px] text-zinc-500 block">Latência Média</span>
                  <span
                    className={`text-lg font-bold ${
                      pingResult.averageResponseTimeMs < 25
                        ? "text-emerald-400"
                        : pingResult.averageResponseTimeMs < 60
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}
                  >
                    {pingResult.averageResponseTimeMs} ms
                  </span>
                </div>

                {/* Mínima / Máxima */}
                <div className="p-3 rounded-xl bg-card border border-border">
                  <span className="text-[10px] text-zinc-500 block">Mín. / Máx.</span>
                  <span className="text-sm font-semibold text-foreground">
                    {pingResult.minimumResponseTimeMs} / {pingResult.maximumResponseTimeMs} ms
                  </span>
                </div>

                {/* Perda de Pacotes */}
                <div className="p-3 rounded-xl bg-card border border-border">
                  <span className="text-[10px] text-zinc-500 block">Perda de Pacotes</span>
                  <span
                    className={`text-sm font-bold ${
                      pingResult.packetLossPercent === 0
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {pingResult.packetLossPercent}%
                  </span>
                </div>

                {/* Host & Status */}
                <div className="p-3 rounded-xl bg-card border border-border">
                  <span className="text-[10px] text-zinc-500 block">Host Testado</span>
                  <span className="text-xs font-semibold text-foreground truncate block" title={pingResult.host}>
                    {pingResult.host}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {pingResult.successCount} ok / {pingResult.failureCount} perdas
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-secondary/10 border border-dashed border-border text-center text-xs text-muted-foreground">
                Nenhum teste de ping registrado ainda nesta ONT. Dispare o teste acima para medir latência e perda.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conteúdo Aba 2: Speedtest TR-143 */}
      {activeTab === "speedtest" && (
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground block">
              URL do Arquivo de Teste TR-143 (HTTP DownloadDiagnostics):
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                placeholder="http://seu-servidor-local/100M.bin"
                className="flex-1 bg-secondary/50 border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-mono focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                onClick={handleTriggerSpeedtest}
                disabled={triggeringSpeed || !downloadUrl}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
              >
                {triggeringSpeed ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Gauge className="w-3.5 h-3.5" />
                )}
                <span>Iniciar Speedtest na ONT</span>
              </button>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-muted-foreground space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <Server className="w-3.5 h-3.5" />
              <span>Como funciona o Speedtest TR-143</span>
            </div>
            <p className="leading-relaxed">
              O teste roda a partir do <strong>processador do próprio roteador do cliente</strong>, baixando um arquivo de payload pela interface WAN. Isso elimina interferências do Wi-Fi do cliente e isola se a lentidão reclamada é da fibra óptica ou do celular/notebook do usuário.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
