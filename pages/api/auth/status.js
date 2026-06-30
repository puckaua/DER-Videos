/**
 * pages/api/auth/status.js
 *
 * Verifica se o usuário está autenticado verificando o cookie de sessão.
 * O frontend usa esta rota para saber se deve mostrar o botão de login.
 */

import { refreshAccessToken } from "../../../lib/msalConfig";

export default async function handler(req, res) {
  const cookies = parseCookies(req.headers.cookie || "");
  const accessToken = cookies.access_token;
  const refreshToken = cookies.refresh_token;

  if (accessToken) {
    return res.status(200).json({ authenticated: true });
  }

  // Tenta renovar usando refresh token
  if (refreshToken) {
    try {
      const tokenData = await refreshAccessToken(refreshToken);
      const cookieOptions = [
        `access_token=${tokenData.access_token}`,
        `HttpOnly`,
        `Path=/`,
        `SameSite=Lax`,
        process.env.NODE_ENV === "production" ? `Secure` : "",
        `Max-Age=${tokenData.expires_in}`,
      ]
        .filter(Boolean)
        .join("; ");

      res.setHeader("Set-Cookie", cookieOptions);
      return res.status(200).json({ authenticated: true });
    } catch {
      // Refresh token inválido ou expirado
    }
  }

  return res.status(200).json({ authenticated: false });
}

function parseCookies(cookieStr) {
  return cookieStr.split(";").reduce((acc, pair) => {
    const [key, ...val] = pair.trim().split("=");
    if (key) acc[key.trim()] = val.join("=").trim();
    return acc;
  }, {});
}
