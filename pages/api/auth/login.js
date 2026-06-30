/**
 * pages/api/auth/login.js
 *
 * Redireciona o usuário para a tela de login da Microsoft.
 * O usuário autoriza o app a acessar seus arquivos do OneDrive.
 */

import { getAuthorizationUrl } from "../../../lib/msalConfig";

export default function handler(req, res) {
  // A URL de callback deve estar registrada no Azure App Registration
  // em "Authentication > Redirect URIs"
  const redirectUri =
    process.env.NODE_ENV === "production"
      ? `https://${req.headers.host}/api/auth/callback`
      : `http://localhost:3000/api/auth/callback`;

  const authUrl = getAuthorizationUrl(redirectUri);
  res.redirect(authUrl);
}
