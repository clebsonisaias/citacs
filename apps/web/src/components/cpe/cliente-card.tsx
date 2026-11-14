"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Gauge, Loader2, MapPin, UserRound } from "lucide-react";

interface ClienteSgp {
  nome: string;
  pppoeLogin: string;
  plano: string | null;
  planoMbps: number | null;
  online: boolean | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
}

interface Resposta {
  configurado: boolean;
  cliente?: ClienteSgp | null;
  loginConfere?: boolean | null;
  motivo?: string;
  ipConsultado?: string;
  lidoEm?: string;
}

/** Dono do roteador segundo o SGP, ligado pelo IP de internet da última leitura do ACS. */
export function ClienteCard({ cpeId, loginRoteador }: { cpeId: string; loginRoteador?: string }) {
  const [r, setR] = useState<Resposta | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    fetch(`/api/cpes/${encodeURIComponent(cpeId)}/cliente`)
      .then(async (res) => {
        const corpo = await res.json().catch(() => null);
        if (!res.ok) throw new Error(corpo?.message || `erro ${res.status}`);
        setR(corpo);
      })
      .catch((e: Error) => setErro(e.message));
  }, [cpeId]);

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
            {c.online ? "conectado" : "desconectado"}
          </span>
        )}
      </div>

      {!r && !erro && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando o SGP…
        </p>
      )}
      {erro && <p className="text-xs text-red-300">{erro}</p>}
      {r && !c && <p className="text-xs text-muted-foreground">{r.motivo ?? "Cliente não encontrado no SGP."}</p>}

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

      {r?.ipConsultado && (
        <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
          Ligado pelo IP {r.ipConsultado}
          {r.lidoEm && ` da leitura de ${new Date(r.lidoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
        </p>
      )}
    </div>
  );
}
