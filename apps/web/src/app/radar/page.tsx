"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { RespostaRadarPreditivo, AlertaRadarPreditivo, IncidenteFibra, CpeFantasmaAlerta } from "@citacs/shared";
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
} from "lucide-react";
import Link from "next/link";

export default function RadarPage() {
  const [abaPrincipal, setAbaPrincipal] = useState<"alertas" | "rompimentos" | "fantasmas" | "autocura">("alertas");
  
  // Dados de Alertas Preditivos
  const [data, setData] = useState<RespostaRadarPreditivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "critica" | "alta" | "cluster" | "wifi">("todos");
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

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

  useEffect(() => {
    carregarRadar();
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
