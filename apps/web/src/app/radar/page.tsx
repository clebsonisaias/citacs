"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { RespostaRadarPreditivo, AlertaRadarPreditivo } from "@citacs/shared";
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
} from "lucide-react";
import Link from "next/link";

export default function RadarPage() {
  const [data, setData] = useState<RespostaRadarPreditivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "critica" | "alta" | "cluster" | "wifi">("todos");
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

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

  useEffect(() => {
    carregarRadar();
  }, []);

  const copiarTexto = (id: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 3000);
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
              Identificação preditiva de degradação óptica, problemas de splitters em CTOs e interferência de Wi-Fi antes que o assinante abra reclamação.
            </p>
          </div>

          <button
            onClick={carregarRadar}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary/80 hover:bg-secondary text-sm font-semibold border border-border text-foreground transition-all active:scale-[0.98] disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
            <span>Atualizar Auditoria</span>
          </button>
        </div>

        {/* Cards de Métricas */}
        {resumo && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div
              onClick={() => setFiltro("todos")}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                filtro === "todos" ? "bg-primary/10 border-primary shadow-sm" : "bg-card border-border hover:bg-secondary/40"
              }`}
            >
              <span className="text-xs text-muted-foreground font-medium block">Total em Risco</span>
              <span className="text-2xl font-bold text-white mt-1 block">{resumo.totalEmRisco}</span>
              <span className="text-[11px] text-zinc-400 mt-0.5 block">Monitoramento ativo</span>
            </div>

            <div
              onClick={() => setFiltro("critica")}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                filtro === "critica" ? "bg-rose-500/15 border-rose-500 shadow-sm" : "bg-card border-border hover:bg-secondary/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-rose-300 font-medium">Sinal Crítico</span>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              </div>
              <span className="text-2xl font-bold text-rose-400 mt-1 block">{resumo.criticos}</span>
              <span className="text-[11px] text-rose-300/80 mt-0.5 block">Rx &lt; -27 dBm (Ação Imediata)</span>
            </div>

            <div
              onClick={() => setFiltro("alta")}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                filtro === "alta" ? "bg-amber-500/15 border-amber-500 shadow-sm" : "bg-card border-border hover:bg-secondary/40"
              }`}
            >
              <span className="text-xs text-amber-300 font-medium block">Atenuação Preventiva</span>
              <span className="text-2xl font-bold text-amber-400 mt-1 block">{resumo.atencao}</span>
              <span className="text-[11px] text-amber-300/80 mt-0.5 block">-25 a -27 dBm</span>
            </div>

            <div
              onClick={() => setFiltro("cluster")}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                filtro === "cluster" ? "bg-sky-500/15 border-sky-500 shadow-sm" : "bg-card border-border hover:bg-secondary/40"
              }`}
            >
              <span className="text-xs text-sky-300 font-medium block">Clusters de CTO</span>
              <span className="text-2xl font-bold text-sky-400 mt-1 block">{resumo.clustersCto}</span>
              <span className="text-[11px] text-sky-300/80 mt-0.5 block">Splitter com 2+ atenuadas</span>
            </div>

            <div
              onClick={() => setFiltro("wifi")}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                filtro === "wifi" ? "bg-violet-500/15 border-violet-500 shadow-sm" : "bg-card border-border hover:bg-secondary/40"
              }`}
            >
              <span className="text-xs text-violet-300 font-medium block">Gargalos Wi-Fi</span>
              <span className="text-2xl font-bold text-violet-400 mt-1 block">{resumo.problemasWifi}</span>
              <span className="text-[11px] text-violet-300/80 mt-0.5 block">Canais poluídos</span>
            </div>
          </div>
        )}

        {/* Barra de Busca e Filtro */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por cliente, login PPPoE, CTO (ex: SGA, MCB), OLT ou modelo..."
              className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Loading e Erros */}
        {loading && (
          <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-sm font-medium text-foreground">Cruzando dados de OLTs, CTOs e Informs TR-069...</p>
            <p className="text-xs text-muted-foreground">Auditando níveis de sinal em toda a frota de assinantes</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Lista de Alertas Preditivos */}
        {!loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Exibindo {alertasFiltrados.length} ocorrências identificadas</span>
              <span>Ordenado por urgência técnica decrescente</span>
            </div>

            {alertasFiltrados.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-medium text-white">Nenhum alerta crítico para este filtro</p>
                <p className="text-xs text-muted-foreground">Todos os assinantes filtrados operam dentro dos parâmetros normais.</p>
              </div>
            ) : (
              alertasFiltrados.map((alerta) => {
                let badgeColor = "bg-amber-500/10 border-amber-500/20 text-amber-300";
                let badgeLabel = "Atenuação Preventiva";

                if (alerta.severidade === "critica") {
                  badgeColor = "bg-rose-500/10 border-rose-500/20 text-rose-400";
                  badgeLabel = "Risco de Queda Iminente";
                } else if (alerta.tipo === "cluster_cto") {
                  badgeColor = "bg-sky-500/10 border-sky-500/20 text-sky-300";
                  badgeLabel = "Falha de Caixa (Cluster CTO)";
                } else if (alerta.tipo === "wifi_poluido") {
                  badgeColor = "bg-violet-500/10 border-violet-500/20 text-violet-300";
                  badgeLabel = "Interferência Wi-Fi";
                }

                const textoOs = `[ORDEM DE SERVIÇO PREVENTIVA NOC]\nCliente: ${alerta.clienteNome} (Login: ${alerta.login})\nEquipamento: ${alerta.equipamento}\nOLT: ${alerta.oltNome || "-"} | Slot/PON: ${alerta.slot ?? "-"}/${alerta.pon ?? "-"}\nCTO: ${alerta.cto || "-"} (Porta: ${alerta.ctoPorta || "-"})\nSinal Óptico Medido: ${alerta.sinalRxDbm ? alerta.sinalRxDbm + " dBm" : "-"}\nDiagnóstico: ${alerta.diagnostico}\nAção em Campo: ${alerta.acaoSugerida}`;

                return (
                  <div
                    key={alerta.id}
                    className="p-5 rounded-2xl bg-card border border-border hover:border-border/80 transition-all space-y-4 shadow-sm"
                  >
                    {/* Linha Superior: Cliente, Equipamento e Severidade */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold text-white">{alerta.clienteNome}</span>
                          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${badgeColor}`}>
                            {badgeLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                          <span>login: {alerta.login}</span>
                          {alerta.contrato && <span>· Contrato: #{alerta.contrato}</span>}
                          <span>· {alerta.equipamento}</span>
                        </div>
                      </div>

                      {alerta.sinalRxDbm !== null && alerta.sinalRxDbm !== undefined && (
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span className="text-xs text-muted-foreground font-mono">Potência Rx:</span>
                          <span
                            className={`text-sm px-2.5 py-0.5 rounded-lg font-mono font-bold border ${
                              alerta.sinalRxDbm < -27
                                ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                                : "bg-amber-500/15 border-amber-500/30 text-amber-400"
                            }`}
                          >
                            {alerta.sinalRxDbm.toFixed(2)} dBm
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Localização da Conexão (OLT, CTO, Porta) */}
                    <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-secondary/30 border border-border/40 text-xs font-mono">
                      {alerta.oltNome && (
                        <span className="flex items-center gap-1.5 text-zinc-300">
                          <Server className="w-3.5 h-3.5 text-primary" />
                          <span>OLT: {alerta.oltNome}</span>
                        </span>
                      )}
                      {(alerta.slot !== undefined || alerta.pon !== undefined) && (
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Layers className="w-3.5 h-3.5" />
                          <span>Slot/PON: {alerta.slot}/{alerta.pon}</span>
                        </span>
                      )}
                      {alerta.cto && (
                        <span className="flex items-center gap-1 text-sky-400 font-semibold">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Caixa: {alerta.cto} {alerta.ctoPorta ? `(Porta ${alerta.ctoPorta})` : ""}</span>
                        </span>
                      )}
                    </div>

                    {/* Diagnóstico da IA e Ação Recomendada */}
                    <div className="space-y-2 text-xs">
                      <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 space-y-1">
                        <span className="font-semibold text-primary flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          Diagnóstico Copilot da Causa Raiz:
                        </span>
                        <p className="text-zinc-200 leading-relaxed">{alerta.diagnostico}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-secondary/40 border border-border space-y-1">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          Ação Recomendada para o Técnico de Campo:
                        </span>
                        <p className="text-muted-foreground leading-relaxed">{alerta.acaoSugerida}</p>
                      </div>
                    </div>

                    {/* Botões de Ação Pronta */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copiarTexto(alerta.id + "-os", textoOs)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 border border-border text-foreground transition-all"
                        >
                          <Copy className="w-3.5 h-3.5 text-primary" />
                          <span>{copiadoId === alerta.id + "-os" ? "✓ OS Copiada!" : "Copiar OS Técnica"}</span>
                        </button>

                        <button
                          onClick={() => copiarTexto(alerta.id + "-zap", alerta.mensagemClienteSugerida)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{copiadoId === alerta.id + "-zap" ? "✓ Mensagem Copiada!" : "Mensagem WhatsApp"}</span>
                        </button>
                      </div>

                      {alerta.cpeId && (
                        <Link
                          href={`/cpes/${encodeURIComponent(alerta.cpeId)}`}
                          className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                        >
                          <span>Ver no Painel ACS</span>
                          <span>→</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>
    </div>
  );
}
