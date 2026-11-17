"use client";

import { useState } from "react";
import { LanDevice } from "@citacs/shared";
import { 
  Laptop, 
  Smartphone, 
  Camera, 
  Tv, 
  Wifi, 
  Cable, 
  HardDrive, 
  Search, 
  Filter,
  CheckCircle2,
  Clock,
  Sparkles
} from "lucide-react";

interface LanDevicesProps {
  hosts?: LanDevice[];
}

function getDeviceIcon(host: LanDevice) {
  const name = (host.hostName || "").toLowerCase();
  const vendor = (host.vendorClass || "").toLowerCase();

  if (name.includes("cam") || name.includes("im7") || name.includes("gwipc")) {
    return <Camera className="w-4 h-4 text-amber-400" />;
  }
  if (name.includes("tv") || name.includes("roku") || name.includes("chromecast") || name.includes("firestick")) {
    return <Tv className="w-4 h-4 text-blue-400" />;
  }
  if (
    name.includes("a13") ||
    name.includes("moto") ||
    name.includes("iphone") ||
    name.includes("galaxy") ||
    name.includes("xiaomi") ||
    vendor.includes("android") ||
    vendor.includes("ios")
  ) {
    return <Smartphone className="w-4 h-4 text-emerald-400" />;
  }
  if (
    name.includes("pc") ||
    name.includes("ssd") ||
    name.includes("desktop") ||
    name.includes("notebook") ||
    vendor.includes("msft")
  ) {
    return <Laptop className="w-4 h-4 text-indigo-400" />;
  }
  if (host.interfaceType === "Ethernet") {
    return <Cable className="w-4 h-4 text-purple-400" />;
  }
  return <Wifi className="w-4 h-4 text-primary" />;
}

export function LanDevices({ hosts = [] }: LanDevicesProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "active" | "wifi" | "ethernet">("active");

  const activeCount = hosts.filter((h) => h.active).length;
  const totalCount = hosts.length;

  const filtered = hosts.filter((h) => {
    // Filtro de status/interface
    if (filterType === "active" && !h.active) return false;
    if (filterType === "wifi" && !h.interfaceType.startsWith("Wi-Fi")) return false;
    if (filterType === "ethernet" && h.interfaceType !== "Ethernet") return false;

    // Busca textual
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (h.hostName && h.hostName.toLowerCase().includes(term)) ||
      h.ipAddress.includes(term) ||
      h.macAddress.toLowerCase().includes(term) ||
      (h.vendorClass && h.vendorClass.toLowerCase().includes(term))
    );
  });

  return (
    <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-white">Dispositivos Conectados na Rede (LAN)</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {activeCount} {activeCount === 1 ? "Ativo" : "Ativos"}
            </span>
            <span className="text-xs text-muted-foreground font-mono">({totalCount} mapeados)</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tabela de clientes DHCP e associações Wi-Fi (TR-069 LANDevice.Hosts)
          </p>
        </div>

        {/* Filtros rápidos */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            onClick={() => setFilterType("active")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filterType === "active"
                ? "bg-emerald-500 text-white font-semibold"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Ativos ({activeCount})
          </button>
          <button
            onClick={() => setFilterType("wifi")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filterType === "wifi"
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Wi-Fi
          </button>
          <button
            onClick={() => setFilterType("ethernet")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filterType === "ethernet"
                ? "bg-purple-600 text-white font-semibold"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Cabo
          </button>
          <button
            onClick={() => setFilterType("all")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filterType === "all"
                ? "bg-zinc-700 text-white font-semibold"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos ({totalCount})
          </button>
        </div>
      </div>

      {/* Input de Busca */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
        <input
          type="text"
          placeholder="Filtrar por nome, IP ou MAC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-secondary/40 border border-border rounded-xl pl-9 pr-4 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Lista de Dispositivos */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground bg-secondary/10 rounded-xl border border-dashed border-border">
          Nenhum dispositivo encontrado com os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((host, idx) => (
            <div
              key={`${host.macAddress}-${idx}`}
              className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                host.active
                  ? "bg-card border-border hover:border-primary/50 shadow-sm"
                  : "bg-card/40 border-border/60 opacity-70"
              }`}
            >
              {/* Top: Ícone + Nome + Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 rounded-lg bg-secondary border border-border/80 shrink-0">
                    {getDeviceIcon(host)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs text-white truncate" title={host.hostName || "Dispositivo sem nome"}>
                      {host.hostName || "Dispositivo sem nome"}
                    </h4>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {host.vendorClass || host.interfaceType}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 font-medium flex items-center gap-1 ${
                    host.active
                      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                      : "text-zinc-500 border-border bg-secondary/40"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      host.active ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                    }`}
                  />
                  {host.active ? "Ativo" : "Inativo"}
                </span>
              </div>

              {/* Detalhes de Rede */}
              <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div>
                  <span className="text-[10px] text-zinc-500 block">IP LAN:</span>
                  <span className="text-foreground font-semibold">{host.ipAddress}</span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block">MAC:</span>
                  <span className="text-muted-foreground text-[10px] truncate block" title={host.macAddress}>
                    {host.macAddress}
                  </span>
                </div>
              </div>

              {/* Tag da Interface */}
              <div className="pt-1 flex items-center justify-between text-[10px]">
                <span
                  className={`px-2 py-0.5 rounded-md font-medium border ${
                    host.interfaceType === "Wi-Fi 5GHz"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : host.interfaceType === "Wi-Fi 2.4GHz"
                      ? "bg-primary/10 text-primary border-primary/20"
                      : host.interfaceType === "Ethernet"
                      ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                      : "bg-secondary text-muted-foreground border-border"
                  }`}
                >
                  {host.interfaceType}
                </span>

                {host.leaseTimeRemaining ? (
                  <span className="text-muted-foreground font-mono">
                    Lease: {Math.round(host.leaseTimeRemaining / 3600)}h
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
