from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import json

# Create router
router = APIRouter()

# Model for registration data
class RegisterData(BaseModel):
    username: str
    email: str
    password: str

@router.post("/api/register")
async def register(register_data: RegisterData):
    try:
        # Load existing users
        with open("db/db.json", "r") as file:
            data = json.load(file)
        
        # Check if email already exists
        for user in data.get("users", []):
            if user["email"] == register_data.email:
                return JSONResponse(
                    status_code=400,
                    content={"success": False, "message": "Email already registered"}
                )
        
        # Add new user
        new_user = {
            "username": register_data.username,
            "email": register_data.email,
            "password": register_data.password  # In production, hash this password!
        }
        
        data["users"].append(new_user)
        
        # Save updated user list
        with open("db/db.json", "w") as file:
            json.dump(data, file, indent=4)
        
        return {"success": True, "message": "Registration successful"}
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": f"Server error: {str(e)}"}
        )