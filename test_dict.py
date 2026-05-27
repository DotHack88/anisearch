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
        row = res.first()
        if row:
            print("Row dict:", row.dict() if hasattr(row, 'dict') else "No dict")
            print("Row asdict:", row._asdict() if hasattr(row, '_asdict') else "No asdict")

if __name__ == "__main__":
    asyncio.run(main())
