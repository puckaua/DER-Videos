/**
 * pages/api/auth/callback.js
 *
 * Recebe o authorization code da Microsoft após o login do usuário,
 * troca pelo access token e salva nos cookies da sessão.
 */

import { exchangeCodeForToken } from "../../../lib/msalConfig";

export default async function handler(req, res) {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error("Erro no callback de auth:", error_description);
    return res.redirect(`/?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.redirect("/?error=no_code");
  }

  try {
    // Usa a mesma lógica do login.js — deve ser idêntica à URI registrada no Azure
    const baseUrl =
      process.env.APP_BASE_URL ||
      (process.env.NODE_ENV === "production"
        ? `https://${req.headers.host}`
        : `http://localhost:3000`);

    const redirectUri = `${baseUrl}/api/auth/callback`;

    console.log("[callback] redirectUri:", redirectUri);

    const tokenData = await exchangeCodeForToken(code, redirectUri);

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

    const refreshCookieOptions = [
      `refresh_token=${tokenData.refresh_token}`,
      `HttpOnly`,
      `Path=/`,
      `SameSite=Lax`,
      process.env.NODE_ENV === "production" ? `Secure` : "",
      `Max-Age=${60 * 60 * 24 * 30}`,
    ]
      .filter(Boolean)
      .join("; ");

    res.setHeader("Set-Cookie", [cookieOptions, refreshCookieOptions]);
    res.redirect("/");
  } catch (err) {
    console.error("Erro ao trocar código por token:", err.message);
    res.redirect(`/?error=${encodeURIComponent(err.message)}`);
  }
}
