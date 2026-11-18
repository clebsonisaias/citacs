"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { CampanhaFirmware } from "@citacs/shared";
import {
  Cpu,
  RefreshCw,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Layers,
  ArrowRight,
  ShieldCheck,
  Server,
  Zap,
} from "lucide-react";

export default function FirmwaresPage() {
  const [inventario, setInventario] = useState<any[]>([]);
  const [campanhas, setCampanhas] = useState<CampanhaFirmware[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<"inventario" | "campanhas">("inventario");

  // Modal nova campanha
  const [modalAberta, setModalAberta] = useState(false);
  const [nome, setNome] = useState("");
  const [fabricante, setFabricante] = useState("Huawei");
  const [modelo, setModelo] = useState("WS7001-40");
  const [versaoOrigem, setVersaoOrigem] = useState("10.0.5.26");
  const [versaoDestino, setVersaoDestino] = useState("10.0.5.33");
  const [arquivoUrl, setArquivoUrl] = useState("http://acs.citmax.com.br:7557/fs/firmwares/huawei_ws7001_v33.bin");
  const [salvando, setSalvando] = useState(false);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [resInv, resCamp] = await Promise.all([
        fetch("/api/firmwares/inventario"),
        fetch("/api/firmwares/campanhas"),
      ]);
      if (resInv.ok) setInventario(await resInv.json());
      if (resCamp.ok) setCampanhas(await resCamp.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleCriarCampanha = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await fetch("/api/firmwares/campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          fabricante,
          modelo,
          versaoOrigem,
          versaoDestino,
          arquivoFirmwareUrl: arquivoUrl,
          janelaInicio: "03:00",
          janelaFim: "05:00",
          limitePorHora: 50,
        }),
      });
      if (res.ok) {
        setModalAberta(false);
        setNome("");
        carregarDados();
      }
    } catch (err) {
      alert("Erro ao criar campanha");
    } finally {
      setSalvando(false);
    }
  };

  const totalAparelhos = inventario.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Banner do Módulo */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-br from-indigo-500/15 via-card to-card border border-indigo-500/25 shadow-sm">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                Gerência de Firmwares & OTA
              </span>
              <span className="text-xs text-muted-foreground">· GenieACS File Server + TR-069</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Atualização de Firmware em Massa (OTA)
            </h1>
            <p className="text-sm text-zinc-300 max-w-2xl leading-relaxed">
              Mapeamento de versões da frota e agendamento de campanhas noturnas (03:00 - 05:00) com limitação de taxa por hora para evitar sobrecarga.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalAberta(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-sm font-semibold text-primary-foreground shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Campanha OTA</span>
            </button>
            <button
              onClick={carregarDados}
              disabled={loading}
              className="p-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <button
            onClick={() => setAba("inventario")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              aba === "inventario"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Inventário de Versões ({inventario.length} variantes)</span>
          </button>
          <button
            onClick={() => setAba("campanhas")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
              aba === "campanhas"
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "bg-secondary/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Campanhas Agendadas ({campanhas.length})</span>
          </button>
        </div>

        {/* Conteúdo Aba 1: Inventário */}
        {aba === "inventario" && (
          <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Versões Instaladas na Base ACS</h3>
              <span className="text-xs text-muted-foreground font-mono">
                Total de Aparelhos Catalogados: <strong className="text-white">{totalAparelhos}</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-neutral-300">
                <thead className="bg-neutral-950/60 text-xs uppercase font-medium text-neutral-400 border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Fabricante</th>
                    <th className="px-4 py-3">Modelo</th>
                    <th className="px-4 py-3">Versão de Software Atual</th>
                    <th className="px-4 py-3">Aparelhos na Base</th>
                    <th className="px-4 py-3">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono text-xs">
                  {inventario.map((item, idx) => (
                    <tr key={idx} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-sans font-medium text-white">{item.fabricante}</td>
                      <td className="px-4 py-3 text-neutral-200">{item.modelo}</td>
                      <td className="px-4 py-3 text-indigo-400">{item.versao}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{item.total}</span>
                          <span className="text-neutral-500 text-[10px]">
                            ({totalAparelhos > 0 ? Math.round((item.total / totalAparelhos) * 100) : 0}%)
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setFabricante(item.fabricante);
                            setModelo(item.modelo);
                            setVersaoOrigem(item.versao);
                            setNome(`Campanha ${item.modelo} Update`);
                            setModalAberta(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-[11px] font-sans font-semibold transition-colors"
                        >
                          Criar Campanha OTA
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Conteúdo Aba 2: Campanhas */}
        {aba === "campanhas" && (
          <div className="space-y-4">
            {campanhas.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-2">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto" />
                <h4 className="text-sm font-semibold text-white">Nenhuma campanha criada ainda</h4>
                <p className="text-xs text-muted-foreground">
                  Clique em &quot;Nova Campanha OTA&quot; para agendar um lote de atualização noturno.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {campanhas.map((camp) => (
                  <div key={camp.id} className="p-5 rounded-2xl bg-card border border-border space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/30">
                          {camp.status}
                        </span>
                        <h4 className="font-semibold text-sm text-white">{camp.nome}</h4>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        Janela: <strong>{camp.janelaInicio} às {camp.janelaFim}</strong> ({camp.limitePorHora} ONTs/h)
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs font-mono text-zinc-400">
                      <span>Equipamento: <strong className="text-white">{camp.fabricante} {camp.modelo}</strong></span>
                      <span className="flex items-center gap-1.5">
                        De: <strong className="text-amber-400">{camp.versaoOrigem}</strong>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        Para: <strong className="text-emerald-400">{camp.versaoDestino}</strong>
                      </span>
                      <span>Alvos Detectados: <strong className="text-white">{camp.totalAlvos}</strong></span>
                    </div>

                    <div className="text-[11px] font-mono text-muted-foreground truncate" title={camp.arquivoFirmwareUrl}>
                      URL Firmware: {camp.arquivoFirmwareUrl}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Nova Campanha */}
        {modalAberta && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-card border border-border rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="font-semibold text-base text-white">Nova Campanha OTA Noturna</h3>
                <button onClick={() => setModalAberta(false)} className="text-muted-foreground hover:text-white">✕</button>
              </div>

              <form onSubmit={handleCriarCampanha} className="space-y-3 text-xs">
                <div>
                  <label className="text-muted-foreground block mb-1">Nome da Campanha:</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Atualização Huawei WS7001 Estabilidade Wi-Fi"
                    className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-muted-foreground block mb-1">Fabricante:</label>
                    <input
                      type="text"
                      required
                      value={fabricante}
                      onChange={(e) => setFabricante(e.target.value)}
                      className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Modelo:</label>
                    <input
                      type="text"
                      required
                      value={modelo}
                      onChange={(e) => setModelo(e.target.value)}
                      className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-muted-foreground block mb-1">Versão de Origem (Alvo):</label>
                    <input
                      type="text"
                      required
                      value={versaoOrigem}
                      onChange={(e) => setVersaoOrigem(e.target.value)}
                      className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Versão de Destino:</label>
                    <input
                      type="text"
                      required
                      value={versaoDestino}
                      onChange={(e) => setVersaoDestino(e.target.value)}
                      className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-muted-foreground block mb-1">URL do Binário no GenieACS FS:</label>
                  <input
                    type="text"
                    required
                    value={arquivoUrl}
                    onChange={(e) => setArquivoUrl(e.target.value)}
                    className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-foreground font-mono"
                  />
                </div>

                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-muted-foreground">
                  A campanha é executada automaticamente durante a <strong>janela de manutenção (03:00 às 05:00)</strong> para não interromper os clientes da NetGo.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalAberta(false)}
                    className="px-4 py-2 rounded-xl bg-secondary text-foreground hover:bg-secondary/80"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvando}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                  >
                    {salvando ? "Salvando..." : "Agendar Campanha"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
