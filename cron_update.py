"""
cron_update.py — Script per aggiornare il database online con gli ultimi episodi.
Ideale per essere eseguito periodicamente tramite GitHub Actions o un cron job.
"""
import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Aggiungi la root del progetto al path
root = Path(__file__).resolve().parent
sys.path.insert(0, str(root))

# Carica le variabili d'ambiente (per DATABASE_URL)
load_dotenv(root / ".env")
load_dotenv(root / "backend" / ".env")

# Se non definita in env, usa la connessione Neon di default
if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = (
        "postgresql://neondb_owner:npg_efrDzXyh7lk8"
        "@ep-flat-dawn-abwjcau1-pooler.eu-west-2.aws.neon.tech"
        "/neondb?ssl=require"
    )

from backend.database import AnimeDatabase
from backend.scraper import AnimeWorldScraper

async def main():
    db = AnimeDatabase()
    scraper = AnimeWorldScraper()
    
    print("Connessione al database in corso...")
    initial_anime = await db.count()
    initial_episodes = await db.count_episodes()
    print(f"Stato iniziale - Anime: {initial_anime}, Episodi: {initial_episodes}")
    
    print("Avvio aggiornamento incrementale (scraping di /updated)...")
    loop = asyncio.get_running_loop()
    await asyncio.to_thread(scraper.scrape_latest_updates, db, loop=loop)
    
    final_anime = await db.count()
    final_episodes = await db.count_episodes()
    print(f"Aggiornamento completato!")
    print(f"Stato finale - Anime: {final_anime} (+{final_anime - initial_anime}), Episodi: {final_episodes} (+{final_episodes - initial_episodes})")

if __name__ == "__main__":
    asyncio.run(main())
