#!/usr/bin/env python3
"""AnimeEpisode Monitor - Checks episode counts and sends alerts."""
import os
import sys
import json
import time
import asyncio
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from backend.scraper import AnimeWorldScraper
    from backend.database import engine, Anime
    from sqlmodel.ext.asyncio.session import AsyncSession
    from sqlmodel import select
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)


class EpisodeMonitor:
    def __init__(self, alert_threshold=5):
        self.scraper = AnimeWorldScraper()
        self.alert_threshold = alert_threshold
        self.discord_webhook = os.getenv("ALERT_WEBHOOK")
        self.state_file = Path(__file__).parent / "monitor_state.json"
        self.previous_counts = self._load_state()
    
    def _load_state(self):
        if self.state_file.exists():
            try:
                return json.loads(self.state_file.read_text())
            except:
                return {}
        return {}
    
    def _save_state(self, counts):
        self.state_file.write_text(json.dumps(counts, indent=2))
    
    async def check_anime(self, anime_id, anime_title):
        """Check episodes for one anime."""
        try:
            async with AsyncSession(engine) as session:
                result = await session.exec(select(Anime).where(Anime.id == anime_id))
                anime = result.one_or_none()
            
            if not anime:
                return {"id": anime_id, "title": anime_title, "status": "not_in_db"}
            
            detail = self.scraper.get_anime_detail(anime.url)
            eps = detail.get("episodes", [])
            count = len(eps)
            
            prev = self.previous_counts.get(anime_id)
            changed = "CHANGED" if prev is not None and prev != count else ""
            
            return {
                "id": anime_id,
                "title": anime_title,
                "episode_count": count,
                "previous_count": prev,
                "status": "ok" if count >= self.alert_threshold else "missing",
                "changed": changed,
            }
        except Exception as e:
            return {"id": anime_id, "title": anime_title, "error": str(e)[:50]}
    
    async def run_check(self):
        """Run full check and return results."""
        print(f"[{datetime.now()}] Starting episode check...")
        print(f"Using domain: {self.scraper.BASE_URL}")
        
        try:
            async with AsyncSession(engine) as session:
                result = await session.exec(select(Anime))
                animes = result.all()
        except Exception as e:
            print(f"DB Error: {e}")
            return []
        
        results = []
        missing = []
        
        for i, anime in enumerate(animes):
            r = await self.check_anime(anime.id, anime.title)
            results.append(r)
            if r["status"] == "missing":
                missing.append(r)
            
            if (i + 1) % 500 == 0:
                print(f"  Progress: {i+1}/{len(animes)}, Missing: {len(missing)}")
            time.sleep(0.05)  # Rate limiting
        
        self._save_state({r["id"]: r["episode_count"] for r in results})
        
        print(f"\nResults: {len(results)} checked, {len(missing)} with missing episodes")
        return results
    
    def send_alert(self, results):
        """Send Discord alert for missing episodes."""
        missing = [r for r in results if r["status"] == "missing"]
        if not missing or not self.discord_webhook:
            return
        
        msg = f"🚨 **AniSearch Alert**\n\n"
        msg += f"**{len(missing)} anime con episodi mancanti** (< {self.alert_threshold} ep)\n\n"
        
        for r in missing[:15]:
            change = f" ({r['previous_count']}→{r['episode_count']})" if r.get('changed') else ""
            title = r.get('title', r['id'])[:40]
            msg += f"- **{title}**: {r['episode_count']} ep{change}\n"
        
        if len(missing) > 15:
            msg += f"\n*...e altri {len(missing)-15}*".format(len(missing)-15)
        
        print(f"\n{'='*50}")
        print(msg)
        
        try:
            import requests
            requests.post(self.discord_webhook, json={"content": msg}, timeout=15)
            print("✅ Alert inviato a Discord")
        except Exception as e:
            print(f"❌ Errore invio Discord: {e}")


async def main():
    import asyncio
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--interval", type=int, default=3600)
    parser.add_argument("--threshold", type=int, default=5)
    args = parser.parse_args()
    
    monitor = EpisodeMonitor(alert_threshold=args.threshold)
    
    while True:
        results = await monitor.run_check()
        monitor.send_alert(results)
        
        if args.once:
            break
        
        print(f"\nNext check in {args.interval}s...")
        await asyncio.sleep(args.interval)


if __name__ == "__main__":
    asyncio.run(main())
