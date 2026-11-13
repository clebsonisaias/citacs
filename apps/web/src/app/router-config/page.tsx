"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { 
  BookOpen, 
  Copy, 
  Check, 
  Radio, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  ShieldCheck,
  Cpu,
  Wifi,
  Terminal,
  HelpCircle
} from "lucide-react";

interface RouterBrand {
  id: string;
  name: string;
  badge: string;
  models: string;
  menuPath: string;
  steps: string[];
  notes?: string;
}

const ROUTER_BRANDS: RouterBrand[] = [
  {
    id: "huawei",
    name: "Huawei",
    badge: "GPON ONT",
    models: "EchoLife HG8145V5, HG8245Q2, EG8145V5, HG8245H",
    menuPath: "Network Application → TR-069 (ou System Tools → TR-069)",
    steps: [
      "Acesse o IP da ONT no navegador (geralmente 192.168.100.1 ou 192.168.18.1).",
      "Faça login com usuário de suporte/telecom (ex: telecomadmin / admintelecom ou Epadmin / adminEp).",
      "No menu superior, vá em 'Network Application' ou 'System Tools' e clique em 'TR-069'.",
      "Marque a caixa 'Enable TR-069' (Habilitar TR-069).",
      "Em 'ACS URL', cole o endereço do CITacs: http://170.82.252.195:7550",
      "Em 'Periodic Inform', marque como 'Enable'.",
      "Defina 'Periodic Inform Interval' para 300 segundos.",
      "Em 'Connection Request Username' e 'Password', você pode definir as credenciais locais ou deixar em branco se usar o preset padrão.",
      "Clique em 'Apply' para salvar. A ONT enviará o primeiro Inform em instantes."
    ],
    notes: "Certifique-se de que a rota WAN (VLAN de internet ou gerência) possua rota ativa com saída para a internet."
  },
  {
    id: "zte",
    name: "ZTE",
    badge: "GPON ONT / Wi-Fi 6",
    models: "ZXHN F670L, F680, F6600P, F601",
    menuPath: "Administration → TR-069 Management",
    steps: [
      "Acesse a interface web da ONT (geralmente 192.168.1.1).",
      "Entre com o usuário de administração ISP.",
      "No menu lateral, navegue até 'Administration' → 'TR-069 Management'.",
      "No campo 'URL', insira: http://170.82.252.195:7550",
      "Habilite 'Periodic Inform' (marcar Enabled).",
      "Configure o 'Periodic Inform Interval' para 300 segundos.",
      "Marque 'Authentication' se configurado, ou mantenha os valores padrão.",
      "Clique em 'Submit' para aplicar. O status mudará para conectado no painel."
    ],
    notes: "Modelos F670L novos sincronizam todos os parâmetros de rádio Wi-Fi 2.4GHz e 5GHz automaticamente após o primeiro Inform."
  },
  {
    id: "intelbras",
    name: "Intelbras",
    badge: "ONT & Roteador Mesh",
    models: "Wi-Force GF 1200, W5-1200F, GX 3000, 121 AC",
    menuPath: "Configurações Avançadas → Gerenciamento Remoto → TR-069",
    steps: [
      "Abra 192.168.0.1 ou 10.0.0.1 e faça login com a senha de suporte do provedor.",
      "Vá em 'Configurações Avançadas' ou 'Sistema' → 'Gerenciamento Remoto'.",
      "Ative a chave 'Gerenciamento TR-069 / CWMP'.",
      "Insira no campo 'Endereço do Servidor ACS': http://170.82.252.195:7550",
      "Defina 'Inform Periódico' como Ativado.",
      "Ajuste o intervalo para 300 segundos.",
      "Clique em 'Salvar' e aguarde a reinicialização dos serviços de telemetria."
    ],
    notes: "Linha Wi-Force suporta diagnósticos completos de Wi-Fi e alteração remota de canal e senha pelo CITacs."
  },
  {
    id: "fiberhome",
    name: "Fiberhome",
    badge: "GPON ONU",
    models: "AN5506-02-B, AN5506-04, HG6245D",
    menuPath: "Management → TR-069 Config",
    steps: [
      "Acesse o IP 192.168.1.1 pelo navegador.",
      "Autentique-se com credenciais de operador (ex: admin / admin ou de seu provedor).",
      "Clique na guia 'Management' e selecione 'TR-069'.",
      "Marque a opção 'Enable TR-069'.",
      "No campo 'ACS URL', digite: http://170.82.252.195:7550",
      "Habilite 'Periodic Inform' e coloque 300 em 'Periodic Inform Interval'.",
      "Clique em 'Apply' para confirmar as alterações."
    ]
  },
  {
    id: "tplink",
    name: "TP-Link",
    badge: "Agile / Aginet ISP",
    models: "EX220, XC220-G3v, EC220-G5, Archer C6 ISP",
    menuPath: "Ferramentas do Sistema → CWMP / TR-069",
    steps: [
      "Abra a página de configuração do TP-Link (192.168.0.1 ou 192.168.1.1).",
      "Navegue em 'Avançado' → 'Ferramentas do Sistema' → 'CWMP'.",
      "Marque 'Ativar CWMP' (Habilitar).",
      "No campo 'URL do ACS', cole: http://170.82.252.195:7550",
      "Marque 'Informar' como Ativado e configure o intervalo para 300.",
      "Clique em 'Salvar'."
    ],
    notes: "Modelos Aginet com Agile Config já podem ser pré-provisionados com essa URL de fábrica."
  }
];

export default function RouterConfigGuidePage() {
  const [selectedBrand, setSelectedBrand] = useState<string>("huawei");
  const [copied, setCopied] = useState<boolean>(false);

  const acsUrl = "http://170.82.252.195:7550";

  const handleCopy = () => {
    navigator.clipboard.writeText(acsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const current = ROUTER_BRANDS.find((b) => b.id === selectedBrand) || ROUTER_BRANDS[0];

  return (
    <>
      <Header />

      <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Banner Top */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-card via-card to-primary/10 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-mono font-medium mb-1">
              <BookOpen className="w-3.5 h-3.5" />
              Guia Prático de Provisionamento TR-069
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Como Configurar Roteadores e ONTs no CITacs
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Passo a passo por fabricante para apontar suas CPEs para o servidor GenieACS CWMP da CITmax &amp; Netgo.
            </p>
          </div>

          {/* Quick Copy Box */}
          <div className="p-3 rounded-xl bg-secondary/80 border border-primary/30 flex items-center gap-3 self-start md:self-auto shrink-0 shadow-lg">
            <div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">URL do ACS (CWMP)</div>
              <div className="font-mono text-xs sm:text-sm font-semibold text-primary">{acsUrl}</div>
            </div>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
              title="Copiar URL"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Global Parameters Summary Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-card border border-border space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium">Endereço ACS URL</div>
            <div className="text-xs sm:text-sm font-mono font-bold text-primary truncate">{acsUrl}</div>
            <div className="text-[10px] text-muted-foreground">Porta HTTP 7550 (Pública)</div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium">Periodic Inform</div>
            <div className="text-xs sm:text-sm font-bold text-emerald-400">Ativado (Enabled)</div>
            <div className="text-[10px] text-muted-foreground">Obrigatório para telemetria</div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium">Inform Interval</div>
            <div className="text-xs sm:text-sm font-bold text-white">300 segundos (5 min)</div>
            <div className="text-[10px] text-muted-foreground">Atualização de status e sinal</div>
          </div>
          <div className="p-4 rounded-xl bg-card border border-border space-y-1">
            <div className="text-[11px] text-muted-foreground font-medium">Connection Request</div>
            <div className="text-xs sm:text-sm font-bold text-white">Porta 7547</div>
            <div className="text-[10px] text-muted-foreground">Para reboot e comandos em tempo real</div>
          </div>
        </div>

        {/* Brand Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-border">
          {ROUTER_BRANDS.map((brand) => {
            const active = selectedBrand === brand.id;
            return (
              <button
                key={brand.id}
                onClick={() => setSelectedBrand(brand.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "bg-card border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <span>{brand.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  active ? "bg-black/30 text-white" : "bg-secondary text-muted-foreground"
                }`}>
                  {brand.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Brand Detail Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-border/80 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-white">{current.name}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-mono">{current.badge}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Modelos suportados: {current.models}</p>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-lg border border-border/50">
              <span className="font-semibold text-foreground">Menu:</span>
              <span className="font-mono text-primary truncate max-w-xs">{current.menuPath}</span>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Passo a Passo de Configuração
            </h3>

            <ol className="space-y-2.5">
              {current.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/20 border border-border/50 text-xs sm:text-sm">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-foreground leading-relaxed">
                    {step.includes(acsUrl) ? (
                      <>
                        {step.split(acsUrl)[0]}
                        <code className="px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono font-bold select-all">
                          {acsUrl}
                        </code>
                        {step.split(acsUrl)[1]}
                      </>
                    ) : (
                      step
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {current.notes && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-300">Dica Técnica: </span>
                {current.notes}
              </div>
            </div>
          )}
        </div>

        {/* Provisioning via OLT / DHCP Option 43 */}
        <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary" />
            Provisionamento Automático via OLT ou DHCP (Option 43)
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Para evitar configurar ONT por ONT manualmente na casa do cliente, você pode automatizar o apontamento para o CITacs no ato da ativação:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
              <span className="font-semibold text-white text-xs sm:text-sm">1. DHCP Option 43 (VLAN de Gerência)</span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                No servidor DHCP da rede de gerência (Mikrotik, Huawei ou OLT), adicione a Option 43 com a URL <code className="text-primary font-mono">{acsUrl}</code>. Quando a ONT ligar pela primeira vez e pegar IP, ela se cadastra automaticamente no GenieACS.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
              <span className="font-semibold text-white text-xs sm:text-sm">2. Profile OMCI na OLT (ZTE / Huawei / Fiberhome)</span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Você pode criar um perfil OMCI na OLT aplicando a URL do ACS diretamente no momento da autorização da ONT (Bridge ou Router), dispensando acesso técnico à interface web da ONT.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
