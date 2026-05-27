import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import AnimeDatabase

async def main():
    db = AnimeDatabase()
    res = await db.get_recent_watch_progress("test-session")
    print("Watch progress:", res)

if __name__ == "__main__":
    asyncio.run(main())
