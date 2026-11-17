"use client";

import { useEffect, useState } from "react";
import { ZtpRegistroLog } from "@citacs/shared";
import {
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  Terminal,
  RefreshCw,
  Search,
  Server,
  Wifi,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";

interface OltConfigGuide {
  fabricante: string;
  subtitulo: string;
  descricao: string;
  comandos: string;
}

const OLT_GUIDES: Record<string, OltConfigGuide> = {
  huawei: {
    fabricante: "Huawei",
    subtitulo: "SmartAX MA5608T / MA5800 / MA5683T",
    descricao: "Criar o perfil de TR-069 e associar ao profile de serviço (srvprofile) que o SGP já utiliza para autorizar as ONTs.",
    comandos: `// 1. Acessar o modo de configuração global
enable
config

// 2. Criar o perfil de TR-069 com a URL do GenieACS
ont tr069-server-profile add profile-id 10 url http://acs.citmax.com.br:7550 user citacs password citacs

// 3. Vincular o perfil de TR-069 ao srvprofile que o SGP usa nas ativações (ex: profile 10 ou o seu profile padrão)
ont srvprofile gpon profile-id 10
  tr069-server-profile profile-id 10
  commit
quit

// 4. Salvar as alterações na OLT
save`,
  },
  zte: {
    fabricante: "ZTE",
    subtitulo: "ZXA10 C300 / C320 / C600 / C620",
    descricao: "Configuração do perfil de gerência TR-069 OMCI para injeção automática da URL nas ONTs autorizadas.",
    comandos: `// 1. Entrar no modo de configuração
configure terminal

// 2. Configurar perfil de gerência TR-069
pon
  onu-profile tr069 name CITACS_ACS
    acs-url http://acs.citmax.com.br:7550
    username citacs
    password citacs
    inform-enable enable
    inform-interval 300
  exit
exit

// 3. Vincular ao perfil de ativação (onu-type ou srv-profile)
// As ONTs autorizadas pelo SGP passam a receber a URL do ACS automaticamente`,
  },
  fiberhome: {
    fabricante: "Fiberhome",
    subtitulo: "AN5516-01 / AN5516-04 / AN5516-06 / AN6000",
    descricao: "Configuração do template TR-069 no UNM2000 ou via interface CLI OMCI.",
    comandos: `// Via CLI ou UNM2000 (Gerenciador de Modelos):
// 1. Em 'Service Configuration' -> 'ONT Template Management'
// 2. Selecionar o Template de ONT de Internet
// 3. Na aba 'TR-069 Configuration':
//    - ACS URL: http://acs.citmax.com.br:7550
//    - Username: citacs
//    - Password: citacs
//    - Periodic Inform: Enable (Intervalo: 300s)
// 4. Aplicar o template aos perfis de autorização do SGP`,
  },
  datacom: {
    fabricante: "Datacom",
    subtitulo: "DM4610 / DM4615 (DMOS)",
    descricao: "Configurar o perfil TR-069 no DMOS e vincular ao gpon profile de serviço.",
    comandos: `// 1. Configurar o perfil TR-069 no DMOS
configure
profile tr-069 CITACS_ACS
  acs-url http://acs.citmax.com.br:7550
  username citacs
  password citacs
  periodic-inform interval 300
exit

// 2. Atribuir ao profile de serviço da GPON
profile gpon-service SERVICO_PADRAO
  tr-069-profile CITACS_ACS
commit
`,
  },
  intelbras: {
    fabricante: "Intelbras",
    subtitulo: "G08 / G16 / OLT Standalone",
    descricao: "Configuração via WebGUI ou CLI de perfis OMCI para auto-provisionamento TR-069.",
    comandos: `// 1. No menu 'Gerência PON' -> 'Perfis de ONT' -> 'Perfil TR-069':
// 2. Adicionar novo perfil:
//    - Nome: CITACS_TR069
//    - URL ACS: http://acs.citmax.com.br:7550
//    - Usuário: citacs
//    - Senha: citacs
//    - Periodic Inform: 300 segundos
// 3. Vincular este perfil ao Perfil de Linha/Serviço padrão utilizado pelo SGP`,
  },
};

export default function ZtpPage() {
  const [logs, setLogs] = useState<ZtpRegistroLog[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<"logs" | "olt">("logs");
  const [fabricanteOlt, setFabricanteOlt] = useState<string>("huawei");
  const [copiadoOlt, setCopiadoOlt] = useState(false);
  const [busca, setBusca] = useState("");

  const carregarLogs = async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/ztp/logs?limite=100");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (e) {
      console.error("Falha ao carregar logs ZTP:", e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarLogs();
  }, []);

  const copiarComandos = () => {
    const guia = OLT_GUIDES[fabricanteOlt];
    if (guia) {
      navigator.clipboard.writeText(guia.comandos);
      setCopiadoOlt(true);
      setTimeout(() => setCopiadoOlt(false), 3000);
    }
  };

  const logsFiltrados = logs.filter((l) => {
    if (!busca) return true;
    const b = busca.toLowerCase();
    return (
      l.serial.toLowerCase().includes(b) ||
      (l.clienteNome && l.clienteNome.toLowerCase().includes(b)) ||
      (l.pppoeLogin && l.pppoeLogin.toLowerCase().includes(b)) ||
      (l.contratoId && String(l.contratoId).includes(b))
    );
  });

  const totalSucesso = logs.filter((l) => l.status === "SUCESSO").length;
  const totalPendentes = logs.filter((l) => l.status === "PENDENTE_SGP").length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Zap className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Auto-Provisionamento Zero-Touch (ZTP)
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              SGP FTTX Conectado
            </span>
          </div>
          <p className="text-sm text-neutral-400 mt-1">
            Ativação 100% automática de ONTs tiradas da caixa: injeção de PPPoE, VLAN e Wi-Fi via OMCI + TR-069 sem acesso manual.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAbaAtiva("olt")}
            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
              abaAtiva === "olt"
                ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            <Terminal className="w-4 h-4" />
            Guia OLT p/ Rede
          </button>
          <button
            onClick={() => setAbaAtiva("logs")}
            className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors flex items-center gap-2 ${
              abaAtiva === "logs"
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            <Layers className="w-4 h-4" />
            Histórico ZTP
          </button>
          <button
            onClick={carregarLogs}
            disabled={carregando}
            className="p-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg border border-neutral-800 transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-400">Total de Eventos ZTP</span>
            <Layers className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-white">{logs.length}</div>
          <p className="mt-1 text-xs text-neutral-500">Requisições 0 BOOTSTRAP recebidas</p>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-400">Provisionados com Sucesso</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-emerald-400">{totalSucesso}</div>
          <p className="mt-1 text-xs text-neutral-500">Vinculados e configurados via SGP</p>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-400">Aguardando SGP FTTX</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-3xl font-bold text-amber-400">{totalPendentes}</div>
          <p className="mt-1 text-xs text-neutral-500">Aguardando o instalador autorizar no SGP</p>
        </div>
      </div>

      {/* Conteúdo da Aba Ativa */}
      {abaAtiva === "olt" ? (
        <div className="rounded-xl bg-neutral-900/60 border border-neutral-800 p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
            <div>
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-sky-400" />
                <h2 className="text-lg font-semibold text-white">
                  Instruções para a Equipe de Rede (Configuração na OLT)
                </h2>
              </div>
              <p className="text-sm text-neutral-400 mt-1">
                A OLT entrega a URL do TR-069 via fibra (OMCI) no momento em que a ONT é autorizada.
              </p>
            </div>

            <button
              onClick={copiarComandos}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {copiadoOlt ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiadoOlt ? "✓ Comandos Copiados!" : "Copiar Comandos p/ WhatsApp"}
            </button>
          </div>

          {/* Seleção do Fabricante da OLT */}
          <div className="flex flex-wrap gap-2">
            {Object.keys(OLT_GUIDES).map((key) => {
              const item = OLT_GUIDES[key];
              const ativo = fabricanteOlt === key;
              return (
                <button
                  key={key}
                  onClick={() => setFabricanteOlt(key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    ativo
                      ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                      : "bg-neutral-800/60 text-neutral-400 border-neutral-700/60 hover:bg-neutral-800"
                  }`}
                >
                  {item.fabricante}
                </button>
              );
            })}
          </div>

          {/* Detalhes do Fabricante Selecionado */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">
                  {OLT_GUIDES[fabricanteOlt].fabricante} — {OLT_GUIDES[fabricanteOlt].subtitulo}
                </h3>
                <p className="text-sm text-neutral-400 mt-0.5">
                  {OLT_GUIDES[fabricanteOlt].descricao}
                </p>
              </div>
            </div>

            <div className="relative">
              <pre className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-sm font-mono text-neutral-200 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                {OLT_GUIDES[fabricanteOlt].comandos}
              </pre>
            </div>
          </div>

          {/* Parâmetros Globais para a Rede */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-neutral-800">
            <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80">
              <span className="text-xs text-neutral-500">URL ACS TR-069</span>
              <div className="text-sm font-mono font-medium text-emerald-400 mt-0.5">
                http://acs.citmax.com.br:7550
              </div>
            </div>
            <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80">
              <span className="text-xs text-neutral-500">Credenciais OMCI</span>
              <div className="text-sm font-mono font-medium text-neutral-200 mt-0.5">
                user: citacs | pass: citacs
              </div>
            </div>
            <div className="p-3 rounded-lg bg-neutral-950/60 border border-neutral-800/80">
              <span className="text-xs text-neutral-500">Intervalo de Inform (Keep-Alive)</span>
              <div className="text-sm font-mono font-medium text-neutral-200 mt-0.5">
                300 segundos (5 min)
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Aba de Logs de Ativações */
        <div className="rounded-xl bg-neutral-900/60 border border-neutral-800 overflow-hidden">
          <div className="p-4 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Filtrar por serial, login PPPoE ou nome do cliente..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="bg-transparent text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none w-full sm:w-80"
              />
            </div>
            <span className="text-xs text-neutral-400">
              {logsFiltrados.length} ocorrência(s) encontrada(s)
            </span>
          </div>

          {logsFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex p-3 rounded-full bg-neutral-800/60 text-neutral-400 mb-3">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-base font-medium text-white">Nenhum evento ZTP registrado ainda</h3>
              <p className="text-sm text-neutral-400 mt-1 max-w-md mx-auto">
                Assim que a equipe de rede aplicar o perfil de TR-069 na OLT e a próxima ONT nova conectar, ela aparecerá automaticamente aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-neutral-300">
                <thead className="bg-neutral-950/60 text-xs uppercase font-medium text-neutral-400 border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Data / Hora</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Serial / MAC</th>
                    <th className="px-4 py-3">Assinante / Contrato</th>
                    <th className="px-4 py-3">Login PPPoE</th>
                    <th className="px-4 py-3">VLAN / Wi-Fi</th>
                    <th className="px-4 py-3">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {logsFiltrados.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-neutral-400 whitespace-nowrap">
                        {new Date(log.criadoEm).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.status === "SUCESSO" && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Provisionado
                          </span>
                        )}
                        {log.status === "PENDENTE_SGP" && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" />
                            Aguardando SGP
                          </span>
                        )}
                        {log.status === "ERRO" && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            <AlertTriangle className="w-3 h-3" />
                            Erro
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-white whitespace-nowrap">
                        <div>{log.serial}</div>
                        {log.mac && <div className="text-neutral-500 text-[10px]">{log.mac}</div>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-white">{log.clienteNome || "—"}</div>
                        {log.contratoId && (
                          <div className="text-xs text-neutral-500">Contrato: {log.contratoId}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-emerald-400 whitespace-nowrap">
                        {log.pppoeLogin || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-300 whitespace-nowrap">
                        <div>VLAN: {log.vlan ?? "Padrão"}</div>
                        {log.wifiSsid && (
                          <div className="text-neutral-500 text-[10px]">SSID: {log.wifiSsid}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-400 max-w-xs truncate" title={log.detalhes}>
                        {log.detalhes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
