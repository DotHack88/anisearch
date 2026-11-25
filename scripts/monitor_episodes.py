#!/usr/bin/env python3
"""
AnimeEpisode Monitor - Checks episode counts and sends alerts if missing.
Usage: python monitor_episodes.py [--once|--daemon]
"""
import os
import sys
import json
import time
import asyncio
from pathlib import Path
from datetime import datetime

# Add parent dir to path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from backend.scraper import AnimeWorldScraper
    from backend.database import AnimeDatabase, engine, Anime
    from sqlmodel.ext.asyncio.session import AsyncSession
    from sqlmodel import select
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)


class EpisodeMonitor:
    def __init__(self, alert_threshold=5):
        self.scraper = AnimeWorldScraper()
        self.db = AnimeDatabase()
        self.alert_threshold = alert_threshold  # Alert if < this many episodes

        # Load config
        self.discord_webhook = os.getenv("ALERT_WEBHOOK")
        self.telegram_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.telegram_chat_id = os.getenv("TELEGRAM_CHAT_ID")

        # Check previous state
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

    async def check_anime(self, anime_id: str, anime_title: str) -> dict:
        """Check episode count for one anime."""
        # Get anime detail
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Anime).where(Anime.id == anime_id))
            anime = result.one_or_none()

        if not anime:
            return {"id": anime_id, "title": anime_title, "status": "not_in_db"}

        # Scrape episodes
        detail = self.scraper.get_anime_detail(anime.url)
        eps = detail.get("episodes", [])
        count = len(eps)

        # Check previous count
        prev_count = self.previous_counts.get(anime_id, None)
        changed = "CHANGED" if prev_count is not None and prev_count != count else ""

        return {
            "id": anime_id,
            "title": anime_title,
            "episode_count": count,
            "previous_count": prev_count,
            "status": "ok" if count >= self.alert_threshold else "missing",
            "changed": changed,
            "timestamp": datetime.now().isoformat()
        }

    async def run_check(self) -> list[dict]:
        """Check all animes and return results."""
        print(f"[{datetime.now()}] Starting episode check...")
        print(f"Using domain: {self.scraper.BASE_URL}")

        # Get all animes from DB
        async with AsyncSession(engine) as session:
            result = await session.exec(select(Anime))
            animes = result.all()

        results = []
        for i, anime in enumerate(animes):
            result = await self.check_anime(anime.id, anime.title)
            results.append(result)

            # Progress
            if (i + 1) % 100 == 0:
                missing = sum(1 for r in results if r["status"] == "missing")
                print(f"  Checked {i+1}/{len(animes)} animes, {missing} with missing episodes")

            # Rate limiting
            time.sleep(0.1)

        # Save state
        new_counts = {r["id"]: r["episode_count"] for r in results}
        self._save_state(new_counts)

        # Report
        missing = [r for r in results if r["status"] == "missing"]
        print(f"\nResults: {len(results)} total, {len(missing)} with <{self.alert_threshold} episodes")

        return results

    def send_alert(self, results: list[dict]):
        """Send alert via configured channels."""
        missing = [r for r in results if r["status"] == "missing"]
        if not missing:
            return

        message = f"🚨 AnimeWatch Alert\n\n"
        message += f"Found {len(missing)} animes with missing/few episodes:\n\n"

        for r in missing[:10]:  # Show first 10
            msg = f"- {r['title']} ({r['id']}): {r['episode_count']} eps"
            if r.get("previous_count"):
                msg += f" (was {r['previous_count']})"
            message += msg + "\n"

        if len(missing) > 10:
            message += f"\n... and {len(missing) - 10} more"

        print(f"\n{'='*50}")
        print(message)

        # Send to Discord
        if self.discord_webhook:
            self._send_discord(message)

        # Send to Telegram
        if self.telegram_token and self.telegram_chat_id:
            self._send_telegram(message)

    def _send_discord(self, message: str):
        import requests
        try:
            requests.post(self.discord_webhook, json={"content": message}, timeout=10)
            print("[Discord] Alert sent")
        except Exception as e:
            print(f"[Discord] Error: {e}")

    def _send_telegram(self, message: str):
        import requests
        try:
            url = f"https://api.telegram.org/bot{self.telegram_token}/sendMessage"
            requests.post(url, json={
                "chat_id": self.telegram_chat_id,
                "text": message,
                "parse_mode": "Markdown"
            }, timeout=10)
            print("[Telegram] Alert sent")
        except Exception as e:
            print(f"[Telegram] Error: {e}")


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Monitor anime episodes")
    parser.add_argument("--once", action="store_true", help="Run once and exit")
    parser.add_argument("--interval", type=int, default=3600, help="Check interval in seconds (default: 1h)")
    parser.add_argument("--threshold", type=int, default=5, help="Minimum episodes before alert")
    args = parser.parse_args()

    monitor = EpisodeMonitor(alert_threshold=args.threshold)

    while True:
        results = await monitor.run_check()
        monitor.send_alert(results)

        if args.once:
            break

        print(f"\nNext check in {args.interval} seconds...")
        await asyncio.sleep(args.interval)


if __name__ == "__main__":
    asyncio.run(main())
