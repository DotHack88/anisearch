import asyncio
import os
import sys
from sqlmodel import select, delete
from sqlmodel.ext.asyncio.session import AsyncSession

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import engine, WatchProgress

async def main():
    async with AsyncSession(engine) as s:
        # Check before
        res = await s.exec(select(WatchProgress))
        print("Before:", len(res.all()))
        
        # Try to delete something specific
        stmt = delete(WatchProgress).where(WatchProgress.anime_id == 'test1')
        await s.exec(stmt)
        await s.commit()

        # Check after
        res = await s.exec(select(WatchProgress))
        print("After:", len(res.all()))

if __name__ == "__main__":
    asyncio.run(main())
