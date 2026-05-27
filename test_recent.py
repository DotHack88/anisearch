import asyncio
import os
import sys
from backend.database import AnimeDatabase

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def main():
    db = AnimeDatabase()
    res = await db.get_recent_watch_progress('9b9ab2a9-2651-46fe-9200-4a67c45cbd6a', 10)
    print("RES:", res)

if __name__ == "__main__":
    asyncio.run(main())
