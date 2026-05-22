from fastapi import Request


STUDENT_HEADER = "X-Student-ID"


async def get_current_student_id(request: Request) -> int:
    """Extract student_id from request header. Falls back to 1."""
    value = request.headers.get(STUDENT_HEADER, "1")
    try:
        return int(value)
    except ValueError:
        return 1
