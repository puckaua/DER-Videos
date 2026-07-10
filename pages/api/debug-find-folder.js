/**
 * pages/api/debug-find-folder.js
 * Rota TEMPORÁRIA — remove após pegar os IDs!
 * Acesse: https://dervideos.vercel.app/api/debug-find-folder
 *
 * Tenta localizar a pasta "VÍDEOS RTA" no site AEST do SharePoint.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
const SITE_HOSTNAME = "dermggovbr.sharepoint.com";
const SITE_PATH     = "/sites/AEST";

export default async function handler(req, res) {
  const token = getCookie(req, "access_token");
  if (!token) return res.status(401).json({ error: "Não autenticado." });

  const results = {};

  try {
    // 1. Busca o site
    const siteRes = await graph(`/sites/${SITE_HOSTNAME}:${SITE_PATH}`, token);
    results.site = pick(siteRes, ["id", "name", "webUrl"]);
    const siteId = siteRes.id;

    // 2. Lista os drives do site (bibliotecas de documentos)
    const drivesRes = await graph(`/sites/${siteId}/drives`, token);
    results.drives = (drivesRes.value || []).map(d => pick(d, ["id", "name", "driveType", "webUrl"]));

    // 3. Para cada drive, tenta encontrar "VÍDEOS RTA" na raiz
    results.searchResults = [];
    for (const drive of drivesRes.value || []) {
      try {
        const rootChildren = await graph(`/drives/${drive.id}/root/children?$select=id,name,folder,webUrl`, token);
        for (const item of rootChildren.value || []) {
          if (item.folder) {
            results.searchResults.push({
              driveName: drive.name,
              driveId: drive.id,
              folderName: item.name,
              folderId: item.id,
              webUrl: item.webUrl,
            });
          }
        }
      } catch (e) {
        results.searchResults.push({ driveName: drive.name, error: e.message });
      }
    }

  } catch (err) {
    results.error = err.message;
  }

  res.status(200).json(results);
}

async function graph(path, token) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const e = await res.json();
    throw new Error(`${res.status}: ${e.error?.message || JSON.stringify(e)}`);
  }
  return res.json();
}

function pick(obj, keys) {
  return keys.reduce((acc, k) => { if (obj[k] !== undefined) acc[k] = obj[k]; return acc; }, {});
}

function getCookie(req, name) {
  return (req.headers.cookie || "").split(";").reduce((acc, pair) => {
    const [k, ...v] = pair.trim().split("=");
    if (k?.trim() === name) acc = v.join("=").trim();
    return acc;
  }, null);
}
