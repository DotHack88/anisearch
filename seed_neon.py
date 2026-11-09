"""
seed_neon.py — Popola il database Neon da locale.
Esegui con: python seed_neon.py
"""
import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

root = Path(__file__).resolve().parent
sys.path.append(str(root))

# Carica variabili d'ambiente
load_dotenv(root / ".env")
load_dotenv(root / "backend" / ".env")

database_url = os.getenv("DATABASE_URL")
if not database_url:
    raise ValueError("DATABASE_URL non configurato nelle variabili d'ambiente. Impostalo prima di eseguire seed_neon.py.")

from backend.database import AnimeDatabase
from backend.scraper import AnimeWorldScraper

async def main():
    db = AnimeDatabase()
    count = await db.count()
    print(f"Anime attualmente nel DB Neon: {count}")
    
    if count > 5000:
        print("Il DB è già sufficientemente popolato. Uscita.")
        return

    scraper = AnimeWorldScraper()
    loop = asyncio.get_running_loop()

    print("Avvio scraping completo A-Z (potrebbe richiedere 30-60 min)...")
    await asyncio.to_thread(scraper.build_full_index, db, loop=loop)
    
    final_count = await db.count()
    print(f"\nScraping completato! Anime totali nel DB Neon: {final_count}")

if __name__ == "__main__":
    asyncio.run(main())
