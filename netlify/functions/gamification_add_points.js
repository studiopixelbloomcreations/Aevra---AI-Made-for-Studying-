function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
      "cache-control": "no-store",
    },
    body: JSON.stringify(obj),
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") return json(200, { ok: true });
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return json(400, { ok: false, error: "Invalid JSON body" });
  }

  return json(200, {
    ok: true,
    data: {
      email: String(payload.email || ""),
      points_added: Math.max(0, parseInt(payload.points || 0, 10) || 0),
      reason: String(payload.reason || "ai_award"),
      subject: String(payload.subject || "General"),
      persisted: false,
      mode: "netlify_stateless_compatibility",
    },
  });
};
