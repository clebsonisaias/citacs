# CITacs — Plataforma TR-069 Inteligente com Copilot IA

> **CITacs** é a solução de gerenciamento TR-069 de última geração para provedores de internet (ISPs). Ele integra-se diretamente ao **GenieACS** via API NBI interna e adiciona uma camada completa de telemetria, gestão de Wi-Fi e um **Copilot IA** especializado em suporte técnico de NOC.

---

## 🌟 Diferenciais do CITacs

* **Frontend Próprio com IA Integrada:** Esqueça a interface antiga do GenieACS. O CITacs traz um dashboard moderno em Next.js 15 + Tailwind CSS + shadcn/ui.
* **Copilot IA de NOC (Multi-Provider):** Analisa atenuação óptica (dBm), quedas Wi-Fi, saturação de canais 2.4/5GHz e gera laudos técnicos com sugestão de ações em 1 clique (Reboot, ajuste de canal, ordem de serviço para CTO).
* **Gestão de Wi-Fi Remota:** Alteração imediata de SSID, senha WPA2/WPA3 e canal sem necessidade de entrar na casa do assinante.
* **Arquitetura Desacoplada e Segura:** O GenieACS roda isolado; o CITacs se comunica apenas pela rede interna do Docker (`http://nbi:7557`).
* **Pronto para SaaS Multiempresa ou On-Premise:** Estruturado com separação de tenants e instalação independente por provedor.

---

## 🏗️ Estrutura do Monorepo

```
citacs/
├── apps/
│   ├── api/            # Backend NestJS (GenieACS NBI, Módulo IA, CPEs, Tenants)
│   └── web/            # Frontend Next.js 15 (Dashboard, Gestão de ONT, Copilot IA Drawer)
├── packages/
│   └── shared/         # Tipos TypeScript compartilhados (CpeDevice, OpticalPower, AiAction)
├── docker-compose.yml  # Orquestração com PostgreSQL, Redis e conexão ao GenieACS
└── pnpm-workspace.yaml # Monorepo gerenciado por pnpm
```

---

## 🚀 Como Rodar Localmente

### 1. Pré-requisitos
* Node.js v20+ ou v22+
* pnpm v9+ ou v12+
* Docker & Docker Compose

### 2. Instalação de dependências
```bash
pnpm install
pnpm --filter @citacs/shared run build
```

### 3. Executando em Modo Desenvolvimento
```bash
# Executar API (porta 4000) e Frontend (porta 3000)
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000) no seu navegador.

---

## 🌐 Deploy na VPS (Coolify)

1. Conecte o repositório `clebsonisaias/citacs` no Coolify.
2. Certifique-se de vincular a aplicação à rede externa do GenieACS (`mqkobhd3qvrkco4raqdtl5rt`).
3. O Traefik roteará o domínio `https://acs.citmax.com.br` diretamente para o serviço web com SSL Let's Encrypt automático.
