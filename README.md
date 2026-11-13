# CITacs

Painel de gerência de CPEs TR-069 sobre o GenieACS (via API NBI).

- Lista de CPEs com status online/offline, fabricante, modelo, serial, firmware, IP WAN e último contato
- Detalhe da CPE com todos os parâmetros (filtro por nome/valor)
- Ações: atualizar parâmetros, reiniciar, trocar SSID e senha do Wi-Fi (TR-098 e TR-181)
- Login com sessão assinada; a NBI nunca é exposta ao navegador

## Variáveis de ambiente

| Variável | Exemplo | Descrição |
|---|---|---|
| `GENIEACS_NBI_URL` | `http://nbi-<uuid>:7557` | URL interna da NBI (rede Docker) |
| `ADMIN_USER` | `admin` | Usuário do painel |
| `ADMIN_PASSWORD` | — | Senha do painel |
| `SESSION_SECRET` | `openssl rand -hex 32` | Segredo da sessão (mín. 16 caracteres) |
| `ONLINE_THRESHOLD_MIN` | `15` | Minutos sem Inform até marcar offline |

## Deploy no Coolify

1. Novo recurso → Application → este repositório → Build Pack **Dockerfile**, porta **3000**.
2. Defina as variáveis acima.
3. No serviço do GenieACS, ative **Connect to Predefined Network**, para o CITacs alcançar o container `nbi`.
4. Defina o domínio (HTTPS automático) e faça o deploy.

## Desenvolvimento

```bash
cp .env.example .env.local   # ajuste GENIEACS_NBI_URL
npm install && npm run dev
```
