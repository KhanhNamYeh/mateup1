from fastapi import APIRouter, Request, HTTPException, Depends, Body
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Optional, List, Dict
import json
import os
import math # Import math for ceiling function

router = APIRouter()

# Templates
templates = Jinja2Templates(directory="templates")

# --- Pydantic Models ---
class Task(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: bool = False
    dueDate: Optional[str] = None

class TodoListCreate(BaseModel):
    title: str
    project_id: int # Or however you link it
    partner_username: str # The user you are creating the list with
    tasks: List[Task] = [] # Allow creating with initial tasks if needed

class TaskUpdate(BaseModel):
    status: bool

class TaskCreate(BaseModel):
    title: str

# --- Helper Functions ---
DB_FILE = "db/db.json"

def read_db():
    """Reads the entire database file."""
    if not os.path.exists(DB_FILE):
        # Initialize with empty structure if file doesn't exist
        return {"users": [], "projects": [], "connection_requests": [], "connections": [], "todolists": []}
    try:
        with open(DB_FILE, "r", encoding='utf-8') as file: # Specify encoding
            content = file.read()
            if not content: # Handle empty file
                 return {"users": [], "projects": [], "connection_requests": [], "connections": [], "todolists": []}
            return json.loads(content)
    except (json.JSONDecodeError, FileNotFoundError):
        # Handle corrupted file or race condition
        return {"users": [], "projects": [], "connection_requests": [], "connections": [], "todolists": []}
    except Exception as e:
        print(f"Error reading DB file: {e}") # Log other potential errors
        return {"users": [], "projects": [], "connection_requests": [], "connections": [], "todolists": []}


def write_db(data: Dict):
    """Writes the entire database file."""
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    try:
        # Use ensure_ascii=False for broader character support
        with open(DB_FILE, "w", encoding='utf-8') as file: # Specify encoding
            json.dump(data, file, indent=4, ensure_ascii=False)
    except IOError as e:
        print(f"Error writing to database file: {e}")
        # Consider raising an exception or logging more formally
    except Exception as e:
        print(f"Unexpected error writing DB file: {e}")


def get_current_user(request: Request) -> Optional[str]:
    """Dependency to get current logged-in username from session."""
    username = request.session.get("username")
    if not request.session.get("is_logged_in") or not username:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return username

# --- Routes ---

@router.get("/connection", response_class=HTMLResponse)
async def connection_page(request: Request):
    """Renders the main connection page."""
    # Pass login status and username to the template
    return templates.TemplateResponse("connection.html", {
        "request": request,
        "is_logged_in": request.session.get("is_logged_in", False),
        "username": request.session.get("username", "")
        # You might pass partner_username if navigating from a specific link
        # "partner_username_from_server": request.query_params.get("partner")
    })

@router.get("/api/connections", response_class=JSONResponse)
async def get_all_connections(current_user: str = Depends(get_current_user)):
    """Gets all connections for the current user."""
    data = read_db()
    connections = data.get("connections", [])
    
    # Filter connections that include the current user
    user_connections = [
        conn for conn in connections
        if current_user in conn.get("users", [])
    ]
    
    # Optionally, you could enhance this with more data like:
    # - When the connection was created
    # - Number of shared todolists
    # - Latest activity
    
    return {"connections": user_connections}

@router.get("/api/connections/pending", response_class=JSONResponse)
async def get_pending_requests(current_user: str = Depends(get_current_user)):
    """Gets connection requests pending for the current user."""
    data = read_db()
    pending_requests = [
        req for req in data.get("connection_requests", [])
        if req.get("to") == current_user and req.get("status") is False
    ]
    return {"success": True, "requests": pending_requests}

@router.post("/api/connections/accept/{request_id}", response_class=JSONResponse)
async def accept_connection_request(request_id: int, current_user: str = Depends(get_current_user)):
    """Accepts a connection request and creates a connection."""
    data = read_db()
    connection_requests = data.get("connection_requests", [])
    connections = data.get("connections", [])
    request_to_accept = None
    request_index = -1

    for i, req in enumerate(connection_requests):
        # Ensure ID matches, request is for current user, and status is false
        if req.get("id") == request_id and req.get("to") == current_user and req.get("status") is False:
            request_to_accept = req
            request_index = i
            break

    if not request_to_accept:
        raise HTTPException(status_code=404, detail="Pending connection request not found or already accepted")

    # 1. Update request status
    connection_requests[request_index]["status"] = True

    # 2. Create connection if it doesn't exist
    user1 = request_to_accept["from"]
    user2 = current_user
    # Check if a connection between these two users already exists
    existing_connection = next((conn for conn in connections if sorted(conn.get("users", [])) == sorted([user1, user2])), None)

    if not existing_connection:
        # Find the next available ID for the connection
        new_connection_id = max([conn.get("id", 0) for conn in connections] + [0]) + 1
        connections.append({
            "id": new_connection_id,
            "users": sorted([user1, user2]), # Store sorted usernames
            "project_id": request_to_accept.get("project_id") # Carry over project ID if needed
            # Add other relevant connection details if necessary (e.g., timestamp)
        })

    data["connection_requests"] = connection_requests
    data["connections"] = connections
    write_db(data)

    return {"success": True, "message": "Connection accepted"}

@router.post("/api/todolists", response_class=JSONResponse)
async def create_todolist(todolist_data: TodoListCreate, current_user: str = Depends(get_current_user)):
    """Creates a new shared todolist."""
    data = read_db()
    connections = data.get("connections", [])
    todolists = data.get("todolists", [])
    partner_username = todolist_data.partner_username

    # Verify connection exists between current_user and partner_username
    is_connected = any(
        sorted(conn.get("users", [])) == sorted([current_user, partner_username])
        for conn in connections
    )
    if not is_connected:
        raise HTTPException(status_code=403, detail=f"You are not connected with {partner_username}")

    # Find the next available ID for the todolist
    new_list_id = max([lst.get("id", 0) for lst in todolists] + [0]) + 1

    # Assign IDs to initial tasks if provided
    next_task_id = 1 # Start task IDs from 1 within this list
    processed_tasks = []
    for task_data in todolist_data.tasks:
        task_dict = task_data.dict()
        task_dict["id"] = next_task_id
        processed_tasks.append(task_dict)
        next_task_id += 1

    new_todolist = {
        "id": new_list_id,
        "title": todolist_data.title,
        "project_id": todolist_data.project_id, # Ensure this is handled correctly
        "users": sorted([current_user, partner_username]), # Store users involved
        "tasks": processed_tasks # Use tasks with assigned IDs
    }
    todolists.append(new_todolist)
    data["todolists"] = todolists
    write_db(data)

    return {"success": True, "message": "Todolist created", "todolist": new_todolist}

@router.get("/api/todolists/shared/{partner_username}", response_class=JSONResponse)
async def get_shared_todolists(partner_username: str, current_user: str = Depends(get_current_user)):
    """Gets todolists shared between the current user and a partner."""
    data = read_db()
    todolists = data.get("todolists", [])

    shared_lists = [
        lst for lst in todolists
        if sorted(lst.get("users", [])) == sorted([current_user, partner_username])
    ]

    return {"success": True, "todolists": shared_lists}

@router.get("/api/todolists", response_class=JSONResponse)
async def get_all_todolists(current_user: str = Depends(get_current_user)):
    """Gets all todolists that the current user has access to."""
    data = read_db()
    todolists = data.get("todolists", [])
    
    # Filter for lists that include the current user
    user_lists = [
        lst for lst in todolists
        if current_user in lst.get("users", [])
    ]
    
    return {"success": True, "todolists": user_lists}

@router.patch("/api/todolists/{list_id}/tasks/{task_id}", response_class=JSONResponse)
async def update_task_status(
    list_id: int,
    task_id: int,
    task_update: TaskUpdate,
    current_user: str = Depends(get_current_user)
):
    """Updates the status of a specific task in a todolist."""
    data = read_db()
    todolists = data.get("todolists", [])
    list_found = False
    task_found = False
    list_index = -1
    task_index = -1

    # Find the list
    for i, lst in enumerate(todolists):
        if lst.get("id") == list_id:
            # Ensure the current user is part of this list
            if current_user not in lst.get("users", []):
                 raise HTTPException(status_code=403, detail="You do not have access to this todolist")
            list_found = True
            list_index = i
            # Find the task within the list
            tasks = lst.get("tasks", [])
            for j, task in enumerate(tasks):
                if task.get("id") == task_id:
                    task_found = True
                    task_index = j
                    break # Found task, break inner loop
            if task_found:
                break # Found list and task, break outer loop

    if not list_found:
        raise HTTPException(status_code=404, detail="Todolist not found")
    if not task_found:
        raise HTTPException(status_code=404, detail="Task not found in this list")

    # Update the task status
    todolists[list_index]["tasks"][task_index]["status"] = task_update.status

    # Write the updated data back to the file
    data["todolists"] = todolists
    write_db(data)

    return {"success": True, "message": "Task status updated"}

@router.get("/api/todolists_projectID/{project_id}", response_class=JSONResponse)
async def get_todolists_by_project_id(request: Request, project_id: int):
    try:
        with open("db/db.json", "r") as file:
            data = json.load(file)
            all_todolists = data.get("todolists", [])
        todolist = next((t for t in all_todolists if t["project_id"] == project_id), None)
        if todolist:
            return {"todolist": todolist}
        else:
            raise HTTPException(status_code=404, detail="Todolist not found")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Database file not found")
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error: {str(e)}"}
        )

@router.post("/api/todolists/{list_id}/tasks", response_class=JSONResponse)
async def add_task_to_list(
    list_id: int,
    task_data: TaskCreate,
    current_user: str = Depends(get_current_user)
):
    """Adds a new task to a specific todolist."""
    data = read_db()
    todolists = data.get("todolists", [])
    list_found = False
    list_index = -1

    # Find the list
    for i, lst in enumerate(todolists):
        if lst.get("id") == list_id:
            # Ensure the current user is part of this list
            if current_user not in lst.get("users", []):
                 raise HTTPException(status_code=403, detail="You do not have access to this todolist")
            list_found = True
            list_index = i
            break

    if not list_found:
        raise HTTPException(status_code=404, detail="Todolist not found")

    # Determine the next task ID within this list
    tasks = todolists[list_index].get("tasks", [])
    next_task_id = max([task.get("id", 0) for task in tasks] + [0]) + 1

    # Create the new task dictionary
    new_task = {
        "id": next_task_id,
        "title": task_data.title,
        "status": False, # New tasks are initially not completed
        "description": None, # Add default values for other potential fields
        "dueDate": None
    }

    # Add the new task to the list's tasks array
    # Ensure 'tasks' key exists, initialize if not (though it should from read_db)
    if "tasks" not in todolists[list_index]:
        todolists[list_index]["tasks"] = []
    todolists[list_index]["tasks"].append(new_task)

    # Write the updated data back to the file
    data["todolists"] = todolists
    write_db(data)

    # Return the newly created task
    return {"success": True, "message": "Task added", "task": new_task}

@router.delete("/api/todolists/{list_id}/tasks/{task_id}", response_class=JSONResponse)
async def delete_task(
    list_id: int,
    task_id: int,
    current_user: str = Depends(get_current_user)
):
    """Deletes a task from a todolist."""
    data = read_db()
    todolists = data.get("todolists", [])
    list_found = False
    task_found = False
    
    # Find the list and task
    for i, lst in enumerate(todolists):
        if lst.get("id") == list_id:
            # Ensure the current user is part of this list
            if current_user not in lst.get("users", []):
                raise HTTPException(status_code=403, detail="You do not have access to this todolist")
            
            list_found = True
            tasks = lst.get("tasks", [])
            
            # Filter out the task to delete
            new_tasks = [task for task in tasks if task.get("id") != task_id]
            
            # If task was found and removed
            if len(new_tasks) < len(tasks):
                task_found = True
                todolists[i]["tasks"] = new_tasks
                break
    
    if not list_found:
        raise HTTPException(status_code=404, detail="Todolist not found")
    if not task_found:
        raise HTTPException(status_code=404, detail="Task not found in this list")
        
    # Write the updated data back to the file
    data["todolists"] = todolists
    write_db(data)
    
    return {"success": True, "message": "Task deleted successfully"}