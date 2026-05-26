"""
AniSearch — Database builder script.

Usage:
    python build_db.py                  # Full rebuild (drops and re-scrapes everything)
    python build_db.py --incremental    # Only add new/updated anime (skip existing IDs)
    python build_db.py --dry-run        # Show what would be scraped without writing to DB
"""

import argparse
import logging
from backend.scraper import AnimeWorldScraper
from backend.database import AnimeDatabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Build or update the AniSearch database.")
    parser.add_argument(
        "--incremental",
        action="store_true",
        help="Only scrape and insert anime that are not already in the DB.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Scrape data but do not write anything to the database.",
    )
    args = parser.parse_args()

    db = AnimeDatabase()
    scraper = AnimeWorldScraper()

    if args.dry_run:
        print("[DRY RUN] Avvio scraping completo — nessun dato verrà salvato nel database.")

        class DryRunDB:
            """Fake DB that counts but never writes."""
            def __init__(self):
                self._count = 0
            def add_batch(self, items):
                self._count += len(items)
                for item in items:
                    print(f"  [DRY] {item.get('id', '?'):>12}  {item.get('title', '?')}")
            def count(self):
                return self._count

        fake_db = DryRunDB()
        scraper.build_full_index(fake_db)
        print(f"\n[DRY RUN] Completato. {fake_db.count()} anime sarebbero stati inseriti.")
        return

    if args.incremental:
        existing_count = db.count()
        print(f"Modalità incrementale — {existing_count} anime già nel DB.")
        print("Avvio scraping incrementale (aggiungerà solo anime nuovi)...")
        scraper.build_full_index(db)  # add_batch uses INSERT OR REPLACE, so it's safe
        new_count = db.count()
        added = new_count - existing_count
        print(f"Scraping incrementale completato! +{added} nuovi anime (totale: {new_count})")
    else:
        print("Avvio rebuild completo del catalogo. Questo richiederà alcuni minuti...")
        db.clear()
        scraper.build_full_index(db)
        print(f"Scraping completato! Totale anime nel DB: {db.count()}")


if __name__ == "__main__":
    main()
