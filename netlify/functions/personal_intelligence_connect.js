function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    },
    body: JSON.stringify(obj),
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  const service = String((payload && payload.service) || "").toLowerCase().trim();
  if (!service) return json(400, { ok: false, error: "service is required" });

  if (service === "spotify") return json(200, { ok: true, service: "spotify", connected: true });
  if (service === "maps" || service === "google_maps" || service === "google maps") {
    return json(200, { ok: true, service: "google_maps", connected: true });
  }

  return json(200, { ok: false, error: "Unsupported service" });
};
