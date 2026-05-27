import asyncio
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from backend.database import engine, WatchProgress

async def main():
    async with AsyncSession(engine) as s:
        res = await s.exec(select(WatchProgress))
        for wp in res.all():
            print(f"Session: {wp.session_id}, Anime: {wp.anime_id}, Ep: {wp.episode_id}")

if __name__ == "__main__":
    asyncio.run(main())
