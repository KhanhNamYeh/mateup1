from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field # Import Field for potential default values
from typing import Optional, List, Dict
import json
import time # For potential unique ID generation if needed, though simple increment is used here

# Create router
router = APIRouter()

# Templates
templates = Jinja2Templates(directory="templates")

# --- Pydantic Models ---

class InvestmentBase(BaseModel):
    project_id: int
    title: str
    category: str
    stage: str
    description: str
    image: Optional[str] = None
    status: str = "pending" # Default status on creation
    target_investment: int
    total_invested: int = 0 # Default to 0 on creation
    valuation: int
    min_investment: int
    expected_roi: int  
    duration_months: int
    region: str
    impact_area: str
    risk_level: str
    founding_team: List[str]
    use_of_funds: str

class InvestmentCreate(InvestmentBase):
    # Inherits all fields from InvestmentBase
    # No 'id' field here, as it's for creation
    pass

class InvestmentRead(InvestmentBase):
    # Inherits fields from InvestmentBase
    id: int # 'id' is included when reading/returning investment data

    class Config:
        orm_mode = True

@router.get("/investment", response_class=HTMLResponse)
async def investment_page(request: Request):
    # Ensure session variables are available
    is_logged_in = request.session.get("is_logged_in", False)
    username = request.session.get("username", "")
    return templates.TemplateResponse("investment.html", {
        "request": request,
        "is_logged_in": is_logged_in,
        "username": username
    })
    
@router.get("/investment_detail", response_class=HTMLResponse)
async def investment_page(request: Request):
    # Ensure session variables are available
    is_logged_in = request.session.get("is_logged_in", False)
    username = request.session.get("username", "")
    return templates.TemplateResponse("investment_detail.html", {
        "request": request,
        "is_logged_in": is_logged_in,
        "username": username
    })
    
@router.get("/investment_detail/{investment_id}", response_class=HTMLResponse)
async def investment_detail_page(request: Request, investment_id: int):
    # Ensure session variables are available
    is_logged_in = request.session.get("is_logged_in", False)
    username = request.session.get("username", "")
    return templates.TemplateResponse("investment_detail_id.html", {
        "request": request,
        "is_logged_in": is_logged_in,
        "username": username,
        "investment_id": investment_id
    })

@router.get("/api/investment")
# Optionally specify response_model=List[InvestmentRead]
async def get_investment(request: Request):
    try:
        with open("db/db.json", "r") as file:
            data = json.load(file)
            all_investments = data.get("investments", [])
        # Ensure the data matches InvestmentRead if using response_model
        # For simplicity, returning raw dict list
        return {"investments": all_investments}
    except FileNotFoundError:
        return {"investments": []}
    except Exception as e:
        # Log error e
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error: {str(e)}"}
        )

@router.get("/api/investment/{investment_id}", response_model=InvestmentRead)
async def get_investment_by_id(request: Request, investment_id: int):
    try:
        with open("db/db.json", "r") as file:
            data = json.load(file)
            all_investments = data.get("investments", [])

        investment = next((inv for inv in all_investments if inv.get("id") == investment_id), None)

        if investment:
            # Validate against InvestmentRead before returning if needed,
            # or Pydantic handles it via response_model
            return investment
        else:
            raise HTTPException(status_code=404, detail="Investment not found")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Database file not found")
    except Exception as e:
        # Log error e
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error: {str(e)}"}
        )

# --- Investment Registration Flow ---

@router.get("/investment-register", response_class=HTMLResponse)
async def investment_register_page_router(request: Request, project_id: Optional[int] = Query(None)):
    is_logged_in = request.session.get("is_logged_in", False)
    username = request.session.get("username", "")

    if not is_logged_in:
        return RedirectResponse(url="/login?next=/investment-register", status_code=302)

    try:
        with open("db/db.json", "r") as file:
            data = json.load(file)
            all_projects_data = data.get("projects", [])
            all_investments_data = data.get("investments", [])
            all_connections_data = data.get("connections", [])

        if project_id is None:
            # User needs to select a project
            user_projects_for_investment = []
            current_user = username # Already fetched

            if not current_user:
                raise HTTPException(status_code=403, detail="User not identified in session.")

            project_ids_with_investments = {inv.get("project_id") for inv in all_investments_data}

            for conn in all_connections_data:
                if current_user in conn.get("users", []):
                    proj_id_from_conn = conn.get("project_id")
                    if proj_id_from_conn not in project_ids_with_investments:
                        project_detail = next((proj for proj in all_projects_data if proj["id"] == proj_id_from_conn), None)
                        if project_detail:
                             user_projects_for_investment.append({
                                "id": project_detail["id"],
                                "title": project_detail.get("title", f"Project {project_detail['id']}")
                            })

            unique_projects = {p['id']: p for p in user_projects_for_investment}.values()

            if not unique_projects:
                 return templates.TemplateResponse("error.html", {
                    "request": request, "is_logged_in": is_logged_in, "username": username,
                    "message": "No projects available for you to register an investment for, or investments for your projects are already registered."
                })

            return templates.TemplateResponse("select_project_for_investment.html", {
                "request": request,
                "is_logged_in": is_logged_in,
                "username": username,
                "available_projects": list(unique_projects)
            })
        else:
            # Project ID is provided, proceed to the registration form
            project = next((proj for proj in all_projects_data if proj["id"] == project_id), None)

            if not project:
                raise HTTPException(status_code=404, detail="Project not found for the given project_id.")

            # Check if an investment for this project_id already exists
            existing_investment = next((inv for inv in all_investments_data if inv.get("project_id") == project_id), None)
            if existing_investment:
                return templates.TemplateResponse("error.html", {
                    "request": request, "is_logged_in": is_logged_in, "username": username,
                    "message": f"An investment for Project ID {project_id} (Title: {project.get('title', '')}) has already been registered."
                })

            # Prepare default data based on project (does not include investment 'id')
            default_investment_data = {
                "project_id": project["id"],
                "title": project.get("title", ""),
                "category": project.get("category", ""),
                "stage": project.get("stage", ""),
                "description": project.get("description", ""),
                "image": project.get("image", None),
                # status, total_invested will use defaults from model or form logic
                "target_investment": 0, # User needs to fill this
                "valuation": project.get("valuation", 0),
                "min_investment": 0, # User needs to fill this
                "expected_roi": 0, # User needs to fill this
                "duration_months": 0, # User needs to fill this
                "region": project.get("region", ""),
                "impact_area": project.get("impact_area", ""),
                "risk_level": "medium", # Default
                "founding_team": project.get("founding_team", []),
                "use_of_funds": "" # User needs to fill this
            }

            return templates.TemplateResponse("investment_register.html", {
                "request": request,
                "is_logged_in": is_logged_in,
                "username": username,
                "default_investment": default_investment_data # Pass the prepared dict
            })
    except FileNotFoundError:
         return templates.TemplateResponse("error.html", {
            "request": request, "is_logged_in": is_logged_in, "username": username,
            "message": "Database file (db.json) not found."
        })
    except Exception as e:
        # Log the error e for debugging
        print(f"ERROR in /investment-register GET: {str(e)}")
        return templates.TemplateResponse("error.html", {
            "request": request, "is_logged_in": is_logged_in, "username": username,
            "message": f"An unexpected error occurred: {str(e)}"
        })


# --- POST Endpoints (Using InvestmentCreate) ---

@router.post("/api/investment/register") # , response_model=InvestmentRead <-- Optional: specify response shape
async def register_investment(request: Request, investment_payload: InvestmentCreate):
    if not request.session.get("is_logged_in", False):
        return JSONResponse(
            status_code=403, # Forbidden
            content={"success": False, "message": "Authentication required."}
        )
    try:
        with open("db/db.json", "r+") as file:
            data = json.load(file)
            all_investments = data.get("investments", [])

            # Check if investment for this project_id already exists
            existing_investment = next((inv for inv in all_investments if inv.get("project_id") == investment_payload.project_id), None)
            if existing_investment:
                return JSONResponse(
                    status_code=409, # Conflict
                    content={"success": False, "message": f"An investment for project ID {investment_payload.project_id} already exists."}
                )

            # Simple auto-increment ID logic
            new_id = 1
            if all_investments:
                new_id = max(inv.get("id", 0) for inv in all_investments) + 1

            # Create the full investment dictionary, including the generated ID
            # Use .model_dump() for Pydantic v2+ or .dict() for v1
            try: # Pydantic v2+
                investment_dict = investment_payload.model_dump()
            except AttributeError: # Pydantic v1
                 investment_dict = investment_payload.dict()

            investment_dict["id"] = new_id
             # Ensure defaults from model are present if not sent or handled by Pydantic
            investment_dict.setdefault("status", "pending")
            investment_dict.setdefault("total_invested", 0)


            all_investments.append(investment_dict)
            data["investments"] = all_investments

            file.seek(0)
            json.dump(data, file, indent=4)
            file.truncate()

        # Return success and the ID of the newly created investment
        return {"success": True, "message": "Investment registered successfully", "investment_id": new_id}

    except Exception as e:
        # Log error e
        print(f"ERROR in /api/investment/register POST: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error registering investment: {str(e)}"}
        )


# Generic create endpoint (Consider if this is needed alongside register)
@router.post("/api/investment") # , response_model=InvestmentRead <-- Optional
async def create_investment(request: Request, investment_payload: InvestmentCreate):
     # Add authentication check similar to register_investment if needed
    if not request.session.get("is_logged_in", False):
         return JSONResponse(status_code=403, content={"success": False, "message": "Authentication required."})

    try:
        with open("db/db.json", "r+") as file:
            data = json.load(file)
            all_investments = data.get("investments", [])

             # Optional: Add check for existing project_id if needed here too
            existing_investment = next((inv for inv in all_investments if inv.get("project_id") == investment_payload.project_id), None)
            if existing_investment:
                return JSONResponse(status_code=409, content={"success": False, "message": f"An investment for project ID {investment_payload.project_id} already exists."})


            new_id = 1
            if all_investments:
                new_id = max(inv.get("id", 0) for inv in all_investments) + 1

            try: # Pydantic v2+
                investment_dict = investment_payload.model_dump()
            except AttributeError: # Pydantic v1
                 investment_dict = investment_payload.dict()

            investment_dict["id"] = new_id
            investment_dict.setdefault("status", "pending")
            investment_dict.setdefault("total_invested", 0)

            all_investments.append(investment_dict)
            data["investments"] = all_investments

            file.seek(0)
            json.dump(data, file, indent=4)
            file.truncate()

        return {"success": True, "message": "Investment created successfully", "investment_id": new_id}
    except Exception as e:
         # Log error e
        print(f"ERROR in /api/investment POST: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Error creating investment: {str(e)}"}
        )