/**
 * pages/api/auth/login.js
 *
 * Redireciona o usuário para a tela de login da Microsoft.
 * O usuário autoriza o app a acessar seus arquivos do OneDrive.
 */

import { getAuthorizationUrl } from "../../../lib/msalConfig";

export default function handler(req, res) {
  // APP_BASE_URL deve ser configurada nas variáveis de ambiente da Vercel
  // Ex: https://seu-projeto.vercel.app  (sem barra no final)
  const baseUrl =
    process.env.APP_BASE_URL ||
    (process.env.NODE_ENV === "production"
      ? `https://${req.headers.host}`
      : `http://localhost:3000`);

  const redirectUri = `${baseUrl}/api/auth/callback`;

  console.log("[login] redirectUri:", redirectUri);

  const authUrl = getAuthorizationUrl(redirectUri);
  res.redirect(authUrl);
}
