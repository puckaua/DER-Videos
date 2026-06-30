# OneDrive Vídeos — Visualizador de Vídeos Compartilhados

Aplicação Next.js que lista e reproduz vídeos compartilhados com você no OneDrive, usando a Microsoft Graph API.

## Estrutura do projeto

```
onedrive-videos/
├── package.json
├── next.config.js
├── .gitignore
├── .env.local                 (NÃO sobe para o Git — apenas referência local)
├── lib/
│   └── msalConfig.js          (lógica de autenticação OAuth)
├── pages/
│   ├── _app.js
│   ├── index.js                (interface principal)
│   └── api/
│       ├── auth/
│       │   ├── login.js        (redireciona para login Microsoft)
│       │   ├── callback.js     (recebe o code e gera o token)
│       │   ├── status.js       (verifica se está autenticado)
│       │   └── logout.js
│       ├── shared.js           (GET /me/drive/sharedWithMe)
│       ├── children.js         (GET /drives/{id}/items/{id}/children)
│       └── video-url.js        (renova downloadUrl expirada)
└── styles/
    └── globals.css
```

## Passo 1 — Criar os arquivos localmente

Crie essa mesma estrutura de pastas no VS Code e copie o conteúdo de cada arquivo gerado nesta conversa. Não é necessário rodar `npm install` localmente — a Vercel faz isso automaticamente no build.

## Passo 2 — Registrar o aplicativo no Azure (Entra ID)

1. Acesse [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Dê um nome (ex: `OneDrive Vídeos`).
3. Em **Supported account types**, escolha **Accounts in this organizational directory only** (single tenant), já que o requisito é restringir à sua organização.
4. Em **Redirect URI**, escolha tipo **Web** e adicione (você vai precisar de duas, uma para teste local e uma para produção):
   - `http://localhost:3000/api/auth/callback`
   - `https://SEU-PROJETO.vercel.app/api/auth/callback` (ajuste depois do primeiro deploy, quando souber a URL final)
5. Clique em **Register**. Anote o **Application (client) ID** e o **Directory (tenant) ID** — você vai usá-los nas variáveis de ambiente.

### Gerar o Client Secret

1. No menu lateral do app registrado, vá em **Certificates & secrets** → **New client secret**.
2. Defina uma descrição e validade (recomendo 12 ou 24 meses).
3. Copie o **Value** do secret imediatamente — ele só aparece uma vez.

### Configurar permissões da API

1. Vá em **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions**.
2. Adicione:
   - `Files.Read.All` (ler arquivos do usuário e compartilhados)
   - `offline_access` (necessário para o refresh token)
   - `User.Read` (perfil básico)
3. Clique em **Grant admin consent** (precisa de um admin do tenant para aprovar, já que o app acessa arquivos da organização).

## Passo 3 — Configurar variáveis de ambiente na Vercel

No painel do seu projeto na Vercel: **Settings → Environment Variables**, adicione:

| Nome | Valor | Ambiente |
|---|---|---|
| `AZURE_CLIENT_ID` | o Application (client) ID copiado do Azure | Production, Preview, Development |
| `AZURE_CLIENT_SECRET` | o Value do secret gerado | Production, Preview, Development |
| `AZURE_TENANT_ID` | o Directory (tenant) ID | Production, Preview, Development |
| `AZURE_SCOPE` | `https://graph.microsoft.com/.default` | Production, Preview, Development |

Depois de salvar, faça um **Redeploy** para que as variáveis entrem em vigor.

## Passo 4 — Deploy

1. Crie um repositório no GitHub e suba os arquivos (o `.gitignore` já protege o `.env.local`).
2. Na Vercel, **Add New → Project** → conecte o repositório.
3. O framework será detectado automaticamente como Next.js — não precisa mudar nada no build command.
4. Depois do primeiro deploy, copie a URL gerada (ex: `https://onedrive-videos.vercel.app`) e volte ao Azure para adicionar `https://onedrive-videos.vercel.app/api/auth/callback` como Redirect URI válida.

## Como funciona o fluxo de autenticação

Como o requisito é acessar `/me/drive/sharedWithMe` (que pertence ao usuário logado, não a um app), a aplicação usa o fluxo **Authorization Code** (login interativo), não o Client Credentials puro:

1. Usuário clica em "Entrar com conta Microsoft" → `/api/auth/login` redireciona para a tela de login da Microsoft.
2. Após autenticar, a Microsoft chama `/api/auth/callback` com um `code`.
3. O backend troca esse `code` por um `access_token` + `refresh_token` e salva em cookies `HttpOnly` (não acessíveis via JavaScript no navegador — proteção contra XSS).
4. Toda chamada subsequente à Graph API usa esse token, lido no backend a partir do cookie.
5. Quando o token expira, `/api/auth/status` tenta renová-lo automaticamente usando o `refresh_token`.

As credenciais (`Client ID`, `Client Secret`, `Tenant ID`) nunca chegam ao navegador — ficam só nas variáveis de ambiente do servidor (Vercel Functions).

## Sobre as URLs de download de vídeo

A propriedade `@microsoft.graph.downloadUrl` retornada pela Graph API **expira após um tempo curto** (tipicamente poucas horas). Por isso, a rota `/api/video-url.js` busca uma URL fresca sempre que o usuário abre o player, evitando links quebrados em sessões mais longas.

## Limitações conhecidas / pontos de atenção

- O plano **Hobby** da Vercel tem timeout de 10s para Serverless Functions — chamadas à Graph API costumam responder bem dentro desse limite, mas pastas com centenas de itens podem precisar de paginação (`@odata.nextLink`, já capturado em `children.js` mas ainda não consumido no frontend — você pode adicionar um botão "Carregar mais" se precisar).
- Os cookies de sessão usam um esquema simples. Para produção com mais usuários, considere migrar para uma lib de sessão dedicada como `iron-session` ou `next-auth` (mais robustez contra CSRF e rotação de chaves).
- O admin consent das permissões (`Files.Read.All`) precisa ser concedido uma vez por um administrador do tenant antes que outros usuários da organização consigam logar.
