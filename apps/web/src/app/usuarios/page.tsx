"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Header } from "@/components/layout/header";
import { Check, Copy, KeyRound, Loader2, UserPlus, Users } from "lucide-react";

type Perfil = "leitura" | "escrita" | "admin";

interface Membro {
  id: number;
  login: string;
  nome: string;
  perfil: Perfil;
  ativo: boolean;
  trocarSenha: boolean;
  ultimoLogin: string | null;
}

const PERFIS: Record<Perfil, string> = {
  leitura: "Leitura · só consulta",
  escrita: "Escrita · altera roteadores",
  admin: "Admin · também gerencia a equipe",
};

const JSON_HEADERS = { "Content-Type": "application/json" };

async function api(caminho: string, init?: RequestInit) {
  const r = await fetch(`/api${caminho}`, init);
  const corpo = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error((Array.isArray(corpo?.message) ? corpo.message[0] : corpo?.message) || `Erro ${r.status}`);
  return corpo;
}

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca");

export default function UsuariosPage() {
  const [lista, setLista] = useState<Membro[] | null>(null);
  const [euId, setEuId] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ nome: "", login: "", perfil: "leitura" as Perfil });
  const [salvando, setSalvando] = useState(false);
  const [entregar, setEntregar] = useState<{ login: string; senha: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(() => api("/usuarios").then(setLista).catch((e) => setErro(e.message)), []);

  useEffect(() => {
    carregar();
    api("/auth/me").then((u) => setEuId(u.id)).catch(() => undefined);
  }, [carregar]);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const r = await api("/usuarios", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(form) });
      setEntregar({ login: r.login, senha: r.senhaTemporaria });
      setCopiado(false);
      setForm({ nome: "", login: "", perfil: "leitura" });
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function alterar(m: Membro, mudanca: Partial<Pick<Membro, "perfil" | "ativo">>) {
    setErro("");
    try {
      await api(`/usuarios/${m.id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(mudanca) });
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function novaSenha(m: Membro) {
    if (!confirm(`Gerar uma senha temporária nova para ${m.nome}? A senha atual deixa de funcionar e a sessão dele cai.`)) return;
    setErro("");
    try {
      const r = await api(`/usuarios/${m.id}/nova-senha`, { method: "POST" });
      setEntregar({ login: m.login, senha: r.senhaTemporaria });
      setCopiado(false);
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function copiar() {
    if (!entregar) return;
    await navigator.clipboard.writeText(entregar.senha).catch(() => undefined);
    setCopiado(true);
  }

  return (
    <>
      <Header />
      <main className="p-4 sm:p-6 space-y-6 max-w-5xl w-full">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center border border-primary/25 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Equipe</h1>
            <p className="text-sm text-muted-foreground">
              Cada pessoa entra com o próprio usuário. A senha temporária aparece uma vez só e a pessoa troca no primeiro acesso.
            </p>
          </div>
        </div>

        {erro && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{erro}</div>}

        {entregar && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
              <KeyRound className="w-4 h-4" /> Senha temporária de {entregar.login}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <code className="px-3 py-2 rounded-md bg-black/50 border border-amber-400/30 font-mono text-base text-amber-100 tracking-wide select-all">{entregar.senha}</code>
              <button onClick={copiar} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm bg-amber-400/20 text-amber-100 hover:bg-amber-400/30 transition-colors">
                {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copiado ? "Copiada" : "Copiar"}
              </button>
            </div>
            <p className="text-xs text-amber-200/80">
              Ela aparece só agora. Passe para a pessoa por um canal privado; no primeiro acesso o sistema obriga a trocar.
            </p>
            <button onClick={() => setEntregar(null)} className="text-xs text-amber-200 underline underline-offset-2">
              Já entreguei, esconder
            </button>
          </div>
        )}

        <form onSubmit={criar} className="rounded-xl border border-border bg-card/50 p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.3fr_auto] lg:items-end">
          <label className="grid gap-1.5 min-w-0 text-xs text-muted-foreground">
            Nome
            <input required minLength={2} maxLength={80} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Maria Souza" className="h-10 px-3 rounded-md bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="grid gap-1.5 min-w-0 text-xs text-muted-foreground">
            Login
            <input required pattern="[a-zA-Z0-9._\-]{3,32}" title="3 a 32 letras, números, ponto, hífen ou _" value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value.toLowerCase() })} placeholder="maria.souza" autoCapitalize="none" spellCheck={false} className="h-10 px-3 rounded-md bg-background border border-input text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="grid gap-1.5 min-w-0 text-xs text-muted-foreground">
            Perfil
            <select value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value as Perfil })} className="h-10 w-full min-w-0 px-2 rounded-md bg-background border border-input text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {(Object.keys(PERFIS) as Perfil[]).map((p) => (
                <option key={p} value={p}>{PERFIS[p]}</option>
              ))}
            </select>
          </label>
          <button disabled={salvando} className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60">
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Criar
          </button>
        </form>

        <div className="rounded-xl border border-border bg-card/40 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left font-medium px-4 py-3">Pessoa</th>
                <th className="text-left font-medium px-4 py-3">Perfil</th>
                <th className="text-left font-medium px-4 py-3">Situação</th>
                <th className="text-left font-medium px-4 py-3">Último acesso</th>
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
              {lista?.map((m) => {
                const souEu = m.id === euId;
                return (
                  <tr key={m.id} className={`border-b border-border/60 last:border-0 ${m.ativo ? "" : "opacity-50"}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{m.nome} {souEu && <span className="text-xs text-primary">(você)</span>}</div>
                      <div className="text-xs font-mono text-muted-foreground">{m.login}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select value={m.perfil} disabled={souEu} onChange={(e) => alterar(m, { perfil: e.target.value as Perfil })} aria-label={`Perfil de ${m.nome}`} className="h-8 px-2 rounded-md bg-background border border-input text-xs disabled:opacity-60">
                        {(Object.keys(PERFIS) as Perfil[]).map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {!m.ativo ? (
                        <span className="text-muted-foreground">desativado</span>
                      ) : m.trocarSenha ? (
                        <span className="text-amber-300">aguardando 1º acesso</span>
                      ) : (
                        <span className="text-emerald-400">ativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{quando(m.ultimoLogin)}</td>
                    <td className="px-4 py-3">
                      {!souEu && (
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                          <button onClick={() => novaSenha(m)} className="px-2.5 py-1.5 rounded-md text-xs border border-border hover:bg-secondary transition-colors">
                            Nova senha
                          </button>
                          <button onClick={() => alterar(m, { ativo: !m.ativo })} className={`px-2.5 py-1.5 rounded-md text-xs border transition-colors ${m.ativo ? "border-red-500/30 text-red-300 hover:bg-red-500/10" : "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"}`}>
                            {m.ativo ? "Desativar" : "Reativar"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
