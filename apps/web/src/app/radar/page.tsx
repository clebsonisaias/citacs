"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { 
  RespostaRadarPreditivo, 
  AlertaRadarPreditivo, 
  IncidenteFibra, 
  CpeFantasmaAlerta,
  AlertaSentinelaOptica,
  AlertaGargaloEthernet,
  AlertaDriftConfig,
} from "@citacs/shared";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Layers,
  Loader2,
  MapPin,
  MessageSquare,
  Radio,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Sparkles,
  Wifi,
  Zap,
  PhoneCall,
  Check,
  Send,
  Activity,
  Network,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

export default function RadarPage() {
  const [abaPrincipal, setAbaPrincipal] = useState<"alertas" | "sentinela" | "gargalos" | "rompimentos" | "fantasmas" | "autocura">("alertas");
  
  // Dados de Alertas Preditivos
  const [data, setData] = useState<RespostaRadarPreditivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "critica" | "alta" | "cluster" | "wifi">("todos");
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Sentinela Óptica Preditiva
  const [sentinelas, setSentinelas] = useState<AlertaSentinelaOptica[]>([]);
  const [loadingSentinela, setLoadingSentinela] = useState(false);

  // Gargalos Ethernet 10/100M
  const [gargalos, setGargalos] = useState<AlertaGargaloEthernet[]>([]);
  const [loadingGargalos, setLoadingGargalos] = useState(false);

  // Guardião de Conformidade NetGo (Drift)
  const [drifts, setDrifts] = useState<AlertaDriftConfig[]>([]);
  const [loadingDrifts, setLoadingDrifts] = useState(false);
  const [restaurandoId, setRestaurandoId] = useState<string | null>(null);
  const [msgSucessoDrift, setMsgSucessoDrift] = useState<string | null>(null);

  // Dados do Guardião de Rompimentos
  const [incidentes, setIncidentes] = useState<IncidenteFibra[]>([]);
  const [loadingIncidentes, setLoadingIncidentes] = useState(false);

  // Dados de CPEs Fantasma & Auditoria
  const [fantasmas, setFantasmas] = useState<CpeFantasmaAlerta[]>([]);
  const [loadingFantasmas, setLoadingFantasmas] = useState(false);

  // Estado do Simulador de Auto-Cura WhatsApp
  const [termoWaha, setTermoWaha] = useState("kovausk");
  const [executandoWaha, setExecutandoWaha] = useState(false);
  const [resultadoWaha, setResultadoWaha] = useState<any | null>(null);
  const [copiadoWaha, setCopiadoWaha] = useState(false);

  const carregarRadar = () => {
    setLoading(true);
    setError("");
    fetch("/api/cpes/radar/alertas")
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.message || `Erro ${res.status}`);
        setData(json);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const carregarSentinela = () => {
    setLoadingSentinela(true);
    fetch("/api/cpes/radar/sentinela")
      .then(async (res) => {
        if (res.ok) setSentinelas(await res.json());
      })
      .catch(() => {})
      .finally(() => setLoadingSentinela(false));
  };

  const carregarGargalos = () => {
    setLoadingGargalos(true);
    fetch("/api/cpes/radar/gargalos-ethernet")
      .then(async (res) => {
        if (res.ok) setGargalos(await res.json());
      })
      .catch(() => {})
      .finally(() => setLoadingGargalos(false));
  };

  const carregarDrifts = () => {
    setLoadingDrifts(true);
    fetch("/api/cpes/radar/drift")
      .then(async (res) => {
        if (res.ok) setDrifts(await res.json());
      })
      .catch(() => {})
      .finally(() => setLoadingDrifts(false));
  };

  const carregarIncidentes = () => {
    setLoadingIncidentes(true);
    fetch("/api/cpes/radar/incidentes")
      .then(async (res) => {
        if (res.ok) setIncidentes(await res.json());
      })
      .catch(() => {})
      .finally(() => setLoadingIncidentes(false));
  };

  const carregarFantasmas = () => {
    setLoadingFantasmas(true);
    fetch("/api/cpes/radar/fantasmas")
      .then(async (res) => {
        if (res.ok) setFantasmas(await res.json());
      })
      .catch(() => {})
      .finally(() => setLoadingFantasmas(false));
  };

  const restaurarPadraoNetgo = async (cpeId: string) => {
    setRestaurandoId(cpeId);
    setMsgSucessoDrift(null);
    try {
      const res = await fetch(`/api/cpes/${encodeURIComponent(cpeId)}/restaurar-padrao-netgo`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsgSucessoDrift(json.mensagem || "Padrão NetGo restaurado com sucesso!");
        carregarDrifts();
      }
    } catch {}
    setRestaurandoId(null);
  };

  useEffect(() => {
    carregarRadar();
    carregarSentinela();
    carregarGargalos();
    carregarDrifts();
    carregarIncidentes();
    carregarFantasmas();
  }, []);

  const copiarTexto = (id: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 3000);
  };

  const executarSimulacaoWaha = async () => {
    setExecutandoWaha(true);
    try {
      const res = await fetch("/api/integracao/waha/simular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termo: termoWaha }),
      });
      if (res.ok) {
        setResultadoWaha(await res.json());
      }
    } catch (e) {
      alert("Falha ao executar simulação WAHA");
    } finally {
      setExecutandoWaha(false);
    }
  };

  const copiarMsgWaha = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoWaha(true);
    setTimeout(() => setCopiadoWaha(false), 3000);
  };

  const alertasFiltrados = (data?.alertas || []).filter((a) => {
    if (filtro === "critica" && a.severidade !== "critica") return false;
    if (filtro === "alta" && (a.severidade !== "alta" || a.tipo === "cluster_cto")) return false;
    if (filtro === "cluster" && a.tipo !== "cluster_cto") return false;
    if (filtro === "wifi" && a.tipo !== "wifi_poluido") return false;

    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      a.clienteNome.toLowerCase().includes(term) ||
      a.login.toLowerCase().includes(term) ||
      (a.cto && a.cto.toLowerCase().includes(term)) ||
      (a.oltNome && a.oltNome.toLowerCase().includes(term)) ||
      a.equipamento.toLowerCase().includes(term)
    );
  });

  const resumo = data?.resumo;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Banner do Radar Proativo */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-br from-primary/15 via-card to-card border border-primary/25 shadow-sm">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/30 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                NOC Preventivo Autônomo
              </span>
              <span className="text-xs text-muted-foreground">· FTTX + TR-069 + SGP</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Radar Proativo de Clientes</span>
            </h1>
            <p className="text-sm text-zinc-300 max-w-2xl leading-relaxed">
              Detecção de degradação óptica, rompimentos de cabos de fibra, auditoria de patrimônio e auto-cura via WhatsApp.
            </p>
          </div>

          <button
            onClick={() => {
              carregarRadar();
              carregarSentinela();
              carregarGargalos();
              carregarDrifts();
              carregarIncidentes();
              carregarFantasmas();
            }}
            disabled={loading || loadingIncidentes}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/80 hover:bg-secondary text-sm font-semibold border border-border text-foreground transition-all active:scale-[0.98] disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
            <span>Atualizar Auditoria</span>
          </button>
        </div>

        {/* Seletor de Abas Principais do Radar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <button
            onClick={() => setAbaPrincipal("alertas")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              abaPrincipal === "alertas"
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Atenuações & Wi-Fi ({resumo?.totalEmRisco ?? "..."})</span>
          </button>

          <button
            onClick={() => setAbaPrincipal("sentinela")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              abaPrincipal === "sentinela"
                ? "bg-cyan-600 text-white shadow-sm shadow-cyan-600/30"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>📉 Sentinela Óptica Preditiva ({sentinelas.length})</span>
          </button>

          <button
            onClick={() => setAbaPrincipal("gargalos")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              abaPrincipal === "gargalos"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Network className="w-4 h-4 text-indigo-400" />
            <span>🔌 Gargalos Ethernet & Drift ({gargalos.length + drifts.length})</span>
          </button>

          <button
            onClick={() => setAbaPrincipal("rompimentos")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              abaPrincipal === "rompimentos"
                ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>🚨 Rompimentos & Quedas ({incidentes.length})</span>
          </button>

          <button
            onClick={() => setAbaPrincipal("fantasmas")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              abaPrincipal === "fantasmas"
                ? "bg-amber-600 text-white shadow-sm shadow-amber-600/30"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-4 h-4 text-amber-400" />
            <span>🔍 Auditoria de Comodato ({fantasmas.length})</span>
          </button>

          <button
            onClick={() => setAbaPrincipal("autocura")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              abaPrincipal === "autocura"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>🤖 Auto-Cura WhatsApp (WAHA)</span>
          </button>
        </div>

        {/* ── ABA 1: SINAIS & ATENUAÇÕES ───────────────────────────── */}
        {abaPrincipal === "alertas" && (
          <div className="space-y-6">
            {/* Cards de Métricas */}
            {resumo && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
                  <span className="text-xs text-muted-foreground">Total em Risco</span>
                  <div className="text-2xl font-bold text-white">{resumo.totalEmRisco}</div>
                  <span className="text-[11px] text-zinc-500 block">Monitoramento ativo</span>
                </div>
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1">
                  <span className="text-xs text-rose-400 font-medium">Sinal Crítico</span>
                  <div className="text-2xl font-bold text-rose-400">{resumo.criticos}</div>
                  <span className="text-[11px] text-rose-500/80 block">Rx &lt; -27 dBm (Ação Imediata)</span>
                </div>
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                  <span className="text-xs text-amber-400 font-medium">Atenuação Preventiva</span>
                  <div className="text-2xl font-bold text-amber-400">{resumo.atencao}</div>
                  <span className="text-[11px] text-amber-500/80 block">-25 a -27 dBm</span>
                </div>
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-1">
                  <span className="text-xs text-indigo-400 font-medium">Clusters de CTO</span>
                  <div className="text-2xl font-bold text-indigo-400">{resumo.clustersCto}</div>
                  <span className="text-[11px] text-indigo-500/80 block">Splitter com 2+ atenuadas</span>
                </div>
                <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 space-y-1">
                  <span className="text-xs text-sky-400 font-medium">Gargalos Wi-Fi</span>
                  <div className="text-2xl font-bold text-sky-400">{resumo.problemasWifi}</div>
                  <span className="text-[11px] text-sky-500/80 block">Canais poluídos</span>
                </div>
              </div>
            )}

            {/* Barra de Busca e Filtros */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "todos", label: "Todos os Riscos" },
                  { id: "critica", label: "🚨 Sinal Crítico" },
                  { id: "alta", label: "⚠️ Atenção" },
                  { id: "cluster", label: "🌐 Splitters / CTOs" },
                  { id: "wifi", label: "📶 Rádio Wi-Fi" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFiltro(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      filtro === f.id
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                        : "bg-secondary/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filtrar assinante, login, CTO ou OLT..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Lista de Alertas Preditivos */}
            <div className="space-y-3">
              {loading && !data ? (
                <div className="p-12 text-center text-muted-foreground space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm">Cruzando 9.730 ONUs do SGP com a telemetria do GenieACS...</p>
                </div>
              ) : alertasFiltrados.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-card border border-border text-muted-foreground space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
                  <p className="text-sm font-semibold text-white">Nenhum risco encontrado para este filtro!</p>
                </div>
              ) : (
                alertasFiltrados.map((alerta) => (
                  <div
                    key={alerta.id}
                    className="p-4 sm:p-5 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all space-y-3 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border/50">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            alerta.severidade === "critica"
                              ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                              : alerta.severidade === "alta"
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                          }`}
                        >
                          {alerta.severidade === "critica" ? "Risco de Queda Iminente" : "Degradação Preventiva"}
                        </span>
                        <h3 className="font-semibold text-sm text-white">{alerta.clienteNome}</h3>
                        <span className="text-xs text-muted-foreground font-mono">({alerta.login})</span>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        {alerta.sinalRxDbm !== null && alerta.sinalRxDbm !== undefined && (
                          <span
                            className={`font-mono font-bold ${
                              alerta.sinalRxDbm <= -27
                                ? "text-rose-400"
                                : alerta.sinalRxDbm <= -25
                                ? "text-amber-400"
                                : "text-emerald-400"
                            }`}
                          >
                            Rx: {alerta.sinalRxDbm.toFixed(2)} dBm
                          </span>
                        )}
                        {alerta.cpeId && (
                          <Link
                            href={`/cpes/${encodeURIComponent(alerta.cpeId)}`}
                            className="text-primary hover:underline flex items-center gap-1 font-medium"
                          >
                            <span>Abrir no ACS</span>
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="text-xs font-mono text-zinc-400 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Equipamento: <strong className="text-zinc-200">{alerta.equipamento}</strong></span>
                      {alerta.oltNome && <span>OLT: <strong className="text-zinc-200">{alerta.oltNome}</strong></span>}
                      {alerta.slot !== undefined && <span>Slot/PON: <strong className="text-zinc-200">{alerta.slot}/{alerta.pon}</strong></span>}
                      {alerta.cto && (
                        <span className="flex items-center gap-1 text-primary">
                          <MapPin className="w-3 h-3" />
                          <strong>{alerta.cto}</strong>
                        </span>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-secondary/30 border border-border/80 text-xs space-y-1.5">
                      <div className="flex items-center gap-1.5 text-primary font-semibold">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Diagnóstico Copilot da Causa Raiz:</span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed">{alerta.diagnostico}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="text-xs text-emerald-400 font-medium">
                        <strong>Ação Sugerida:</strong> {alerta.acaoSugerida}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() =>
                            copiarTexto(
                              `os-${alerta.id}`,
                              `[OS PREVENTIVA NOC]\nCliente: ${alerta.clienteNome} (${alerta.login})\nOLT: ${alerta.oltNome || "-"} | PON: ${alerta.pon ?? "-"} | CTO: ${alerta.cto || "-"}\nSinal Rx: ${alerta.sinalRxDbm ?? "-"} dBm\nDiagnóstico: ${alerta.diagnostico}\nAção: ${alerta.acaoSugerida}`
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/80 text-foreground border border-border flex items-center gap-1.5 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiadoId === `os-${alerta.id}` ? "✓ OS Copiada!" : "Copiar OS Técnica"}</span>
                        </button>

                        <button
                          onClick={() => copiarTexto(`msg-${alerta.id}`, alerta.mensagemClienteSugerida)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{copiadoId === `msg-${alerta.id}` ? "✓ Mensagem Copiada!" : "WhatsApp Cliente"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── ABA: SENTINELA ÓPTICA PREDITIVA ────────────────────────── */}
        {abaPrincipal === "sentinela" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-start gap-3">
              <Activity className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Sentinela Óptica Preditiva NetGo</h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Monitoramento de atenuação progressiva e velocidade de degradação do sinal óptico. Classifica hipóteses diagnósticas (conector sujo, curvatura de drop em postes, emendas atenuadas) para abertura de O.S. preventiva <strong>antes que o cliente sofra queda total</strong>.
                </p>
              </div>
            </div>

            {loadingSentinela ? (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <p className="text-xs">Processando telemetria de atenuação óptica...</p>
              </div>
            ) : sentinelas.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-semibold text-white">Todas as fibras ópticas operando em níveis estáveis</h4>
                <p className="text-xs text-muted-foreground">Nenhuma ONT com tendência de atenuação acentuada ou conector degradado no momento.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sentinelas.map((s) => (
                  <div key={s.id} className="p-5 rounded-2xl bg-card border border-border space-y-3 hover:border-cyan-500/40 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            s.taxaDegradacao === "CRITICA"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : s.taxaDegradacao === "MODERADA"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                          }`}
                        >
                          Risco {s.taxaDegradacao}
                        </span>
                        <h4 className="font-semibold text-sm text-white">{s.clienteNome || "Cliente sem vínculo"}</h4>
                        {s.loginPppoe && <span className="text-xs font-mono text-muted-foreground">({s.loginPppoe})</span>}
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Serial:</span>
                        <Link href={`/cpes/${s.cpeId}`} className="font-mono text-primary hover:underline font-semibold">
                          {s.serialNumber}
                        </Link>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-secondary/40 border border-border space-y-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Sinal Rx Atual</span>
                        <div className="text-sm font-bold text-rose-400">{s.rxAtualDbm} dBm</div>
                      </div>
                      <div className="p-3 rounded-xl bg-secondary/40 border border-border space-y-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Rx Nominal Padrão</span>
                        <div className="text-sm font-semibold text-emerald-400">{s.rxNominalDbm} dBm</div>
                      </div>
                      <div className="p-3 rounded-xl bg-secondary/40 border border-border space-y-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Atenuação Acumulada</span>
                        <div className="text-sm font-bold text-amber-400">{s.deltaDegradacaoDbm} dBm</div>
                      </div>
                      <div className="p-3 rounded-xl bg-secondary/40 border border-border space-y-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Hipótese Provável</span>
                        <div className="text-xs font-semibold text-cyan-400 truncate">{s.hipoteseCausa.replace("_", " ")}</div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-cyan-200 leading-relaxed flex items-start justify-between gap-3">
                      <div>
                        <strong>Recomendação de O.S. Preventiva:</strong> {s.recomendacaoOs}
                      </div>
                      <button
                        onClick={() =>
                          copiarTexto(
                            `sent-${s.id}`,
                            `[OS PREVENTIVA SENTINELA ÓPTICA NETGO]\nCliente: ${s.clienteNome || "N/D"} (${s.loginPppoe || "-"})\nSerial ONT: ${s.serialNumber}\nSinal Atual: ${s.rxAtualDbm} dBm (Perda: ${s.deltaDegradacaoDbm} dBm vs nominal)\nHipótese: ${s.hipoteseCausa}\nAção de Campo: ${s.recomendacaoOs}`
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 shrink-0 flex items-center gap-1 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiadoId === `sent-${s.id}` ? "✓ Copiado!" : "Copiar O.S."}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ABA: GARGALOS ETHERNET & DRIFT NETGO ────────────────────── */}
        {abaPrincipal === "gargalos" && (
          <div className="space-y-6">
            {/* Bloco 1: Gargalos de Cabo/Porta 100M */}
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-start gap-3">
                <Network className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">Auditor de Gargalos Ethernet (100 Mbps em Planos Altos)</h3>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Identifica assinantes que contrataram planos superiores a 100 Mbps (300M, 600M, 800M), mas cujo aparelho cabeado negociou em <strong>100 Mbps Fast Ethernet</strong> devido a cabo Cat5 antigo, cabo de 4 vias ou placa de rede obsoleta, limitando a velocidade a 94 Mbps.
                  </p>
                </div>
              </div>

              {loadingGargalos ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                  <p className="text-xs">Auditando portas LAN e taxas negociadas...</p>
                </div>
              ) : gargalos.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-card border border-border space-y-1.5">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                  <h4 className="text-sm font-semibold text-white">Nenhum gargalo de cabo Ethernet detectado</h4>
                  <p className="text-xs text-muted-foreground">Todos os aparelhos cabeados em planos altos estão operando em velocidade Gigabit.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {gargalos.map((g) => (
                    <div key={g.id} className="p-4 rounded-2xl bg-card border border-border space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                            Limitado a 100M
                          </span>
                          <h4 className="font-semibold text-sm text-white">{g.clienteNome || "Cliente"}</h4>
                          <span className="text-xs font-mono text-muted-foreground">({g.loginPppoe})</span>
                        </div>
                        <div className="text-xs font-semibold text-rose-400">
                          Perda Potencial: ~{g.perdaPotencialMbps} Mbps desperdiçados
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className="p-2.5 rounded-xl bg-secondary/40 border border-border">
                          <span className="text-[10px] text-muted-foreground">Plano Contratado</span>
                          <div className="font-bold text-white text-sm">{g.planoContratadoMbps} Mbps</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-secondary/40 border border-border">
                          <span className="text-[10px] text-muted-foreground">Porta LAN / Host</span>
                          <div className="font-semibold text-indigo-400">{g.portaLan}</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-secondary/40 border border-border">
                          <span className="text-[10px] text-muted-foreground">Velocidade Negociada</span>
                          <div className="font-bold text-rose-400">{g.velocidadeNegociadaMbps} Mbps (Fast)</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-secondary/40 border border-border">
                          <span className="text-[10px] text-muted-foreground">Capacidade da Porta</span>
                          <div className="font-semibold text-emerald-400">{g.capacidadePortaMbps} Mbps (Gigabit)</div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-secondary/30 border border-border text-xs text-zinc-300 space-y-1">
                        <p><strong>Diagnóstico:</strong> {g.diagnostico}</p>
                        <p className="text-emerald-400"><strong>Orientação ao Suporte:</strong> {g.orientacaoTecnica}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bloco 2: Guardião de Conformidade NetGo (Drift) */}
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Guardião de Conformidade NetGo (Configuration Drift)</h3>
                    <p className="text-xs text-muted-foreground">
                      Detecta desvios das diretrizes obrigatórias da NetGo (SSID com prefixo fixo NetGo_, porta remota :55013 e VLAN 200).
                    </p>
                  </div>
                </div>
              </div>

              {msgSucessoDrift && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{msgSucessoDrift}</span>
                </div>
              )}

              {loadingDrifts ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                  <p className="text-xs">Auditando parâmetros institucionais...</p>
                </div>
              ) : drifts.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-card border border-border space-y-1.5">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto" />
                  <h4 className="text-sm font-semibold text-white">100% da base em conformidade com o padrão NetGo</h4>
                  <p className="text-xs text-muted-foreground">Todos os roteadores ativos estão com prefixo NetGo_ e porta :55013 alinhados.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {drifts.map((d) => (
                    <div key={d.id} className="p-4 rounded-2xl bg-card border border-border space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Desvio Homologado
                          </span>
                          <h4 className="font-semibold text-sm text-white">{d.clienteNome || "Cliente"}</h4>
                          <span className="text-xs font-mono text-muted-foreground">({d.loginPppoe || d.serialNumber})</span>
                        </div>

                        <button
                          onClick={() => restaurarPadraoNetgo(d.cpeId)}
                          disabled={restaurandoId === d.cpeId}
                          className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          {restaurandoId === d.cpeId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          <span>Auto-Restaurar Padrão NetGo</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {d.desvios.map((dev, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-secondary/30 border border-border text-xs flex items-center justify-between gap-2">
                            <div>
                              <span className="font-semibold text-white">{dev.parametro}: </span>
                              <span className="text-rose-400 line-through mr-2">{dev.valorAtual}</span>
                              <span className="text-emerald-400 font-semibold">➔ {dev.valorEsperadoNetGo}</span>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono">
                              Impacto {dev.impacto}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ABA 2: GUARDIÃO DE ROMPIMENTOS ─────────────────────────── */}
        {abaPrincipal === "rompimentos" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-rose-400">Guardião de Quedas em Massa & Rompimentos</h3>
                <p className="text-xs text-rose-200/80 mt-0.5 leading-relaxed">
                  Monitoramento contínuo das portas PON e caixas CTOs. Se 3 ou mais ONTs caem juntas na mesma porta óptica, o sistema calcula a probabilidade matemática de corte de cabo ou falha de alimentação.
                </p>
              </div>
            </div>

            {loadingIncidentes ? (
              <div className="p-12 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-400 mb-2" />
                <p className="text-xs">Auditando portas PON da rede...</p>
              </div>
            ) : incidentes.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-semibold text-white">Nenhum rompimento de cabo em andamento</h4>
                <p className="text-xs text-muted-foreground">Todas as portas PON monitoradas estão com comportamento estável.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {incidentes.map((inc) => (
                  <div key={inc.id} className="p-5 rounded-2xl bg-card border border-rose-500/40 space-y-3.5 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white animate-pulse">
                          {inc.tipo === "ROMPIMENTO_CABO" ? "Corte de Fibra Troncal" : "Falha Concentrada"}
                        </span>
                        <h4 className="font-semibold text-sm text-white">
                          OLT: {inc.oltNome} · Slot {inc.slot} / PON {inc.pon}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                          {inc.totalClientesAfetados} Clientes Offline
                        </span>
                        <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                          {inc.probabilidadeRompimento}% Probabilidade Rompimento
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-secondary/40 border border-border text-xs space-y-1.5">
                      <div className="font-semibold text-rose-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Diagnóstico do Guardião:</span>
                      </div>
                      <p className="text-zinc-200 leading-relaxed">{inc.diagnosticoIa}</p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                      <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Ação Recomendada p/ Equipe de Fusão:</span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed">{inc.acaoRecomendadaFusao}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
                      <div className="text-muted-foreground">
                        Caixas CTOs afetadas: <strong className="text-white">{inc.ctosAfetadas.join(", ") || "Em mapeamento"}</strong>
                      </div>

                      <button
                        onClick={() =>
                          copiarTexto(
                            inc.id,
                            `🚨 [ALERTA DE ROMPIMENTO DE FIBRA]\nOLT: ${inc.oltNome} (Slot ${inc.slot}/PON ${inc.pon})\nTotal Afetados: ${inc.totalClientesAfetados} clientes\nCTOs: ${inc.ctosAfetadas.join(", ")}\nDiagnóstico: ${inc.diagnosticoIa}\nAção: ${inc.acaoRecomendadaFusao}`
                          )
                        }
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 self-start sm:self-auto"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiadoId === inc.id ? "✓ Alerta Copiado!" : "Copiar Alerta p/ Equipe de Fusão"}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ABA 3: AUDITORIA DE FANTASMAS & PATRIMÔNIO ──────────────── */}
        {abaPrincipal === "fantasmas" && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
              <Layers className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-400">Auditoria Patrimonial de CPEs e Comodatos</h3>
                <p className="text-xs text-amber-200/80 mt-0.5 leading-relaxed">
                  Identifica equipamentos ativos gerando tráfego no GenieACS cujos contratos no SGP constam como <strong>Cancelados</strong>, ou que utilizam MACs/Seriais divergentes da ficha cadastral.
                </p>
              </div>
            </div>

            {loadingFantasmas ? (
              <div className="p-12 text-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400 mb-2" />
                <p className="text-xs">Cruzando base de comodatos...</p>
              </div>
            ) : fantasmas.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <h4 className="text-sm font-semibold text-white">Nenhum cliente cancelado utilizando a rede</h4>
                <p className="text-xs text-muted-foreground">Base de comodatos e contratos 100% auditada e em conformidade.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fantasmas.map((fan) => (
                  <div key={fan.id} className="p-4 rounded-2xl bg-card border border-border space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {fan.tipo}
                        </span>
                        <h4 className="font-semibold text-sm text-white">{fan.clienteSgpNome || "Desconhecido"}</h4>
                        <span className="text-xs font-mono text-muted-foreground">({fan.loginPppoe})</span>
                      </div>
                      <span className="text-xs text-rose-400 font-bold">Status SGP: {fan.contratoStatus}</span>
                    </div>
                    <p className="text-xs text-zinc-300">{fan.detalhes}</p>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      Serial ACS: {fan.serialAcs} | MAC: {fan.macAcs || "N/D"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ABA 4: AUTO-CURA WHATSAPP (WAHA) ───────────────────────── */}
        {abaPrincipal === "autocura" && (
          <div className="rounded-2xl bg-card border border-border p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <MessageSquare className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">Simulador de Auto-Cura WhatsApp (WAHA)</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Testa a resposta automática e a calibração silenciosa de Wi-Fi como se o cliente tivesse enviado mensagem no WhatsApp.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Digite o login PPPoE ou telefone do cliente (ex: kovausk)..."
                value={termoWaha}
                onChange={(e) => setTermoWaha(e.target.value)}
                className="flex-1 bg-secondary/50 border border-border rounded-xl px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                onClick={executarSimulacaoWaha}
                disabled={executandoWaha || !termoWaha.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {executandoWaha ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Disparar Auto-Diagnóstico</span>
              </button>
            </div>

            {resultadoWaha && (
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-secondary/40 border border-border space-y-0.5">
                    <span className="text-[10px] text-muted-foreground">Assinante</span>
                    <div className="text-xs font-semibold text-white truncate">{resultadoWaha.clienteNome || "-"}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/40 border border-border space-y-0.5">
                    <span className="text-[10px] text-muted-foreground">Sinal Óptico Rx</span>
                    <div className="text-xs font-semibold text-emerald-400">
                      {resultadoWaha.diagnostico.sinalRxDbm ? `${resultadoWaha.diagnostico.sinalRxDbm} dBm` : "N/D"}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/40 border border-border space-y-0.5">
                    <span className="text-[10px] text-muted-foreground">Canal Wi-Fi</span>
                    <div className="text-xs font-semibold text-white">Canal {resultadoWaha.diagnostico.canalWifi}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/40 border border-border space-y-0.5">
                    <span className="text-[10px] text-muted-foreground">Auto-Cura Aplicada?</span>
                    <div className="text-xs font-semibold text-emerald-400">
                      {resultadoWaha.diagnostico.canalOtimizado ? "Sim (Canal 6)" : "Não necessário"}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Mensagem gerada pelo Bot WhatsApp:</span>
                    <button
                      onClick={() => copiarMsgWaha(resultadoWaha.mensagemWhatsapp)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                    >
                      {copiadoWaha ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiadoWaha ? "✓ Copiado!" : "Copiar Mensagem"}</span>
                    </button>
                  </div>

                  <pre className="p-4 rounded-xl bg-neutral-950 border border-border text-xs font-sans text-neutral-200 whitespace-pre-wrap leading-relaxed">
                    {resultadoWaha.mensagemWhatsapp}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
