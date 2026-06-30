/**
 * lib/msalConfig.js
 *
 * Centraliza a lógica de autenticação com a Microsoft Graph API
 * usando o fluxo Client Credentials (app-only token).
 *
 * IMPORTANTE: Este arquivo só roda no servidor (Next.js API Routes).
 * As variáveis de ambiente NUNCA são expostas ao navegador.
 */

const TOKEN_ENDPOINT = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;

// Cache simples em memória para evitar requests desnecessários ao Azure
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Busca (ou retorna do cache) um access token via Client Credentials.
 * Este token representa o APLICATIVO, não um usuário específico.
 *
 * ATENÇÃO: Para usar /me/drive/sharedWithMe você precisa do fluxo
 * On-Behalf-Of (OBO) com login do usuário. Veja a nota no arquivo
 * pages/api/shared.js para a estratégia recomendada.
 */
export async function getAppAccessToken() {
  const now = Date.now();

  // Retorna token cacheado se ainda válido (com margem de 60s)
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    scope: process.env.AZURE_SCOPE || "https://graph.microsoft.com/.default",
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Falha ao obter token da Microsoft: ${error.error_description || error.error}`
    );
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;

  return cachedToken;
}

/**
 * Troca um authorization code por um access token (fluxo Authorization Code).
 * Usado após o usuário fazer login via Microsoft.
 */
export async function exchangeCodeForToken(code, redirectUri) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
    scope: "https://graph.microsoft.com/Files.Read.All offline_access",
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Falha no code exchange: ${error.error_description}`);
  }

  return response.json(); // { access_token, refresh_token, expires_in, ... }
}

/**
 * Renova um access token usando o refresh token.
 */
export async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    refresh_token: refreshToken,
    scope: "https://graph.microsoft.com/Files.Read.All offline_access",
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Falha ao renovar token: ${error.error_description}`);
  }

  return response.json();
}

/**
 * Monta a URL de autorização para redirecionar o usuário ao login Microsoft.
 */
export function getAuthorizationUrl(redirectUri, state = "") {
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: "https://graph.microsoft.com/Files.Read.All offline_access",
    response_mode: "query",
    state,
  });

  return `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/authorize?${params}`;
}
