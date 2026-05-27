import asyncio
import os
import sys
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import engine, WatchProgress

async def main():
    async with AsyncSession(engine) as s:
        res = await s.exec(select(WatchProgress))
        print("All WatchProgress:", res.all())

if __name__ == "__main__":
    asyncio.run(main())
