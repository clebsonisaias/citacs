"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { 
  Layers, 
  Plus, 
  CheckCircle2, 
  Radio, 
  FileCode, 
  Search, 
  Sparkles,
  RefreshCw,
  Terminal,
  Settings2
} from "lucide-react";

interface PresetItem {
  id: string;
  name: string;
  description: string;
  weight: number;
  events: string[];
  configurationsCount: number;
  active: boolean;
}

const PRESETS: PresetItem[] = [
  {
    id: "preset-default",
    name: "default_inform",
    description: "Configura intervalo de Inform para 300s e habilita coleta periódica de sinal óptico.",
    weight: 0,
    events: ["0 BOOTSTRAP", "1 BOOT", "2 PERIODIC"],
    configurationsCount: 4,
    active: true,
  },
  {
    id: "preset-inventory",
    name: "inventory_discovery",
    description: "Preset de descoberta automática de número de série, fabricante, versão de firmware e hardware.",
    weight: 10,
    events: ["0 BOOTSTRAP"],
    configurationsCount: 8,
    active: true,
  },
  {
    id: "preset-wifi-standards",
    name: "wifi_best_practices",
    description: "Aplica largura de 20MHz no 2.4GHz e canais não-DFS (36-48) no 5GHz conforme diretrizes de estabilidade.",
    weight: 20,
    events: ["0 BOOTSTRAP", "1 BOOT"],
    configurationsCount: 6,
    active: true,
  },
  {
    id: "preset-wan-pppoe",
    name: "wan_provision_pppoe",
    description: "Provisionamento de interface WAN PPPoE com VLAN de dados para provedores CITmax e Netgo.",
    weight: 30,
    events: ["0 BOOTSTRAP"],
    configurationsCount: 5,
    active: false,
  }
];

export default function PresetsPage() {
  const [search, setSearch] = useState("");

  const filtered = PRESETS.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Header />

      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Banner Top */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-mono font-medium mb-1">
              <Layers className="w-3.5 h-3.5" />
              GenieACS Presets Engine
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Presets &amp; Provisionamento TR-069
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Regras automatizadas aplicadas às ONTs durante os eventos de BOOT, BOOTSTRAP e PERIODIC.
            </p>
          </div>

          <button
            onClick={() => alert("Criador de presets em desenvolvimento")}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm shadow-md hover:bg-primary/90 transition-all self-start sm:self-auto shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Preset TR-069</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar presets por nome ou função..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-xs sm:text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
          />
        </div>

        {/* Presets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((preset) => (
            <div
              key={preset.id}
              className="p-5 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-primary" />
                    <span className="font-mono font-bold text-white text-sm">{preset.name}</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      preset.active
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                    }`}
                  >
                    {preset.active ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">{preset.description}</p>
              </div>

              <div className="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">Eventos:</span>
                  <div className="flex gap-1">
                    {preset.events.map((ev, i) => (
                      <span key={i} className="text-[10px] px-1.5 py-0.2 rounded bg-secondary font-mono text-primary font-medium">
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  Peso: <span className="font-mono font-bold text-white">{preset.weight}</span> | Parâmetros: <span className="font-mono font-bold text-white">{preset.configurationsCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
