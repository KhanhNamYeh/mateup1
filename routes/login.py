from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import json

# Create router
router = APIRouter()

# Templates
templates = Jinja2Templates(directory="templates")

# Model for login data
class LoginData(BaseModel):
    email: str
    password: str

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    # If user is already logged in, redirect to home
    if request.session.get("is_logged_in", False):
        return RedirectResponse(url="/")
        
    return templates.TemplateResponse("login.html", {"request": request})

@router.post("/api/login")
async def login(login_data: LoginData, request: Request):
    try:
        with open("db/db.json", "r") as file:
            data = json.load(file)
            
        for user in data.get("users", []):
            if user["email"] == login_data.email and user["password"] == login_data.password:
                # Set session data
                request.session["is_logged_in"] = True
                request.session["username"] = user["username"]
                request.session["email"] = user["email"]
                
                return {"success": True, "message": "Login successful"}
        
        return JSONResponse(
            status_code=401,
            content={"success": False, "message": "Invalid email or password"}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Server error: {str(e)}"}
        )

@router.get("/logout")
async def logout(request: Request):
    # Clear session data
    request.session.clear()
    return RedirectResponse(url="/")