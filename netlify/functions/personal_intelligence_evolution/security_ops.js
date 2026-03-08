"use strict";

const rateBuckets = new Map();

function normalizeHeaders(headers) {
  const src = headers && typeof headers === "object" ? headers : {};
  const out = {};
  Object.keys(src).forEach((k) => {
    out[String(k).toLowerCase()] = src[k];
  });
  return out;
}

function getClientKey(event) {
  const headers = normalizeHeaders(event && event.headers);
  const ip = String(headers["x-nf-client-connection-ip"] || headers["x-forwarded-for"] || "").split(",")[0].trim();
  return ip || "unknown_client";
}

function enforceRateLimit(event, bucketName, limit, windowMs) {
  if (String(process.env.PI_DISABLE_RATE_LIMIT || "").trim().toLowerCase() === "true") {
    return {
      allowed: true,
      remaining: Number.MAX_SAFE_INTEGER,
      reset_ms: 0,
      bypassed: true,
    };
  }
  const key = `${String(bucketName || "default")}::${getClientKey(event)}`;
  const now = Date.now();
  const lim = Math.max(1, Number(limit || 60));
  const win = Math.max(1000, Number(windowMs || 60000));
  const row = rateBuckets.get(key) || { start: now, count: 0 };
  if ((now - Number(row.start || 0)) > win) {
    row.start = now;
    row.count = 0;
  }
  row.count += 1;
  rateBuckets.set(key, row);
  return {
    allowed: row.count <= lim,
    remaining: Math.max(0, lim - row.count),
    reset_ms: Math.max(0, win - (now - row.start)),
  };
}

function requireAdmin(event) {
  const expected = String(process.env.PI_ADMIN_TOKEN || "").trim();
  if (!expected) {
    return { ok: false, reason: "PI_ADMIN_TOKEN missing" };
  }
  const headers = normalizeHeaders(event && event.headers);
  const got = String(headers["x-admin-token"] || headers["authorization"] || "").replace(/^Bearer\s+/i, "").trim();
  if (!got || got !== expected) {
    return { ok: false, reason: "Unauthorized" };
  }
  return { ok: true };
}

module.exports = {
  getClientKey,
  enforceRateLimit,
  requireAdmin,
};
