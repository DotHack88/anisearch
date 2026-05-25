from backend.scraper import AnimeWorldScraper
from backend.database import AnimeDatabase
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

def main():
    db = AnimeDatabase()
    # Pulisco il database vecchio da 660 elementi
    db.clear()
    
    scraper = AnimeWorldScraper()
    print("Avvio scraping completo di tutto il catalogo. Questo richiederà alcuni minuti...")
    scraper.build_full_index(db)
    
    print(f"Scraping completato! Totale anime nel DB: {db.count()}")

if __name__ == "__main__":
    main()
