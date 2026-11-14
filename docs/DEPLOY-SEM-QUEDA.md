# Deploy sem queda (rolling update no Coolify)

## Por que o deploy derruba o sistema hoje

O CITacs sobe como **um stack Docker Compose** (`docker-compose.yml`). Nesse
modo o Coolify recria os containers que mudaram: para o `citacs-api` e o
`citacs-web` antigos e só depois sobe os novos. Entre um e outro o
`acs.citmax.com.br` fica fora do ar.

O Coolify só faz **rolling update** (sobe o novo, espera ficar saudável, troca
o tráfego e só então derruba o antigo) em **Application** com build por
Dockerfile e healthcheck. Ele **não** faz isso em stack Compose.

## O que já está no repositório

- `GET /api/health`: rota aberta e leve, que não depende do banco nem do ACS. Se
  o GenieACS cair, o deploy não trava por isso.
- `HEALTHCHECK` nas duas imagens: API em `/api/health` (porta 4000) e web em
  `/login` (porta 3000).
- `enableShutdownHooks()` na API: ao receber SIGTERM, o container antigo termina
  as requisições em andamento antes de sair.
- O web já lê o endereço da API **em tempo de execução** (`API_URL`, em
  `apps/web/src/app/api/[...path]/route.ts`), então os dois podem ser apps separados.

## Migração no Coolify (uma vez)

Banco e Redis não mudam de lugar: continuam no stack Compose atual. Só a API e
o web saem para Applications próprias.

1. **Rede compartilhada.** No stack atual, ligue **Connect to Predefined
   Network**. Assim o `citacs-postgres` e o `citacs-redis` ficam alcançáveis
   pela rede `coolify`.
2. **Application `citacs-api`:** + New → Application → repositório
   `clebsonisaias/citacs`, branch `main`, Build Pack **Dockerfile**.
   - Base directory `/`, Dockerfile `apps/api/Dockerfile`, porta 4000.
   - **Sem domínio.** A API só é acessada pelo web e pela rede interna.
   - Variáveis: copie as do `citacs-api` do Compose, com `DATABASE_URL` e
     `REDIS_HOST` apontando para o nome do container do Postgres/Redis na rede
     `coolify`. Inclua `INTEGRACAO_CHAVES`.
   - Rede do GenieACS: em Custom Docker Options,
     `--network mqkobhd3qvrkco4raqdtl5rt`.
   - Healthcheck: ativado, path `/api/health`, porta 4000.
   - **Não** defina nome de container nem mapeie porta no host. As duas coisas
     desligam o rolling update.
3. **Application `citacs-web`:** mesmo repositório, Dockerfile
   `apps/web/Dockerfile`, porta 3000.
   - Domínio `https://acs.citmax.com.br`.
   - `API_URL=http://<nome interno da app citacs-api>:4000`. O nome aparece na
     app, em General.
   - Healthcheck: ativado, path `/login`, porta 3000.
4. **Virada:** com as duas Applications saudáveis, tire `citacs-api` e
   `citacs-web` do `docker-compose.yml` (fica só Postgres e Redis). Remova os
   labels Traefik de `acs.citmax.com.br` do Compose antes de pôr o domínio no
   web novo, para não haver dois roteadores no mesmo host.
5. **Teste:** dispare um Redeploy da API e, ao mesmo tempo, rode
   `while true; do curl -s -o /dev/null -w '%{http_code}\n' https://acs.citmax.com.br/api/health; sleep 0.5; done`.
   Não pode aparecer 502/404 durante o deploy.

## Observações

- Postgres e Redis param só quando mudam de imagem. Com o deploy da API e do web
  fora do Compose, o stack do banco quase nunca é redeployado.
- Rolling update precisa de memória para dois containers da API ao mesmo tempo
  durante a troca (alguns segundos).
- Pendência de segurança no Compose: `POSTGRES_PASSWORD` e o padrão de
  `JWT_SECRET` estão fixos no arquivo. Ao migrar, passe-os para variáveis do
  Coolify com valores novos.
