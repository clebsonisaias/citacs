"use client";

import { useEffect, useState } from "react";
import { WifiRadio } from "@citacs/shared";
import { Wifi, Lock, Radio, Save, Check, Loader2 } from "lucide-react";

interface WifiManagerProps {
  cpeId: string;
  wifiRadios?: WifiRadio[];
  onUpdated?: () => void;
}

const CANAIS_24 = [
  { val: 0, label: "Automático (Recomendado)" },
  { val: 1, label: "Canal 1 (2412 MHz)" },
  { val: 2, label: "Canal 2 (2417 MHz)" },
  { val: 3, label: "Canal 3 (2422 MHz)" },
  { val: 4, label: "Canal 4 (2427 MHz)" },
  { val: 5, label: "Canal 5 (2432 MHz)" },
  { val: 6, label: "Canal 6 (2437 MHz)" },
  { val: 7, label: "Canal 7 (2442 MHz)" },
  { val: 8, label: "Canal 8 (2447 MHz)" },
  { val: 9, label: "Canal 9 (2452 MHz)" },
  { val: 10, label: "Canal 10 (2457 MHz)" },
  { val: 11, label: "Canal 11 (2462 MHz)" },
  { val: 12, label: "Canal 12 (2467 MHz)" },
  { val: 13, label: "Canal 13 (2472 MHz)" },
];

const CANAIS_5G = [
  { val: 0, label: "Automático (Recomendado)" },
  { val: 36, label: "Canal 36 (5180 MHz)" },
  { val: 40, label: "Canal 40 (5200 MHz)" },
  { val: 44, label: "Canal 44 (5220 MHz)" },
  { val: 48, label: "Canal 48 (5240 MHz)" },
  { val: 52, label: "Canal 52 (5260 MHz - DFS)" },
  { val: 56, label: "Canal 56 (5280 MHz - DFS)" },
  { val: 60, label: "Canal 60 (5300 MHz - DFS)" },
  { val: 64, label: "Canal 64 (5320 MHz - DFS)" },
  { val: 100, label: "Canal 100 (5500 MHz - DFS)" },
  { val: 104, label: "Canal 104 (5520 MHz - DFS)" },
  { val: 108, label: "Canal 108 (5540 MHz - DFS)" },
  { val: 112, label: "Canal 112 (5560 MHz - DFS)" },
  { val: 116, label: "Canal 116 (5580 MHz - DFS)" },
  { val: 120, label: "Canal 120 (5600 MHz - DFS)" },
  { val: 124, label: "Canal 124 (5620 MHz - DFS)" },
  { val: 128, label: "Canal 128 (5640 MHz - DFS)" },
  { val: 132, label: "Canal 132 (5660 MHz - DFS)" },
  { val: 136, label: "Canal 136 (5680 MHz - DFS)" },
  { val: 140, label: "Canal 140 (5700 MHz - DFS)" },
  { val: 144, label: "Canal 144 (5720 MHz - DFS)" },
  { val: 149, label: "Canal 149 (5745 MHz)" },
  { val: 153, label: "Canal 153 (5765 MHz)" },
  { val: 157, label: "Canal 157 (5785 MHz)" },
  { val: 161, label: "Canal 161 (5805 MHz)" },
  { val: 165, label: "Canal 165 (5825 MHz)" },
];

export function WifiManager({ cpeId, wifiRadios, onUpdated }: WifiManagerProps) {
  const [loadingBand, setLoadingBand] = useState<string | null>(null);
  const [successBand, setSuccessBand] = useState<string | null>(null);

  // Form states
  const radio24 = wifiRadios?.find((r) => r.band === "2.4GHz");
  const radio5G = wifiRadios?.find((r) => r.band === "5GHz");

  const [form24, setForm24] = useState({
    ssid: radio24?.ssid || "",
    password: "",
    channel: radio24?.channel === "auto" ? 0 : Number(radio24?.channel) || 0,
  });

  const [form5G, setForm5G] = useState({
    ssid: radio5G?.ssid || "",
    password: "",
    channel: radio5G?.channel === "auto" ? 0 : Number(radio5G?.channel) || 0,
  });

  // Sincroniza formulário sempre que os parâmetros reais da CPE forem carregados ou atualizados
  useEffect(() => {
    if (radio24) {
      setForm24({
        ssid: radio24.ssid || "",
        password: "",
        channel: radio24.channel === "auto" ? 0 : Number(radio24.channel) || 0,
      });
    }
  }, [radio24?.ssid, radio24?.channel]);

  useEffect(() => {
    if (radio5G) {
      setForm5G({
        ssid: radio5G.ssid || "",
        password: "",
        channel: radio5G.channel === "auto" ? 0 : Number(radio5G.channel) || 0,
      });
    }
  }, [radio5G?.ssid, radio5G?.channel]);

  const handleSave = async (band: "2.4GHz" | "5GHz") => {
    setLoadingBand(band);
    const data = band === "2.4GHz" ? form24 : form5G;

    try {
      const channelVal = data.channel === 0 ? "auto" : data.channel ? Number(data.channel) : undefined;
      const res = await fetch(`/api/cpes/${encodeURIComponent(cpeId)}/wifi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          band,
          ssid: data.ssid || undefined,
          password: data.password || undefined,
          channel: channelVal,
        }),
      });

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        setSuccessBand(band);
        setTimeout(() => setSuccessBand(null), 3500);
        if (json.aplicada) {
          alert(`Configurações de Wi-Fi (${band}) aplicadas com sucesso no roteador!`);
        } else {
          alert(`Configurações de Wi-Fi (${band}) enfileiradas no GenieACS! Serão aplicadas no próximo Inform do roteador.`);
        }
        onUpdated?.();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Erro ao aplicar alterações de Wi-Fi: ${err.message || res.statusText}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Falha de conexão com a API: ${err.message}`);
    } finally {
      setLoadingBand(null);
    }
  };

  if (!radio24 && !radio5G) {
    return (
      <div className="p-6 rounded-xl bg-card border border-border text-center text-xs text-muted-foreground">
        Nenhuma interface Wi-Fi (TR-069 WLANConfiguration) foi reportada por este dispositivo.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 2.4 GHz Card */}
      {radio24 ? (
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm text-white">Wi-Fi 2.4 GHz</span>
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
                {!CANAIS_24.some((c) => c.val === form24.channel) && (
                  <option value={form24.channel}>Canal {form24.channel}</option>
                )}
                {CANAIS_24.map((c) => (
                  <option key={c.val} value={c.val}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => handleSave("2.4GHz")}
            disabled={loadingBand === "2.4GHz"}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loadingBand === "2.4GHz" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Aplicando via TR-069...</span>
              </>
            ) : successBand === "2.4GHz" ? (
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
      ) : (
        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-center text-xs text-muted-foreground">
          Interface 2.4 GHz não disponível nesta CPE
        </div>
      )}

      {/* 5 GHz Card */}
      {radio5G ? (
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold text-sm text-white">Wi-Fi 5 GHz (AC/AX)</span>
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
                {!CANAIS_5G.some((c) => c.val === form5G.channel) && (
                  <option value={form5G.channel}>Canal {form5G.channel}</option>
                )}
                {CANAIS_5G.map((c) => (
                  <option key={c.val} value={c.val}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => handleSave("5GHz")}
            disabled={loadingBand === "5GHz"}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {loadingBand === "5GHz" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Aplicando via TR-069...</span>
              </>
            ) : successBand === "5GHz" ? (
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
      ) : (
        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-center text-xs text-muted-foreground">
          Interface 5 GHz não disponível nesta CPE
        </div>
      )}
    </div>
  );
}
