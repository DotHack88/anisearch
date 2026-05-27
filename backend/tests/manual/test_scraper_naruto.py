import asyncio
import os
import sys

# Set working directory to project root
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from backend.scraper import AnimeWorldScraper

async def main():

    scraper = AnimeWorldScraper()
    detail = scraper.get_anime_detail("https://www.animeworld.ac/play/boruto-naruto-next-generations.lYBFQ")
    print(f"Desc: {detail.get('description', '')[:50]}")
    print(f"Episodes count: {len(detail.get('episodes', []))}")
    if detail.get('episodes'):
        print(f"First EP: {detail['episodes'][0]}")

if __name__ == "__main__":
    asyncio.run(main())
