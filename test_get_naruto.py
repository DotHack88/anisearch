import asyncio
import os
import sys

# Set working directory to project root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import AnimeDatabase

async def main():
    db = AnimeDatabase()
    res = await db.search_exact_or_fuzzy_fallback('naruto')
    if res:
        print(f"URL from DB: {res[0]['url']}")
    else:
        print("Not found in DB")

if __name__ == "__main__":
    asyncio.run(main())
