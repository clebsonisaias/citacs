# Plano: integrar o CITacs ao AtendAI (AtendeHub)

> Escrito em 13/11/2026, depois do primeiro roteador real no GenieACS (cliente Teobaldo,
> Huawei WS7001-40). Ainda **não implementado**.

## Objetivo

Quando o cliente reclama ("a internet tá ruim"), a IA do AtendAI consulta o roteador dele
no CITacs e resolve na conversa, sem abrir OS à toa:

1. `diagnostico_conexao` (já existe): o PPPoE está online?
2. `diagnostico_fibra` (já existe): sinal da fibra (não se aplica a roteador atrás de ONU em bridge).
3. **`diagnostico_wifi` (nova)**: o que o ACS vê na casa. Exemplo real do Teobaldo:
   > Lido às 23:14: o PPPoE está estável há 17 dias. São 6 aparelhos no Wi-Fi e o *Galaxy-A10s*
   > está a -74 dBm, longe do roteador. Camada provável: cobertura. Próximo teste: aproximar o
   > celular do roteador. Evitar: trocar canal.

Isso preenche uma lacuna anotada no AtendAI: na NetGo "não existem nome do Wi-Fi (o SGP não
guarda), ping/config via CPE (sem gerenciador TR-069)".

## Estado atual (13/11/2026)

- GenieACS na VPS `170.82.252.195`: CWMP na porta `7550`, NBI só em `127.0.0.1:7557`.
- URL de provisionamento: `http://cwmp.citmax.com.br:7550` (sem autenticação no GenieACS).
- `https://citmax.com.br/cwmp` (URL antiga do ACS do Maxxi) é desviada para o GenieACS por uma
  regra do Traefik em `/data/coolify/proxy/dynamic/citmax-cwmp-genieacs.yaml`. Apagar o arquivo
  devolve esse caminho para o Maxxi.
- O diagnóstico por camadas (`apps/api/src/modules/genieacs/diagnostico.ts`) já roda e funciona
  sem LLM. É ele que a ferramenta do AtendAI deve consumir.

## Pré-requisitos no CITacs (antes de integrar)

| # | O quê | Por quê |
|---|---|---|
| 1 | Chave de acesso na API (header, por provedor) | Hoje `/api/*` é público: qualquer um lê e altera roteadores. |
| 2 | Busca **exata** por login PPPoE, série da ONU ou IP da WAN | A busca atual procura trecho de texto ("ana" acha "anabela"). Normalizar o login: o roteador manda `Kovausk ` e o SGP tem `kovausk`. |
| 3 | Toda resposta traz **"lido às HH:MM"** (`lastInform` e timestamp do parâmetro) | Regra dos dados ao vivo do AtendAI. Atrás de CGNAT o ACS não chama o roteador (Connection Request); o dado é do último contato. |
| 4 | Contato periódico de 300 s na frota (preset do GenieACS) | O Teobaldo está em 900 s. Com 300 s, "lido às" fica perto do agora. |
| 5 | Separar CPEs por provedor (CITmax × NetGo) | Hoje todo mundo vê todos os roteadores. |
| 6 | Correções achadas em 13/11 | `GET /cpes/:id/parameters` ainda usa `GET /devices/:id` (não existe no NBI); fabricante/modelo de fallback lendo `DeviceID` em vez de `_deviceId`; severidade "critical" para um único aparelho longe; texto "ONT" para roteador; front mostra dados de demonstração enquanto carrega; Mongo do GenieACS reiniciou 47 vezes. |

## No AtendAI (repositório `atendehub`), seguindo os moldes existentes

Caminhos relativos a `apps/api/src`, salvo indicação.

1. **Integração por provedor**: modelo `AcsConfig` (`url`, `tokenCifrado`, `ativo`,
   `ultimoTeste*`), igual a `IsphubConfig` (`schema.prisma`), registrado no escopo de tenant em
   `lib/prisma.ts`.
   - Serviço `services/acsService.ts` com `comAcs(tenantId, fn)` (molde: `services/isphubService.ts`:
     `decifrar`, `comLogDeFalha`, `comDestinoVerificado`, `comConcorrenciaLimitada`).
   - Conector `connectors/citacs.ts` com `fetchComDestino` (molde: `connectors/isphub.ts`).
   - Rotas `routes/acs.ts`: GET sem token, PUT com `cifrar` + auditoria, DELETE, POST `/testar`,
     só ADMIN (molde: `routes/isphub.ts`).
   - Web: `apps/web/src/paginas/IntegracaoAcs.tsx` + rota em `main.tsx` + menu em
     `componentes/Layout.tsx` + chave em `packages/shared/src/funcoes.ts` e
     `services/provisionamento.ts` + **entrada obrigatória em `/ajuda`** (`paginas/Ajuda.tsx`).
2. **Ferramenta `diagnostico_wifi({contrato_id})`** em `ai/tools.ts`, no molde de `diagnostico_fibra`:
   - resolve o contrato com `porContrato` (contrato precisa ser do CPF da conversa);
   - login PPPoE vem do SGP (`servico_login`), nunca do que o cliente digita;
   - entra em `TOOLS_EXIGEM_VERIFICACAO` (mostra nome da rede e aparelhos da casa);
   - recusa contrato suspenso ou reduzido (`recusaSinalPorStatus`): financeiro primeiro;
   - **nível 2 (leitura)** em `ai/autonomia.ts` (`NIVEL_POR_TOOL`);
   - remove senha do Wi-Fi, MACs, série e IP antes de devolver ao modelo;
   - devolve `lidoEm` e a IA fala "lido às HH:MM", nunca "agora".
3. **Fluxos**: categoria "suporte" do editor (`apps/web/src/paginas/fluxo/tiposNo.ts`), ao lado de
   `diagnostico_conexao` e `diagnostico_fibra`.
4. **Painel do atendente (fase 2)**: cartão "Roteador" no `PainelCliente` do Inbox (nome das redes,
   aparelhos, sinal).
5. **Testes**: Vitest em `apps/api/tests/`, molde `brazmovelTool.test.ts` (`vi.mock` do serviço +
   `executarTool`).

## Fora do escopo por enquanto (de propósito)

- **Ferramentas de escrita** (trocar canal, reiniciar). Só depois de fechar o furo conhecido do
  AtendAI: o executor roda qualquer `chamada.name`, mesmo a que o nível de autonomia não ofereceu.
  Quando entrarem: nível 4, `confirmado_pelo_cliente`, e o valor de reversão que o
  `POST /cpes/:id/wifi` do CITacs já devolve.
- **Chat de IA do CITacs**: a chave da OpenAI está sem crédito (429).

## Decisões pendentes

1. Qual provedor primeiro: NetGo (dona do cliente Teobaldo) ou CITmax (dona do domínio do ACS)?
2. Contato periódico de 300 s para toda a frota (mais carga, dado mais recente)?
3. A NetGo libera a API FTTH do SGP para o app (cruzar a série da ONU)? O app do Maxxi recebia
   "sem autorização".
