/**
 * pages/api/children.js
 *
 * Lista o conteúdo (filhos) de uma pasta no OneDrive.
 *
 * Query params:
 *   - driveId: ID do drive onde a pasta está (necessário para drives compartilhados)
 *   - itemId:  ID da pasta a listar
 *
 * Chama: GET https://graph.microsoft.com/v1.0/drives/{driveId}/items/{itemId}/children
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

  const { driveId, itemId } = req.query;

  if (!driveId || !itemId) {
    return res
      .status(400)
      .json({ error: "Parâmetros obrigatórios: driveId e itemId" });
  }

  try {
    // Busca os filhos da pasta. O $select limita os campos para economizar banda.
    const url =
      `${GRAPH_API}/drives/${driveId}/items/${itemId}/children` +
      `?$select=id,name,folder,video,file,size,lastModifiedDateTime,@microsoft.graph.downloadUrl,thumbnails` +
      `&$top=100`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`Erro Graph API [drives/${driveId}/items/${itemId}/children]:`, error);

      if (response.status === 401) {
        return res.status(401).json({ error: "Token expirado. Faça login novamente." });
      }
      if (response.status === 403) {
        return res
          .status(403)
          .json({ error: "Sem permissão para acessar esta pasta." });
      }

      return res.status(response.status).json({
        error: error.error?.message || "Erro ao consultar a Graph API",
      });
    }

    const data = await response.json();
    const items = (data.value || []).map((item) => normalizeItem(item, driveId));

    // Ordena: pastas primeiro, depois arquivos, ambos em ordem alfabética
    items.sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });

    res.status(200).json({ items, nextLink: data["@odata.nextLink"] || null });
  } catch (err) {
    console.error("Erro interno em /api/children:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
}

function normalizeItem(item, driveId) {
  const isFolder = !!item.folder;
  const isVideo =
    !!item.video || isVideoFile(item.name || "");

  return {
    id: item.id,
    name: item.name || "Sem nome",
    type: isFolder ? "folder" : isVideo ? "video" : "file",
    driveId,
    size: item.size || 0,
    lastModified: item.lastModifiedDateTime || null,
    downloadUrl: item["@microsoft.graph.downloadUrl"] || null,
    thumbnailUrl: item.thumbnails?.[0]?.large?.url || null,
    childCount: item.folder?.childCount ?? null,
  };
}

function isVideoFile(name) {
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv", ".flv"];
  const ext = name.toLowerCase().slice(name.lastIndexOf("."));
  return videoExtensions.includes(ext);
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
