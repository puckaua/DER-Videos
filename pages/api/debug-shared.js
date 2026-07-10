/**
 * pages/api/debug-shared.js
 * Rota TEMPORÁRIA de diagnóstico — remova após os testes!
 * Acesse: https://dervideos.vercel.app/api/debug-shared
 */

export default async function handler(req, res) {
  const accessToken = getTokenFromCookies(req);
  if (!accessToken) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me/drive/sharedWithMe?$top=50",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const data = await response.json();

  // Retorna o raw completo da API para inspeção
  res.status(response.status).json(data);
}

function getTokenFromCookies(req) {
  const cookieStr = req.headers.cookie || "";
  return cookieStr.split(";").reduce((acc, pair) => {
    const [k, ...v] = pair.trim().split("=");
    if (k) acc[k.trim()] = v.join("=").trim();
    return acc;
  }, {}).access_token || null;
}
