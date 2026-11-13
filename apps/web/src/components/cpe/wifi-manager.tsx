"use client";

import { useState } from "react";
import { WifiRadio } from "@citacs/shared";
import { Wifi, Lock, Radio, Save, Check } from "lucide-react";

interface WifiManagerProps {
  cpeId: string;
  wifiRadios?: WifiRadio[];
  onUpdated?: () => void;
}

export function WifiManager({ cpeId, wifiRadios, onUpdated }: WifiManagerProps) {
  const [loadingBand, setLoadingBand] = useState<string | null>(null);
  const [successBand, setSuccessBand] = useState<string | null>(null);

  // Form states
  const radio24 = wifiRadios?.find((r) => r.band === "2.4GHz");
  const radio5G = wifiRadios?.find((r) => r.band === "5GHz");

  const [form24, setForm24] = useState({
    ssid: radio24?.ssid || "",
    password: "",
    channel: radio24?.channel === "auto" ? 0 : radio24?.channel || 0,
  });

  const [form5G, setForm5G] = useState({
    ssid: radio5G?.ssid || "",
    password: "",
    channel: radio5G?.channel === "auto" ? 0 : radio5G?.channel || 0,
  });

  const handleSave = async (band: "2.4GHz" | "5GHz") => {
    setLoadingBand(band);
    const data = band === "2.4GHz" ? form24 : form5G;

    try {
      const res = await fetch(`/api/cpes/${encodeURIComponent(cpeId)}/wifi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          band,
          ssid: data.ssid || undefined,
          password: data.password || undefined,
          channel: data.channel ? Number(data.channel) : undefined,
        }),
      });

      if (res.ok) {
        setSuccessBand(band);
        setTimeout(() => setSuccessBand(null), 3000);
        onUpdated?.();
      } else {
        alert("Erro ao aplicar alterações de Wi-Fi.");
      }
    } catch (err) {
      console.error(err);
      alert("Falha de conexão com a API.");
    } finally {
      setLoadingBand(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 2.4 GHz Card */}
      <div className="p-4 rounded-xl bg-card border border-border space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Wi-Fi 2.4 GHz</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
            Maior Alcance
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <label className="text-muted-foreground block mb-1">Nome da Rede (SSID):</label>
            <input
              type="text"
              value={form24.ssid}
              onChange={(e) => setForm24({ ...form24, ssid: e.target.value })}
              className="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-muted-foreground block mb-1">Nova Senha (Pre-Shared Key):</label>
            <div className="relative">
              <input
                type="password"
                placeholder="Deixe em branco para manter a atual"
                value={form24.password}
                onChange={(e) => setForm24({ ...form24, password: e.target.value })}
                className="w-full bg-secondary/50 border border-border rounded-lg pl-8 pr-2.5 py-1.5 text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <Lock className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
            </div>
          </div>

          <div>
            <label className="text-muted-foreground block mb-1">Canal:</label>
            <select
              value={form24.channel}
              onChange={(e) => setForm24({ ...form24, channel: Number(e.target.value) })}
              className="w-full bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="0">Automático (Recomendado)</option>
              <option value="1">Canal 1 (2412 MHz)</option>
              <option value="6">Canal 6 (2437 MHz)</option>
              <option value="11">Canal 11 (2462 MHz)</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => handleSave("2.4GHz")}
          disabled={loadingBand === "2.4GHz"}
          className="w-full mt-2 flex items-center justify-center gap-2 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {successBand === "2.4GHz" ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-300" />
              <span>Salvo com Sucesso!</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Alterações (2.4GHz)</span>
            </>
          )}
        </button>
      </div>

      {/* 5 GHz Card */}
      <div className="p-4 rounded-xl bg-card border border-border space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm">Wi-Fi 5 GHz (AC/AX)</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            Alta Velocidade
          </span>
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <label className="text-muted-foreground block mb-1">Nome da Rede (SSID):</label>
            <input
              type="text"
              value={form5G.ssid}
              onChange={(e) => setForm5G({ ...form5G, ssid: e.target.value })}
              className="w-full bg-secondary/50 border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-muted-foreground block mb-1">Nova Senha (Pre-Shared Key):</label>
            <div className="relative">
              <input
                type="password"
                placeholder="Deixe em branco para manter a atual"
                value={form5G.password}
                onChange={(e) => setForm5G({ ...form5G, password: e.target.value })}
                className="w-full bg-secondary/50 border border-border rounded-lg pl-8 pr-2.5 py-1.5 text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <Lock className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
            </div>
          </div>

          <div>
            <label className="text-muted-foreground block mb-1">Canal:</label>
            <select
              value={form5G.channel}
              onChange={(e) => setForm5G({ ...form5G, channel: Number(e.target.value) })}
              className="w-full bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
            >
              <option value="0">Automático</option>
              <option value="36">Canal 36 (5180 MHz)</option>
              <option value="40">Canal 40 (5200 MHz)</option>
              <option value="44">Canal 44 (5220 MHz)</option>
              <option value="48">Canal 48 (5240 MHz)</option>
              <option value="149">Canal 149 (5745 MHz)</option>
              <option value="157">Canal 157 (5785 MHz)</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => handleSave("5GHz")}
          disabled={loadingBand === "5GHz"}
          className="w-full mt-2 flex items-center justify-center gap-2 py-1.5 rounded-lg bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-500 transition-colors disabled:opacity-50"
        >
          {successBand === "5GHz" ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-200" />
              <span>Salvo com Sucesso!</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Alterações (5GHz)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
