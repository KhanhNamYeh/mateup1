from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
import uvicorn
import os
import json

# Import routers from routes folder
from routes.login import router as login_router
from routes.register import router as register_router
from routes.projects import router as projects_router
from routes.connection import router as connection_router
from routes.investment import router as investment_router
from routes.botchat import router as botchat_router

# Initialize app
app = FastAPI()

# Add session middleware
app.add_middleware(
    SessionMiddleware,
    secret_key="your-secret-key-here",  # Change this to a secure random key in production!
    session_cookie="session_cookie",
    max_age=3600  # Session expiration in seconds (1 hour)
)

# Static files and templates
app.mount("/static", StaticFiles(directory="templates"), name="static")
templates = Jinja2Templates(directory="templates")

# Initialize db.json if it doesn't exist
def initialize_users_file():
    if not os.path.exists("db/db.json"):
        os.makedirs("db", exist_ok=True)
        with open("db/db.json", "w") as file:
            json.dump({"users": []}, file)

initialize_users_file()

# Include routers from the routes folder
app.include_router(login_router)
app.include_router(register_router)
app.include_router(projects_router)
app.include_router(connection_router)
app.include_router(investment_router)
app.include_router(botchat_router)

# Main index route
@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {
        "request": request,
        "is_logged_in": request.session.get("is_logged_in", False),
        "username": request.session.get("username", "")
    })
    
@app.get("/blog", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("blog.html", {
        "request": request,
        "is_logged_in": request.session.get("is_logged_in", False),
        "username": request.session.get("username", "")
    })
    
@app.get("/course", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("course.html", {
        "request": request,
        "is_logged_in": request.session.get("is_logged_in", False),
        "username": request.session.get("username", "")
    })

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)