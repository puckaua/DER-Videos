/**
 * pages/api/debug-search.js
 * Rota TEMPORÁRIA — remove após os testes!
 * Acesse: https://dervideos.vercel.app/api/debug-search
 *
 * Tenta encontrar a pasta VÍDEOS RTA via Search API da Microsoft Graph.
 */

export default async function handler(req, res) {
  const token = getCookie(req, "access_token");
  if (!token) return res.status(401).json({ error: "Não autenticado." });

  const results = {};

  // 1. Tenta buscar via Search API
  try {
    const searchRes = await fetch("https://graph.microsoft.com/v1.0/search/query", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            entityTypes: ["driveItem"],
            query: { queryString: "VÍDEOS RTA" },
            fields: ["id", "name", "parentReference", "folder", "webUrl", "createdBy"],
            from: 0,
            size: 10,
          },
        ],
      }),
    });
    const searchData = await searchRes.json();
    const hits = searchData?.value?.[0]?.hitsContainers?.[0]?.hits || [];
    results.searchHits = hits.map(h => ({
      id: h.resource?.id,
      name: h.resource?.name,
      webUrl: h.resource?.webUrl,
      driveId: h.resource?.parentReference?.driveId,
      parentId: h.resource?.parentReference?.id,
      isFolder: !!h.resource?.folder,
    }));
  } catch (e) {
    results.searchError = e.message;
  }

  // 2. Tenta via sharedWithMe com allowExternal
  try {
    const sharedRes = await fetch(
      "https://graph.microsoft.com/v1.0/me/drive/sharedWithMe?$top=50&allowExternal=true",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const sharedData = await sharedRes.json();
    results.sharedWithMe = (sharedData.value || []).map(i => ({
      id: i.id,
      name: i.name,
      isFolder: !!i.folder || !!i.remoteItem?.folder,
      driveId: i.remoteItem?.parentReference?.driveId,
      remoteId: i.remoteItem?.id,
    }));
    results.sharedWithMeCount = results.sharedWithMe.length;
  } catch (e) {
    results.sharedWithMeError = e.message;
  }

  // 3. Verifica drives do próprio usuário
  try {
    const drivesRes = await fetch(
      "https://graph.microsoft.com/v1.0/me/drives",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const drivesData = await drivesRes.json();
    results.myDrives = (drivesData.value || []).map(d => ({
      id: d.id,
      name: d.name,
      driveType: d.driveType,
    }));
  } catch (e) {
    results.myDrivesError = e.message;
  }

  res.status(200).json(results);
}

function getCookie(req, name) {
  return (req.headers.cookie || "").split(";").reduce((acc, pair) => {
    const [k, ...v] = pair.trim().split("=");
    if (k?.trim() === name) acc = v.join("=").trim();
    return acc;
  }, null);
}
