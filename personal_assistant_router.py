from typing import Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from personal_assistant_service import ask_tutor_personal_agent


router = APIRouter(prefix="/personal-intelligence", tags=["personal-intelligence"])


class PersonalAssistantAskRequest(BaseModel):
    message: str
    email: Optional[str] = "guest@student.com"
    language: Optional[str] = "English"
    subject: Optional[str] = "General"
    title: Optional[str] = "Perosnla IIntelligence"
    history: Optional[List[Dict[str, str]]] = None


@router.post("/ask")
async def personal_assistant_ask(req: PersonalAssistantAskRequest):
    return ask_tutor_personal_agent(
        message=req.message,
        email=req.email,
        language=req.language,
        subject=req.subject,
        title=req.title,
        history=req.history,
    )
