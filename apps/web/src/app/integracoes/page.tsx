"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Header } from "@/components/layout/header";
import { Check, Copy, KeyRound, Loader2, Plug, Plus } from "lucide-react";

interface Chave {
  id: number;
  sistema: string;
  descricao: string;
  prefixo: string;
  criadoPor: string;
  criadoEm: string;
  ultimoUso: string | null;
  revogadaEm: string | null;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

async function api(caminho: string, init?: RequestInit) {
  const r = await fetch(`/api${caminho}`, init);
  const corpo = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error((Array.isArray(corpo?.message) ? corpo.message[0] : corpo?.message) || `Erro ${r.status}`);
  return corpo;
}

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca");

export default function IntegracoesPage() {
  const [lista, setLista] = useState<Chave[] | null>(null);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ sistema: "", descricao: "" });
  const [salvando, setSalvando] = useState(false);
  const [entregar, setEntregar] = useState<{ sistema: string; chave: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [revogando, setRevogando] = useState<number | null>(null);
  const [base, setBase] = useState("https://acs.citmax.com.br");

  const carregar = useCallback(() => api("/integracoes/chaves").then(setLista).catch((e) => setErro(e.message)), []);

  useEffect(() => {
    carregar();
    setBase(window.location.origin);
  }, [carregar]);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const r = await api("/integracoes/chaves", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(form) });
      setEntregar({ sistema: r.sistema, chave: r.chave });
      setCopiado(false);
      setForm({ sistema: "", descricao: "" });
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function revogar(c: Chave) {
    setErro("");
    try {
      await api(`/integracoes/chaves/${c.id}/revogar`, { method: "POST" });
      setRevogando(null);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function copiar() {
    if (!entregar) return;
    await navigator.clipboard.writeText(entregar.chave).catch(() => undefined);
    setCopiado(true);
  }

  return (
    <>
      <Header />
      <main className="p-4 sm:p-6 space-y-6 max-w-5xl w-full">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center border border-primary/25 shrink-0">
            <Plug className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Integrações</h1>
            <p className="text-sm text-muted-foreground">
              Chaves para outros sistemas (como o AtendeHub) consultarem os roteadores. Só leitura: nenhuma chave reinicia, reseta ou altera Wi-Fi.
            </p>
          </div>
        </div>

        {erro && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erro}</div>}

        {entregar && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
              <KeyRound className="w-4 h-4" /> Chave de {entregar.sistema}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="px-3 py-2 rounded-md bg-black/50 border border-amber-400/30 font-mono text-sm text-amber-100 break-all select-all">{entregar.chave}</code>
              <button onClick={copiar} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm bg-amber-400/20 text-amber-100 hover:bg-amber-400/30 transition-colors">
                {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copiado ? "Copiada" : "Copiar"}
              </button>
            </div>
            <p className="text-xs text-amber-200/80">
              Ela aparece só agora; o CITacs guarda apenas uma impressão dela. Cole na configuração do outro sistema. Se perder, revogue e gere outra.
            </p>
            <button onClick={() => setEntregar(null)} className="text-xs text-amber-200 underline underline-offset-2">
              Já guardei, esconder
            </button>
          </div>
        )}

        <form onSubmit={criar} className="rounded-xl border border-border bg-card/50 p-4 grid gap-3 md:grid-cols-[1fr_1.6fr_auto] md:items-end">
          <label className="grid gap-1.5 min-w-0 text-xs text-muted-foreground">
            Sistema
            <input required pattern="[a-z0-9_\-]{2,32}" title="2 a 32 letras minúsculas, números, - ou _" value={form.sistema} onChange={(e) => setForm({ ...form, sistema: e.target.value.toLowerCase() })} placeholder="atendehub" autoCapitalize="none" spellCheck={false} className="h-10 px-3 rounded-md bg-background border border-input text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="grid gap-1.5 min-w-0 text-xs text-muted-foreground">
            Descrição
            <input maxLength={120} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Painel do atendente – CITmax" className="h-10 px-3 rounded-md bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <button disabled={salvando} className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Gerar chave
          </button>
        </form>

        <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-3">Sistema</th>
                <th className="text-left font-medium px-4 py-3">Chave</th>
                <th className="text-left font-medium px-4 py-3">Criada</th>
                <th className="text-left font-medium px-4 py-3">Último uso</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {lista === null && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Carregando…
                  </td>
                </tr>
              )}
              {lista?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Nenhuma chave ainda. Gere a primeira acima, com o nome do sistema que vai consultar.
                  </td>
                </tr>
              )}
              {lista?.map((c) => (
                <tr key={c.id} className={`border-b border-border/60 last:border-0 ${c.revogadaEm ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium font-mono text-foreground">{c.sistema}</div>
                    {c.descricao && <div className="text-xs text-muted-foreground">{c.descricao}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{c.prefixo}…</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {quando(c.criadoEm)}
                    <div>por {c.criadoPor}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{quando(c.ultimoUso)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      {c.revogadaEm ? (
                        <span className="text-xs text-muted-foreground">revogada em {quando(c.revogadaEm)}</span>
                      ) : revogando === c.id ? (
                        <>
                          <button onClick={() => revogar(c)} className="px-2.5 py-1.5 rounded-md text-xs border border-red-500/40 bg-red-500/15 text-red-200 hover:bg-red-500/25 transition-colors">
                            Revogar chave de {c.sistema}
                          </button>
                          <button onClick={() => setRevogando(null)} className="px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors">
                            Manter
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setRevogando(c.id)} className="px-2.5 py-1.5 rounded-md text-xs border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors">
                          Revogar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="rounded-xl border border-border bg-card/40 p-4 space-y-3 text-sm">
          <h2 className="font-semibold text-foreground">Como o outro sistema consulta</h2>
          <p className="text-muted-foreground">
            Busque por <strong>um</strong> critério: login PPPoE, serial da ONT ou IP. Se mais de um roteador bater, a resposta é 409 e o sistema deve usar o serial.
          </p>
          <div className="overflow-x-auto">
            <pre className="rounded-md bg-black/50 border border-border p-3 text-xs font-mono text-foreground">{`curl -H "Authorization: Bearer <chave>" \\
     -H "X-Atendente: Nome do atendente" \\
     "${base}/api/integracao/v1/cpe?pppoe=<login>"

# alternativas: ?sn=<serial>  ou  ?ip=<ipv4>`}</pre>
          </div>
          <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
            <li>200: dados do roteador (sinal, WAN, Wi-Fi sem senha, diagnóstico). 404: cliente sem roteador no ACS. 401: chave inválida ou revogada.</li>
            <li>Limite de 60 consultas por minuto por sistema. Cada consulta fica na Auditoria, com o atendente informado.</li>
          </ul>
        </section>
      </main>
    </>
  );
}
