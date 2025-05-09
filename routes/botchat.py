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
    
    suggestions = {
        "programming": {
            "title": "Programming To-Do List",
            "tasks": [
                "Set up project structure and Git repository",
                "Design database schema",
                "Implement user authentication (login/register)",
                "Build core API endpoints",
                "Write unit and integration tests"
            ]
        },
        "design": {
            "title": "Design To-Do List",
            "tasks": [
                "Create moodboard and style guide",
                "Design wireframes for key pages",
                "Build hi-fi UI prototypes",
                "Get feedback from team/users",
                "Export assets and deliver to dev team"
            ]
        },
        "business": {
            "title": "Business To-Do List",
            "tasks": [
                "Conduct market research",
                "Define target customer segments",
                "Build business model canvas",
                "Create financial projections",
                "Pitch deck preparation"
            ]
        },
        "marketing": {
            "title": "Marketing To-Do List",
            "tasks": [
                "Define brand identity",
                "Set up social media accounts",
                "Create content calendar",
                "Launch landing page with email capture",
                "Run first marketing campaign"
            ]
        }
    }
    
    for key in suggestions:
        if key in message and ("suggest" in message or "todo" in message or "task" in message):
            tasks = suggestions[key]["tasks"]
            formatted = f"📝 {suggestions[key]['title']}:\n" + "\n".join([f"- {task}" for task in tasks])
            return formatted

    if "introduce" in message and "mates" in message or "mate" in message and "up" in message:
        return ("MatesUp offers a comprehensive solution for the startup community, covering everything from finding suitable "
                "team members and supporting project development to connecting with investors...")
    
    if "how" in message and "connect" in message:
        return "You just accept the request from the person who sent you a request."
    
    if "how" in message and "todo" in message and "list" in message:
        return "There is a 'Create new lists' button. Click on it to create a new list and add tasks using the 'Add task' button."

    if "ok" in message:
        return "let's do it now !!!!!!" 
    
    return "Sorry, I don't understand your question. Please try again."
