import { STORAGE_KEYS } from "../core/config.js";
import { clampText, readJson, writeJson } from "../utils/storage.js";

const EMPTY_GRAPH = {
  projects: [],
  unfinishedWork: [],
  studyHistory: [],
  preferences: {},
  behaviorPatterns: [],
  strengths: [],
  weaknesses: [],
  sessions: [],
  summaries: [],
  relationships: [],
  updatedAt: null,
};

export class AuraMemoryGraphEngine {
  constructor(bus) {
    this.bus = bus;
    this.graph = readJson(STORAGE_KEYS.memory, EMPTY_GRAPH);
  }

  async loadRemoteState(identity) {
    const query = identity && identity.user_id ? `?user_id=${encodeURIComponent(identity.user_id)}` : "";
    try {
      const response = await fetch(`/personal-intelligence/config${query}`);
      if (!response.ok) throw new Error(`memory config ${response.status}`);
      const data = await response.json();
      this.ingestProfile(data.profile || data);
    } catch (error) {
      this.bus.emit("memory:remote-unavailable", { message: error.message });
    }
    return this.graph;
  }

  ingestProfile(profile = {}) {
    const personalization = profile.personalization_data || profile.personalization_profile || {};
    const knownFacts = personalization.memory && personalization.memory.known_facts ? personalization.memory.known_facts : {};
    this.graph.preferences = { ...this.graph.preferences, ...knownFacts };
    this.graph.strengths = mergeUnique(this.graph.strengths, personalization.strengths || []);
    this.graph.weaknesses = mergeUnique(this.graph.weaknesses, personalization.weaknesses || []);
    this.graph.studyHistory = mergeUnique(this.graph.studyHistory, personalization.recent_topics || personalization.interests || []);
    this.graph.updatedAt = new Date().toISOString();
    this.persist();
  }

  buildGreeting() {
    const lastSession = this.graph.sessions[this.graph.sessions.length - 1];
    const unfinished = this.graph.unfinishedWork[0] || this.graph.projects[0];
    const recentTopic = lastSession && lastSession.focus ? lastSession.focus : this.graph.studyHistory[0];
    const name = this.graph.preferences.preferred_name || this.graph.preferences.name || "";
    const parts = ["Welcome back"];
    if (name) parts[0] += `, ${name}`;
    if (unfinished) parts.push(`You still have ${unfinished.title || unfinished} waiting.`);
    else if (recentTopic) parts.push(`Your recent focus was ${recentTopic}.`);
    if (lastSession && lastSession.summary) parts.push(`Last session: ${clampText(lastSession.summary, 140)}`);
    parts.push(unfinished || recentTopic ? "Would you like to continue from there?" : "What should we work on first?");
    return parts.join(" ");
  }

  rememberInteraction(role, content, meta = {}) {
    const session = this.currentSession();
    session.events.push({ role, content: clampText(content), meta, at: new Date().toISOString() });
    session.focus = meta.focus || session.focus || inferFocus(content);
    session.updatedAt = new Date().toISOString();
    this.graph.updatedAt = session.updatedAt;
    this.compressSession(session);
    this.persist();
  }

  currentSession() {
    let session = this.graph.sessions[this.graph.sessions.length - 1];
    if (!session || session.closedAt) {
      session = { id: `aura_${Date.now()}`, startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), focus: "", events: [], summary: "" };
      this.graph.sessions.push(session);
    }
    return session;
  }

  compressSession(session = this.currentSession()) {
    const userItems = session.events.filter((event) => event.role === "user").slice(-4).map((event) => event.content);
    const assistantItems = session.events.filter((event) => event.role === "assistant").slice(-2).map((event) => event.content);
    session.summary = clampText([...userItems, ...assistantItems].join(" | "), 420);
    if (session.focus && !this.graph.studyHistory.includes(session.focus)) {
      this.graph.studyHistory.unshift(session.focus);
      this.graph.studyHistory = this.graph.studyHistory.slice(0, 20);
    }
    return session.summary;
  }

  closeSession() {
    const session = this.currentSession();
    session.summary = this.compressSession(session);
    session.closedAt = new Date().toISOString();
    this.graph.summaries.unshift({ id: session.id, text: session.summary, at: session.closedAt });
    this.graph.summaries = this.graph.summaries.slice(0, 80);
    this.persist();
    return session;
  }

  retrieveContext() {
    return {
      recentSessions: this.graph.sessions.slice(-5),
      unfinishedWork: this.graph.unfinishedWork.slice(0, 5),
      preferences: this.graph.preferences,
      strengths: this.graph.strengths.slice(0, 8),
      weaknesses: this.graph.weaknesses.slice(0, 8),
      summaries: this.graph.summaries.slice(0, 5),
    };
  }

  persist() {
    writeJson(STORAGE_KEYS.memory, this.graph);
    this.bus.emit("memory:updated", { graph: this.graph });
  }
}

function mergeUnique(base = [], incoming = []) {
  return Array.from(new Set([...(Array.isArray(base) ? base : []), ...(Array.isArray(incoming) ? incoming : [])].map(String).filter(Boolean))).slice(0, 40);
}

function inferFocus(text) {
  const cleaned = String(text || "").toLowerCase();
  const match = cleaned.match(/\b(math|science|english|history|geography|coding|robotics|project|essay|notes|exam|algebra|geometry|biology|physics|chemistry)\b/);
  return match ? match[0] : "";
}
