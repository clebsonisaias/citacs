"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ArrowDown, ArrowUp, Gauge, Loader2, MapPin, Unplug, UserRound } from "lucide-react";

interface ClienteSgp {
  nome: string;
  pppoeLogin: string;
  plano: string | null;
  planoMbps: number | null;
  online: boolean | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  sessaoConectadaEm?: string | null;
  nasIp?: string | null;
  macConectado?: string | null;
  downloadMb?: number | null;
  uploadMb?: number | null;
}

interface Resposta {
  configurado: boolean;
  cliente?: ClienteSgp | null;
  metodo?: "login" | "ip" | null;
  loginConsultado?: string;
  ipConsultado?: string;
  loginConfere?: boolean | null;
  motivo?: string;
  lidoEm?: string;
}

/** Dono do roteador segundo o SGP, vinculado por login PPPoE ou IP de internet. */
export function ClienteCard({ cpeId, loginRoteador }: { cpeId: string; loginRoteador?: string }) {
  const [r, setR] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");
  const [desconectando, setDesconectando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [erroAcao, setErroAcao] = useState("");

  const carregarCliente = () => {
    fetch(`/api/cpes/${encodeURIComponent(cpeId)}/cliente`)
      .then(async (res) => {
        const corpo = await res.json().catch(() => null);
        if (!res.ok) throw new Error(corpo?.message || `erro ${res.status}`);
        setR(corpo);
      })
      .catch((e: Error) => setErro(e.message));
  };

  useEffect(() => {
    carregarCliente();
  }, [cpeId]);

  const handleDesconectar = async () => {
    const login = c?.pppoeLogin || loginRoteador;
    if (!confirm(`Deseja realmente derrubar a sessão PPPoE de "${login}" no BRAS para forçar a reconexão imediata do roteador?`)) {
      return;
    }
    setDesconectando(true);
    setMensagemSucesso("");
    setErroAcao("");
    try {
      const res = await fetch(`/api/cpes/${encodeURIComponent(cpeId)}/desconectar-pppoe`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `Erro ${res.status}`);
      setMensagemSucesso(data?.mensagem || "Sessão desconectada com sucesso no BRAS!");
      setTimeout(() => {
        setMensagemSucesso("");
        carregarCliente();
      }, 5000);
    } catch (e) {
      setErroAcao((e as Error).message);
    } finally {
      setDesconectando(false);
    }
  };

  if (r && !r.configurado) return null; // integração com o SGP desligada
  const c = r?.cliente;

  return (
    <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm text-white flex items-center gap-2">
          <UserRound className="w-4 h-4 text-primary" />
          <span>Cliente (SGP)</span>
        </h3>
        {c && c.online !== null && (
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full border ${
              c.online ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-muted-foreground border-border"
            }`}
          >
            {c.online ? "Sessão Online" : "Sessão Offline"}
          </span>
        )}
      </div>

      {!r && !erro && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando o SGP…
        </p>
      )}
      {erro && <p className="text-xs text-red-300">{erro}</p>}
      {r && !c && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{r.motivo ?? "Cliente não encontrado no SGP."}</p>
          {r.loginConfere === false && (
            <p className="text-xs text-amber-300 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Aviso: O IP de internet deste roteador pertence a outra sessão no SGP. A vinculação incorreta foi prevenida.
              </span>
            </p>
          )}
        </div>
      )}

      {c && (
        <>
          <div>
            <p className="text-base font-semibold text-foreground leading-tight">{c.nome}</p>
            <p className="text-xs font-mono text-muted-foreground">login {c.pppoeLogin}</p>
          </div>
          {c.plano && (
            <p className="text-xs text-foreground flex items-start gap-2">
              <Gauge className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
              <span>
                {c.plano}
                {c.planoMbps && <span className="text-muted-foreground"> · {c.planoMbps} Mbps</span>}
              </span>
            </p>
          )}
          {(c.endereco || c.bairro) && (
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{c.endereco ?? [c.bairro, c.cidade].filter(Boolean).join(", ")}</span>
            </p>
          )}

          {/* Dados da sessão Radius no BRAS */}
          {(c.sessaoConectadaEm || c.downloadMb !== null) && (
            <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/40 text-xs space-y-1.5 font-mono">
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-primary" /> Sessão no BRAS
                </span>
                {c.nasIp && <span>NAS: {c.nasIp}</span>}
              </div>
              {c.sessaoConectadaEm && (
                <p className="text-[11px] text-zinc-400">
                  Online desde: {new Date(c.sessaoConectadaEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              )}
              {(c.downloadMb !== null || c.uploadMb !== null) && (
                <div className="flex items-center gap-3 text-[11px] text-zinc-300 pt-1 border-t border-border/30">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <ArrowDown className="w-3 h-3" /> {(c.downloadMb ?? 0).toLocaleString("pt-BR")} MB
                  </span>
                  <span className="flex items-center gap-1 text-sky-400">
                    <ArrowUp className="w-3 h-3" /> {(c.uploadMb ?? 0).toLocaleString("pt-BR")} MB
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Botão de ação: Desconectar PPPoE no BRAS */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleDesconectar}
              disabled={desconectando}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {desconectando ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Derrubando Sessão no BRAS...</span>
                </>
              ) : (
                <>
                  <Unplug className="w-3.5 h-3.5 text-rose-400" />
                  <span>Derrubar Sessão PPPoE (Reiniciar Conexão)</span>
                </>
              )}
            </button>
            {mensagemSucesso && (
              <p className="mt-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center animate-in fade-in">
                ✓ {mensagemSucesso}
              </p>
            )}
            {erroAcao && (
              <p className="mt-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2 text-center animate-in fade-in">
                ✕ {erroAcao}
              </p>
            )}
          </div>

          {r.loginConfere === false && (
            <p className="text-xs text-amber-300 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                O login do roteador ({loginRoteador?.trim() || "?"}) não bate com o do SGP ({c.pppoeLogin}). O IP pode ter mudado de dono
                desde a última leitura.
              </span>
            </p>
          )}
        </>
      )}

      {r && (r.loginConsultado || r.ipConsultado) && (
        <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
          {r.metodo === "login"
            ? `Vinculado pelo login PPPoE ${r.loginConsultado}`
            : r.ipConsultado
            ? `Vinculado pelo IP ${r.ipConsultado}`
            : ""}
          {r.lidoEm && ` · Leitura de ${new Date(r.lidoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
        </p>
      )}
    </div>
  );
}
