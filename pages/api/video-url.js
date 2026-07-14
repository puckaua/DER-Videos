/**
 * pages/api/video-url.js
 *
 * Obtém uma URL de download fresca para o arquivo de vídeo
 * e redireciona o navegador diretamente para ela.
 */

const GRAPH_API = "https://graph.microsoft.com/v1.0";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const accessToken = getTokenFromCookies(req);
  if (!accessToken) {
    return res.status(401).json({ error: "Não autenticado." });
  }

  const { driveId, itemId } = req.query;

  if (!driveId || !itemId) {
    return res.status(400).json({ error: "driveId e itemId são obrigatórios" });
  }

  try {
    // CORREÇÃO DA CAUSA 2: Removemos o ?$select para evitar bugs com o caractere '@'.
    // Buscaremos o item completo, que sempre trará a URL de download limpa.
    const url = `${GRAPH_API}/drives/${driveId}/items/${itemId}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({
        error: error.error?.message || "Erro ao buscar dados do vídeo",
      });
    }

    const data = await response.json();
    const downloadUrl = data["@microsoft.graph.downloadUrl"];

    if (!downloadUrl) {
      return res.status(404).json({ error: "URL de download não disponível para este arquivo." });
    }

    // CORREÇÃO DAS CAUSAS 1 e 3: 
    // Em vez de retornar JSON, redirecionamos o navegador com status 302 
    // direto para o arquivo de vídeo na CDN da Microsoft.
    return res.redirect(302, downloadUrl);

  } catch (err) {
    console.error("Erro em /api/video-url:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
}

function getTokenFromCookies(req) {
  const cookieStr = req.headers.cookie || "";
  const cookies = cookieStr.split(";").reduce((acc, pair) => {
    const [key, ...val] = pair.trim().split("=");
    if (key) acc[key.trim()] = val.join("=").trim();
    return acc;
  }, {});
  return cookies.access_token || null;
}