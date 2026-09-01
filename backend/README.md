# FG Salgados — Backend de Pagamento PIX (Mercado Pago)

Backend em **Node.js** que gera **PIX dinâmico** (QR Code com valor exato por pedido)
para o cardápio da FG Salgados, usando a conta do Mercado Pago.

> **Importante:** o site atual é estático (GitHub Pages) e **não pode** guardar a
> credencial do Mercado Pago com segurança. Por isso este backend é um servidor
> separado que você hospeda em outro lugar (Render, Railway, Vercel, etc.).
> O site do cardápio conversa com ele via internet.

---

## O que ele faz

| Endpoint          | Função                                          |
|-------------------|-------------------------------------------------|
| `GET /api/health` | Verifica se a integração está configurada      |
| `POST /api/pix`   | Cria um PIX dinâmico para o pedido (QR real)   |
| `POST /api/webhook` | Recebe a confirmação de pagamento do MP       |

## Passo 1 — Pegar a credencial (Access Token)

1. Acesse https://www.mercadopago.com.br/developers/panel/app
2. Entre com o e-mail da conta do FG (ex.: `agsdelivery24@gmail.com`).
3. Em **Suas integrações**, crie uma integração (se ainda não tiver) e abra-a.
4. Vá até “Credenciais de produção” e **copie o Access Token** (começa com `APP_USR-...`).

> Lembrando: este token **é a credencial** — a chave PIX `agsdelivery24@gmail.com`
> serve para o cliente transferir o dinheiro, mas o **token** é o que o sistema usa
> para gerar o QR Code automático. Os dois podem ser da mesma conta.

## Passo 2 — Criar o arquivo de configuração

Copie `.env.example` e renomeie para **`.env`**, depois preencha:

```
MP_ACCESS_TOKEN=APP_USR-xxxxxxxx   # seu token de produção
PUBLIC_URL=https://SEU-API.onrender.com  # URL pública deste backend
WEBHOOK_SECRET=uma-chave-longa-aleatoria
ALLOWED_ORIGIN=https://Gobato15.github.io
```

Para gerar o `WEBHOOK_SECRET`:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> O arquivo `.env` **não** deve ir para o GitHub (já está no `.gitignore`).

## Passo 3 — Rodar localmente (teste)

```
cd backend
npm install
npm run dev
```

Abra `http://localhost:3000/api/health` — deve mostrar `"configured": true`.

## Passo 4 — Publicar na internet

A opção mais simples é o **Render** (plano grátis):

1. Suba este projeto (pasta `backend`) para um repositório Git **novo e privado**.
2. No Render: **New → Web Service** → conecte o repositório.
3. Build: `npm install` · Start: `npm start`.
4. Em “Environment”, adicione as variáveis do `.env` (MP_ACCESS_TOKEN, PUBLIC_URL, WEBHOOK_SECRET).
5. Publique. O Render te dá uma URL como `https://fg-salgados-api.onrender.com`.
6. Use essa URL como `PUBLIC_URL`.

O **Railway** e a **Vercel** funcionam de forma parecida (Railway: Node; Vercel: 
rode com `serverless` ou em Function — aqui assumimos um serviço Node contínuo, 
que é o mais simples para webhook).

## Passo 5 — Ligar o site ao backend

1. No site, crie um arquivo `config.js` na raiz com:
   ```js
   window.FG_CONFIG = {
       pixApiUrl: 'https://fg-salgados-api.onrender.com/api'
   };
   ```
   (e carregue antes do `script.js` no `index.html`).
2. Quando o cliente escolher **PIX**, o site chama `POST /pix` com os itens e mostra
   o QR Code dinâmico e o código copia-e-cola, com **validação + travas** já embutidas.

> Se o backend não estiver configurado ainda, o site **usa automaticamente** o QR
> estático atual — nada quebra.

## Passo 6 — Testar (sandbox, opcional)

Para testar sem dinheiro real:
1. No painel do MP, ative o modo **sandbox** e copie o Access Token de teste.
2. No `.env`: `MP_ENV=sandbox`.
3. Gere um PIX, e para simular o pagamento:
   ```
   curl -X POST https://SEU-API/api/simulate-pay -H "Content-Type: application/json" -d '{"paymentId": ID_DO_PAGAMENTO}'
   ```

## Segurança embutida

- **Rate limit** por IP (bloqueia abuso de geração de QR).
- **Validação de valores** (idade: negativo/absurdo são recusados, máx. 40 itens).
- **Webhook** responde 200 na hora (obrigatório do MP) e valida a origem/assinatura.
- O **Access Token nunca sai do servidor** — só o site faz `POST /api/pix`.

---

**P.C.:** Para acompanhar os pedidos pagos em tempo real, dá para plugar o `console.log`
do webhook num canal que você usa (e-mail, Telegram, painel). Me chame que eu adiciono.
