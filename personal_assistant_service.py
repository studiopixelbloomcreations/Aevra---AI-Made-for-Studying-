from __future__ import annotations

import os
import re
from typing import Dict, List, Optional

import requests
from groq import Groq

from user_personalization_router import store as personalization_store


assistant_memory: Dict[str, List[Dict[str, str]]] = {}
assistant_user_facts: Dict[str, Dict[str, str]] = {}


def _email_key(email: Optional[str]) -> str:
    return (email or "guest@student.com").strip().lower()


def _extract_user_facts(message: str) -> Dict[str, str]:
    text = (message or "").strip()
    out: Dict[str, str] = {}
    patterns = [
        ("name", r"\bmy name is ([A-Za-z][A-Za-z .'-]{1,40})"),
        ("likes", r"\bi like ([A-Za-z0-9 ,.'-]{2,80})"),
        ("goal", r"\bmy goal is to ([A-Za-z0-9 ,.'-]{3,120})"),
        ("preferred_language", r"\bi prefer ([A-Za-z]{3,20})"),
        ("grade", r"\bi am in grade ([0-9]{1,2})"),
    ]
    for key, pat in patterns:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if not m:
            continue
        val = m.group(1).strip().strip(".")
        if key == "grade":
            val = f"Grade {val}"
        out[key] = val
    return out


def _google_search_snippets(query: str, max_results: int = 3) -> List[Dict[str, str]]:
    api_key = os.environ.get("GOOGLE_SEARCH_API_KEY", "").strip()
    cx = os.environ.get("GOOGLE_SEARCH_CX", "").strip()
    if not api_key or not cx:
        return []

    try:
        r = requests.get(
            "https://www.googleapis.com/customsearch/v1",
            params={
                "key": api_key,
                "cx": cx,
                "q": query,
                "num": max(1, min(max_results, 10)),
                "safe": "active",
            },
            timeout=12,
        )
        if r.status_code != 200:
            return []
        payload = r.json() or {}
        items = payload.get("items") or []
        out: List[Dict[str, str]] = []
        for it in items[:max_results]:
            out.append(
                {
                    "title": str(it.get("title") or "")[:200],
                    "snippet": str(it.get("snippet") or "")[:600],
                    "link": str(it.get("link") or "")[:300],
                }
            )
        return out
    except Exception:
        return []


def ask_tutor_personal_agent(
    message: str,
    email: Optional[str],
    language: Optional[str],
    subject: Optional[str],
    title: Optional[str],
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, object]:
    user_msg = (message or "").strip()
    if not user_msg:
        return {"error": "Message cannot be empty"}

    email_key = _email_key(email)
    assistant_memory.setdefault(email_key, [])
    assistant_user_facts.setdefault(email_key, {})

    learned = _extract_user_facts(user_msg)
    if learned:
        assistant_user_facts[email_key].update(learned)

    snapshot = personalization_store.get_user_snapshot(email_key)
    profile = snapshot.get("profile") or {}
    progress = snapshot.get("progress") or {}
    feedback = snapshot.get("feedback") or {}

    web_context = _google_search_snippets(user_msg, max_results=3)

    hist = history or assistant_memory[email_key][-20:]
    history_text = "\n".join([f"{m.get('role','user')}: {m.get('content','')}" for m in hist[-20:]])

    lang = (language or "English").strip()
    subj = (subject or "General").strip()
    chat_title = (title or "Perosnla IIntelligence").strip()

    system_prompt = (
        "You are Tutor, the personal assistant for the Perosnla IIntelligence section. "
        "Be a warm Siri-like helper and a sweet teacher for homework/study support. "
        "Use the user's stored profile, progress, and preferences when relevant. "
        "If Google context is present, use it carefully and include short source links. "
        "Be helpful, clear, and never invent unknown facts."
    )

    prompt_parts = [
        f"Language: {lang}",
        f"Subject preference: {subj}",
        f"Conversation title: {chat_title}",
        f"User profile: {profile}",
        f"Known facts: {assistant_user_facts[email_key]}",
        f"Progress summary: total_questions={progress.get('total_questions', 0)}, total_correct={progress.get('total_correct', 0)}, total_score={progress.get('total_score', 0)}",
        f"Feedback summary: {feedback}",
    ]
    if history_text:
        prompt_parts.append("Recent conversation:\n" + history_text)
    if web_context:
        prompt_parts.append("Google context:\n" + "\n".join([f"- {x['title']}: {x['snippet']} ({x['link']})" for x in web_context]))
    prompt_parts.append("User message:\n" + user_msg)
    user_prompt = "\n\n".join(prompt_parts)

    client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    try:
        response = client.chat.completions.create(
            model="moonshotai/kimi-k2-instruct-0905",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.6,
        )
        answer = (response.choices[0].message.content or "").strip()
    except Exception as e:
        return {"error": f"Assistant request failed: {str(e)}"}

    assistant_memory[email_key].append({"role": "user", "content": user_msg})
    assistant_memory[email_key].append({"role": "assistant", "content": answer})
    assistant_memory[email_key] = assistant_memory[email_key][-60:]

    return {
        "answer": answer,
        "used_google_context": bool(web_context),
        "google_results": web_context,
        "learned_facts": learned,
    }
