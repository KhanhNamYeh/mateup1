from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Optional, List, Dict
import json

# Create router
router = APIRouter()

# Templates
templates = Jinja2Templates(directory="templates")

class Project(BaseModel):
    title: str
    description: str
    category: str
    stage: str
    startDate: Optional[str] = None
    progress: Optional[int] = None
    image: Optional[str] = None

class ConnectionRequest(BaseModel):
    to: str
    project_id: int

@router.get("/projects", response_class=HTMLResponse)
async def projects_page(request: Request):
    # Pass login status and username to the template
    return templates.TemplateResponse("projects.html", {
        "request": request,
        "is_logged_in": request.session.get("is_logged_in", False),
        "username": request.session.get("username", "")
    })

@router.get("/project-register", response_class=HTMLResponse)
async def project_register_page(request: Request):
    # Pass login status and username to the template
    return templates.TemplateResponse("project_register.html", {
        "request": request,
        "is_logged_in": request.session.get("is_logged_in", False),
        "username": request.session.get("username", "")
    })

@router.get("/api/projects")
async def get_projects(request: Request):
    try:
        # Get current username from session
        current_username = request.session.get("username", None)
        is_logged_in = request.session.get("is_logged_in", False)
        
        # Read projects from database
        try:
            with open("db/db.json", "r") as file:
                data = json.load(file)
                all_projects = data.get("projects", [])
        except FileNotFoundError:
            return {"myProjects": [], "otherProjects": []}
        
        # If user is not logged in, return all projects as other projects
        if not is_logged_in or not current_username:
            return {
                "myProjects": [],
                "otherProjects": all_projects
            }
        
        # Filter projects by creator
        my_projects = [p for p in all_projects if p.get("creator") == current_username]
        other_projects = [p for p in all_projects if p.get("creator") != current_username]
        
        return {
            "myProjects": my_projects,
            "otherProjects": other_projects
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error: {str(e)}"}
        )

@router.post("/api/projects")
async def create_project(project: Project, request: Request):
    # Get username from session
    username = request.session.get("username", "Anonymous")
    is_logged_in = request.session.get("is_logged_in", False)
    
    if not is_logged_in:
        return JSONResponse(
            status_code=401,
            content={"success": False, "message": "You must be logged in to create a project"}
        )
    
    try:
        # Load existing data
        try:
            with open("db/db.json", "r") as file:
                data = json.load(file)
        except FileNotFoundError:
            data = {"db": [], "projects": []}
        
        # Initialize projects array if it doesn't exist
        if "projects" not in data:
            data["projects"] = []
        
        # Create new project with ID
        new_project = project.dict()
        new_project["id"] = len(data["projects"]) + 1
        new_project["creator"] = username
        
        # Add to projects list
        data["projects"].append(new_project)
        
        # Save updated data
        with open("db/db.json", "w") as file:
            json.dump(data, file, indent=4)
        
        return {"success": True, "message": "Project created successfully", "project": new_project}
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error: {str(e)}"}
        )

@router.post("/api/connection-request")
async def create_connection_request(request_data: ConnectionRequest, request: Request):
    # Get username from session
    from_user = request.session.get("username", None)
    is_logged_in = request.session.get("is_logged_in", False)
    
    if not is_logged_in or not from_user:
        return JSONResponse(
            status_code=401,
            content={"success": False, "message": "You must be logged in to send connection requests"}
        )
    
    to_user = request_data.to
    project_id = request_data.project_id
    
    if from_user == to_user:
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": "You cannot send a connection request to yourself"}
        )
    
    try:
        # Load existing data
        try:
            with open("db/db.json", "r") as file:
                data = json.load(file)
        except FileNotFoundError:
            data = {"db": [], "projects": [], "connection_requests": []}
        
        # Initialize connection_requests array if it doesn't exist
        if "connection_requests" not in data:
            data["connection_requests"] = []
        
        # Check if request already exists
        existing_request = next((req for req in data["connection_requests"] 
                               if req["from"] == from_user and 
                               req["to"] == to_user and
                               req["project_id"] == project_id), None)
        
        if existing_request:
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Connection request already sent"}
            )
        
        # Create new connection request with ID
        new_request = {
            "id": len(data["connection_requests"]) + 1,
            "from": from_user,
            "to": to_user,
            "project_id": project_id,
            "status": False
        }
        
        # Add to connection_requests list
        data["connection_requests"].append(new_request)
        
        # Save updated data
        with open("db/db.json", "w") as file:
            json.dump(data, file, indent=4)
        
        return {"success": True, "message": "Connection request sent successfully"}
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error: {str(e)}"}
        )

@router.get("/api/connection-requests")
async def get_connection_requests(request: Request):
    # Get username from session
    username = request.session.get("username", None)
    is_logged_in = request.session.get("is_logged_in", False)
    
    if not is_logged_in or not username:
        return JSONResponse(
            status_code=401,
            content={"success": False, "message": "You must be logged in to view connection requests"}
        )
    
    try:
        # Load existing data
        try:
            with open("db/db.json", "r") as file:
                data = json.load(file)
                connection_requests = data.get("connection_requests", [])
        except FileNotFoundError:
            return {"success": True, "requests": []}
        
        # Filter connection requests for the current user (as sender)
        sent_requests = [req for req in connection_requests if req["from"] == username]
        
        return {
            "success": True,
            "requests": sent_requests
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error: {str(e)}"}
        )