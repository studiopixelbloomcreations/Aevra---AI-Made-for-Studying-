"use strict";

const inMemoryDocs = {};

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function stableJson(doc) {
  return JSON.stringify(doc, null, 2) + "\n";
}

function endpoint(owner, repo, filePath) {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${filePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

class CloudStateStore {
  constructor() {
    this.token = String(process.env.GITHUB_TOKEN || "").trim();
    this.owner = String(process.env.GITHUB_REPO_OWNER || "").trim();
    this.repo = String(process.env.GITHUB_REPO_NAME || "").trim();
    this.branch = String(process.env.GITHUB_REPO_BRANCH || "main").trim();
    this.basePath = String(
      process.env.PI_STATE_REPO_PATH || "netlify/functions/personal_intelligence_evolution/state"
    ).trim();
    this.enabled = !!(this.token && this.owner && this.repo);
  }

  _fullPath(key) {
    const safe = String(key || "state").replace(/[^a-zA-Z0-9._/-]/g, "_");
    return `${this.basePath}/${safe}.json`;
  }

  async _githubRead(filePath) {
    const url = `${endpoint(this.owner, this.repo, filePath)}?ref=${encodeURIComponent(this.branch)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (res.status === 404) return { ok: true, exists: false, sha: "", doc: null };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: String(data && data.message || `HTTP_${res.status}`) };
    const enc = String(data.content || "").replace(/\n/g, "");
    const txt = enc ? Buffer.from(enc, "base64").toString("utf-8") : "";
    let parsed = null;
    try { parsed = txt ? JSON.parse(txt) : null; } catch (e) { parsed = null; }
    return { ok: true, exists: true, sha: String(data.sha || ""), doc: parsed };
  }

  async _githubWrite(filePath, doc, prevSha, message) {
    const url = endpoint(this.owner, this.repo, filePath);
    const body = {
      message: String(message || "pi-os phase2 state update"),
      content: Buffer.from(stableJson(doc), "utf-8").toString("base64"),
      branch: this.branch,
    };
    if (prevSha) body.sha = prevSha;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: String(data && data.message || `HTTP_${res.status}`) };
    return { ok: true, sha: String(data && data.content && data.content.sha || "") };
  }

  async readDoc(key, defaultDoc) {
    const k = String(key || "state");
    if (!this.enabled) {
      if (!(k in inMemoryDocs)) inMemoryDocs[k] = deepClone(defaultDoc);
      return { ok: true, doc: deepClone(inMemoryDocs[k]), sha: "", storage: "memory" };
    }
    try {
      const fp = this._fullPath(k);
      const got = await this._githubRead(fp);
      if (!got.ok) return { ok: false, error: got.error };
      if (!got.exists || !got.doc || typeof got.doc !== "object") {
        return { ok: true, doc: deepClone(defaultDoc), sha: got.sha || "", storage: "github" };
      }
      return { ok: true, doc: got.doc, sha: got.sha || "", storage: "github" };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  async writeDoc(key, doc, sha, message) {
    const k = String(key || "state");
    const nextDoc = doc && typeof doc === "object" ? doc : {};
    if (!this.enabled) {
      inMemoryDocs[k] = deepClone(nextDoc);
      return { ok: true, sha: "", storage: "memory" };
    }
    try {
      const fp = this._fullPath(k);
      const first = await this._githubWrite(fp, nextDoc, sha, message);
      if (first.ok) return { ok: true, sha: first.sha || "", storage: "github" };

      // one retry for optimistic concurrency conflict
      if (/sha|conflict|409/i.test(String(first.error || ""))) {
        const latest = await this._githubRead(fp);
        if (!latest.ok) return { ok: false, error: latest.error };
        const second = await this._githubWrite(fp, nextDoc, latest.sha || "", message);
        if (second.ok) return { ok: true, sha: second.sha || "", storage: "github" };
        return { ok: false, error: second.error };
      }
      return { ok: false, error: first.error };
    } catch (e) {
      return { ok: false, error: String(e && e.message || e) };
    }
  }
}

module.exports = {
  CloudStateStore,
};

