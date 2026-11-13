"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { 
  Settings, 
  Server, 
  Radio, 
  Key, 
  ShieldCheck, 
  Database, 
  Sparkles, 
  CheckCircle2, 
  Save, 
  RefreshCw,
  Building2
} from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"general" | "providers" | "acs" | "ai">("general");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <>
      <Header />

      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
              <Settings className="w-6 h-6 text-primary" />
              Configurações do Sistema
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Gerencie parâmetros operacionais, provedores autorizados, integração ACS e IA.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm shadow-md hover:bg-primary/90 transition-all self-start sm:self-auto"
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Salvo com Sucesso!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </>
            )}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-border/60">
          {[
            { id: "general", label: "Geral", icon: Server },
            { id: "providers", label: "Provedores (Multi-empresa)", icon: Building2 },
            { id: "acs", label: "GenieACS TR-069", icon: Radio },
            { id: "ai", label: "Copilot IA & OpenAI", icon: Sparkles },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  active
                    ? "bg-secondary text-primary font-semibold border border-primary/30"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === "general" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
              <h3 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Bancos de Dados &amp; Filas
              </h3>
              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/50">
                  <div>
                    <div className="font-medium text-foreground">PostgreSQL 16</div>
                    <div className="text-[11px] text-muted-foreground">citacs-postgres:5432 (Operacional)</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono">Conectado</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/50">
                  <div>
                    <div className="font-medium text-foreground">Redis 7 &amp; BullMQ</div>
                    <div className="text-[11px] text-muted-foreground">citacs-redis:6379 (Filas assíncronas)</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono">Pronto</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/50">
                  <div>
                    <div className="font-medium text-foreground">MongoDB 4.4</div>
                    <div className="text-[11px] text-muted-foreground">GenieACS Backend DB</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono">Ativo</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
              <h3 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Segurança &amp; Autenticação
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Domínio Principal (FQDN)</label>
                  <input
                    type="text"
                    disabled
                    value="https://acs.citmax.com.br"
                    className="mt-1 w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-xs sm:text-sm text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Certificado SSL / TLS</label>
                  <input
                    type="text"
                    disabled
                    value="Let's Encrypt (Traefik v3 HTTP/2 Automático)"
                    className="mt-1 w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-xs sm:text-sm text-emerald-400 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "providers" && (
          <div className="space-y-4 sm:space-y-6">
            <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
              <h3 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Provedores Habilitados para IA &amp; Operação
              </h3>
              <p className="text-xs text-muted-foreground">
                O token OpenAI da plataforma está liberado estritamente para as seguintes empresas:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-secondary/30 border border-primary/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">CITmax Telecom</span>
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-mono font-bold">Provedor Primário</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Slug: <code className="text-white">citmax</code></div>
                    <div>Domínio: <code className="text-white">citmax.com.br</code></div>
                    <div>Acesso OpenAI: <span className="text-emerald-400 font-semibold">Liberado</span></div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-secondary/30 border border-primary/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">Netgo Telecom</span>
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-mono font-bold">Provedor Autorizado</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Slug: <code className="text-white">netgo</code></div>
                    <div>Domínio: <code className="text-white">netgo.psi.br</code></div>
                    <div>Acesso OpenAI: <span className="text-emerald-400 font-semibold">Liberado</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "acs" && (
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <h3 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary" />
              Parâmetros de Integração GenieACS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">URL Interna da NBI (API)</label>
                <input
                  type="text"
                  disabled
                  value="http://nbi:7557"
                  className="mt-1 w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-xs sm:text-sm text-foreground font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Porta Pública CWMP (TR-069)</label>
                <input
                  type="text"
                  disabled
                  value="http://170.82.252.195:7550"
                  className="mt-1 w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-xs sm:text-sm text-foreground font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Intervalo de Inform Periódico (Segundos)</label>
                <input
                  type="number"
                  defaultValue={300}
                  className="mt-1 w-full p-2.5 rounded-xl bg-secondary border border-border text-xs sm:text-sm text-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Timeout de Connection Request (Segundos)</label>
                <input
                  type="number"
                  defaultValue={15}
                  className="mt-1 w-full p-2.5 rounded-xl bg-secondary border border-border text-xs sm:text-sm text-foreground"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "ai" && (
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <h3 className="font-semibold text-white text-sm sm:text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Inteligência Artificial &amp; Metodologia de NOC
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-sm">Status do Motor OpenAI</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold">Ativo &amp; Vinculado</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Modelo: <code className="text-white">gpt-4o-mini</code>. Trava de provedores: <code className="text-primary font-bold">CITmax &amp; Netgo</code>.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
                <span className="font-semibold text-white text-sm">Metodologia de Diagnóstico Wi-Fi (wifi-optimizer)</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O Copilot utiliza análise de causa raiz com isolamento de camada (Rádio vs Fibra vs WAN), regras de 20MHz para 2.4GHz e detecção proativa de interferência de radar DFS (canais 52 a 140 no 5GHz).
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
