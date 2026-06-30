/**
 * pages/api/auth/logout.js
 *
 * Remove os cookies de sessão e redireciona para a home.
 */

export default function handler(req, res) {
  // Expira os cookies imediatamente
  res.setHeader("Set-Cookie", [
    "access_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
    "refresh_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
  ]);
  res.redirect("/");
}
