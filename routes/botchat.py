from fastapi import APIRouter, Request, HTTPException, Depends, Body
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Optional, List, Dict
import datetime
import json

router = APIRouter()

# Message model for API requests/responses
class MessageRequest(BaseModel):
    message: str
    chatId: str
    username: Optional[str] = None

class MessageResponse(BaseModel):
    success: bool
    reply: str
    chatId: str

@router.post("/api/message")
async def process_message(request: Request, message_data: dict = Body(...)):
    try:
        message = message_data.get("message", "")
        chat_id = message_data.get("chatId", "")
        username = message_data.get("username", "User")
        
        # Log message (optional)
        print(f"Received message from {username}: {message}")
        
        reply = generate_reply(message, username)
            
        return {"success": True, "reply": reply, "chatId": chat_id}
        
    except Exception as e:
        print(f"Error in process_message: {str(e)}")
        return {"success": False, "reply": "Sorry, I couldn't process your message. Please try again.", "chatId": message_data.get("chatId", "")}

def generate_reply(message: str, username: str) -> str:
    message = message.lower()
    if "introduce" and "mates" and "up" in message:
        reply = "MatesUp offers a comprehensive solution for the startup community, covering everything from finding suitable team members and supporting project development to connecting with investors. The platform integrates tools and training resources, along with in-depth mentorship, to make the startup journey more effective. The core value of the project lies in fostering an innovative entrepreneurial spirit, promoting sustainable project development, and contributing to the growth of the young startup ecosystem."
    else:
        reply = "Sorry, I don't understand your question. Please try again."
    return reply