from pydantic import BaseModel


class PaginatedRequest(BaseModel):
    limit: int = 50
    offset: int = 0


class MessageResponse(BaseModel):
    ok: bool = True
    message: str = ""
