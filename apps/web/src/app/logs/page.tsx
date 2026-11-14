"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { FileText, Loader2, RefreshCw, Search } from "lucide-react";

interface Registro {
  id: number;
  quando: string;
  login: string;
  ip: string | null;
  acao: string;
  alvo: string | null;
  resultado: "ok" | "erro" | "bloqueado";
  detalhe: {
    corpo?: Record<string, unknown>;
    motivo?: string;
    erro?: string;
    antes?: Record<string, unknown>;
    depois?: Record<string, unknown>;
  } | null;
}

const COR: Record<Registro["resultado"], string> = {
  ok: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  erro: "text-red-300 bg-red-500/10 border-red-500/20",
  bloqueado: "text-amber-300 bg-amber-400/10 border-amber-400/30",
};

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });

/** Uma linha legível do que foi pedido e do que aconteceu. */
function resumo(r: Registro) {
  const d = r.detalhe ?? {};
  const partes: string[] = [];
  if (d.corpo) partes.push(Object.entries(d.corpo).map(([k, v]) => `${k}: ${String(v)}`).join(", "));
  if (d.antes && d.depois) partes.push(`antes ${JSON.stringify(d.antes)} → depois ${JSON.stringify(d.depois)}`);
  if (d.motivo) partes.push(d.motivo);
  if (d.erro) partes.push(`erro: ${d.erro}`);
  return partes.join(" · ");
}

export default function LogsPage() {
  const [lista, setLista] = useState<Registro[] | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    const r = await fetch("/api/auditoria?limite=500").catch(() => null);
    if (!r) return setErro("Sem conexão com o servidor.");
    if (r.status === 403) return setErro("Só o administrador vê a auditoria.");
    if (!r.ok) return setErro(`Não foi possível carregar (erro ${r.status}).`);
    setLista(await r.json());
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const termo = busca.trim().toLowerCase();
  const filtrados = (lista ?? []).filter(
    (r) => !termo || [r.login, r.acao, r.alvo, r.resultado, r.ip].some((c) => c?.toLowerCase().includes(termo)),
  );

  return (
    <>
      <Header />
      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-mono font-medium mb-1">
              <FileText className="w-3.5 h-3.5" />
              Quem fez o quê
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Auditoria</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Entradas no painel e toda alteração em roteador ou na equipe, com autor, IP e resultado. Senhas nunca são gravadas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pessoa, ação, roteador, IP"
                aria-label="Filtrar registros"
                className="h-9 pl-8 pr-3 w-56 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <button onClick={carregar} className="h-9 px-3 rounded-lg border border-border text-sm inline-flex items-center gap-1.5 hover:bg-secondary" aria-label="Atualizar">
              <RefreshCw className="w-4 h-4" /> Atualizar
            </button>
          </div>
        </div>

        {erro && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erro}</div>}

        <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-3">Quando</th>
                <th className="text-left font-medium px-4 py-3">Quem</th>
                <th className="text-left font-medium px-4 py-3">Ação</th>
                <th className="text-left font-medium px-4 py-3">Alvo</th>
                <th className="text-left font-medium px-4 py-3">Resultado</th>
                <th className="text-left font-medium px-4 py-3">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {lista === null && !erro && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Carregando…
                  </td>
                </tr>
              )}
              {lista && filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    {lista.length ? "Nada com esse filtro." : "Nenhum registro ainda."}
                  </td>
                </tr>
              )}
              {filtrados.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 align-top">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{quando(r.quando)}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-mono text-xs text-foreground">{r.login}</div>
                    {r.ip && <div className="font-mono text-[11px] text-muted-foreground">{r.ip}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-foreground whitespace-nowrap">{r.acao}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground break-all">{r.alvo ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-semibold ${COR[r.resultado]}`}>{r.resultado}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-md">{resumo(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
