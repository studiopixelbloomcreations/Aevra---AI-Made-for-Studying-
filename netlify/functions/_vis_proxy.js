const DEFAULT_VIS_BACKEND_BASE = "https://grade9-ai-tutor-api-production.up.railway.app";

function getBackendBase() {
  return String(process.env.VIS_BACKEND_BASE_URL || DEFAULT_VIS_BACKEND_BASE).replace(/\/+$/, "");
}

function buildCorsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "cache-control": "no-store",
  };
}

async function proxyVis(event, endpointPath) {
  const corsHeaders = buildCorsHeaders();
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    const targetUrl = getBackendBase() + endpointPath;
    const resp = await fetch(targetUrl, {
      method: event.httpMethod || "POST",
      headers: {
        "content-type": event.headers && event.headers["content-type"]
          ? event.headers["content-type"]
          : "application/json",
      },
      body: event.httpMethod === "GET" ? undefined : (event.body || ""),
    });

    const text = await resp.text();
    return {
      statusCode: resp.status,
      headers: Object.assign({}, corsHeaders, {
        "content-type": resp.headers.get("content-type") || "application/json",
      }),
      body: text,
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: Object.assign({}, corsHeaders, {
        "content-type": "application/json",
      }),
      body: JSON.stringify({
        ok: false,
        error: "VIS_PROXY_FAILED",
        detail: String((error && error.message) || error || "unknown"),
      }),
    };
  }
}

module.exports = {
  proxyVis,
};
