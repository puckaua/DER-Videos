/**
 * pages/api/shared.js
 *
 * Lista os itens compartilhados com o usuário no OneDrive.
 * Chama: GET https://graph.microsoft.com/v1.0/me/drive/sharedWithMe
 *
 * Este endpoint usa o access token do usuário (fluxo delegado),
 * não o token de aplicativo (Client Credentials).
 * O token vem do cookie HttpOnly definido no login.
 */

const GRAPH_API = "https://graph.microsoft.com/v1.0";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const accessToken = getTokenFromCookies(req);
  if (!accessToken) {
    return res.status(401).json({ error: "Não autenticado. Faça login primeiro." });
  }

  try {
    const response = await fetch(`${GRAPH_API}/me/drive/sharedWithMe`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Erro da Graph API:", error);

      if (response.status === 401) {
        return res.status(401).json({ error: "Token expirado. Faça login novamente." });
      }

      return res.status(response.status).json({
        error: error.error?.message || "Erro ao consultar a Graph API",
      });
    }

    const data = await response.json();

    // Normaliza os itens para o formato que o frontend espera
    const items = (data.value || []).map((item) => normalizeSharedItem(item));

    res.status(200).json({ items });
  } catch (err) {
    console.error("Erro interno em /api/shared:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
}

/**
 * Normaliza um item retornado pelo endpoint sharedWithMe.
 * Itens compartilhados têm uma estrutura especial com `remoteItem`.
 */
function normalizeSharedItem(item) {
  const remote = item.remoteItem || {};
  const isFolder = !!(remote.folder || item.folder);
  const isVideo = isVideoFile(item.name || remote.name || "");

  return {
    id: remote.id || item.id,
    name: item.name || remote.name || "Sem nome",
    type: isFolder ? "folder" : isVideo ? "video" : "file",
    // driveId é necessário para navegar dentro de pastas compartilhadas
    driveId:
      remote.parentReference?.driveId ||
      item.remoteItem?.parentReference?.driveId ||
      null,
    // Para pastas remotas, usamos o ID remoto para navegar
    remoteItemId: remote.id || null,
    size: remote.size || item.size || 0,
    lastModified:
      remote.lastModifiedDateTime || item.lastModifiedDateTime || null,
    // URL de download direto (disponível para arquivos, não pastas)
    downloadUrl:
      item["@microsoft.graph.downloadUrl"] ||
      remote["@microsoft.graph.downloadUrl"] ||
      null,
    thumbnailUrl: getThumbnailUrl(remote),
  };
}

function isVideoFile(name) {
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv", ".flv"];
  const ext = name.toLowerCase().slice(name.lastIndexOf("."));
  return videoExtensions.includes(ext);
}

function getThumbnailUrl(item) {
  return item.thumbnails?.[0]?.large?.url || null;
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
