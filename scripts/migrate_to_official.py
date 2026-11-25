"""
Script di migrazione: converte tutti gli URL nel database da .or.at a .ac (dominio ufficiale)
Converte anche il formato: /watch/slug-ID → /play/slug.ID
"""

import asyncio
import re
import logging
from sqlmodel import select
from backend.database import engine, Anime, Episode, Manga, Chapter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DOMAIN_OLD = "animeworld.or.at"
DOMAIN_NEW = "www.animeworld.ac"


def migrate_url(url: str) -> str | None:
    """Converte un URL dal formato .or.at al formato .ac."""
    if not url or DOMAIN_OLD not in url:
        return None

    # 1. /watch/{slug}-{id}/? → /play/{slug}.{id}
    # slug contains letters/digits/hyphens/dots/underscores; id is alphanumeric
    m = re.search(r'/watch/([^/]+)-(\w+)(?:/\S*)?/?$', url)
    if m:
        slug_part = m.group(1)
        anime_id = m.group(2)
        # slug_part may contain hyphens separating words; keep as-is before the final -id
        new_path = f"/play/{slug_part}.{anime_id}"
        return f"https://{DOMAIN_NEW}{new_path}"

    # 2. /anime/{slug}-{id} → /play/{slug}.{id}
    m = re.search(r'/anime/([^/]+)-(\w+)', url)
    if m:
        slug_part = m.group(1)
        anime_id = m.group(2)
        return f"https://{DOMAIN_NEW}/play/{slug_part}.{anime_id}"

    # 3. Already in .ac format — just update domain www prefix
    new_url = url.replace(DOMAIN_OLD, DOMAIN_NEW)

    # 4. Normalize remaining /watch/slug-id patterns
    new_url = re.sub(r'/watch/([^/]+)-(\w+)/', r'/play/\1.\2/', new_url)

    # Fix any double www prefix
    new_url = new_url.replace('https://www.www.', 'https://www.')

    return new_url


async def migrate_anime_urls(db_session):
    """Aggiorna gli URL degli anime."""
    result = await db_session.exec(select(Anime))
    animes = result.all()

    updated = 0
    for anime in animes:
        old_url = anime.url
        new_url = migrate_url(old_url)
        if new_url and new_url != old_url:
            anime.url = new_url
            updated += 1
            logger.info(f"Anime {anime.id}: {old_url[:70]}… → {new_url[:70]}…")

    await db_session.commit()
    logger.info(f"[Anime] Completato: {updated}/{len(animes)} aggiornati")
    return updated


async def migrate_episode_urls(db_session):
    """Aggiorna gli URL degli episodi."""
    result = await db_session.exec(select(Episode))
    episodes = result.all()

    updated = 0
    for ep in episodes:
        old_url = ep.url or ""
        if not old_url or DOMAIN_OLD not in old_url:
            continue

        new_url = migrate_url(old_url)
        if new_url and new_url != old_url:
            ep.url = new_url
            updated += 1
            logger.info(f"Episodio {ep.id}: {old_url[:70]}… → {new_url[:70]}…")

    await db_session.commit()
    logger.info(f"[Episode] Completato: {updated}/{len(episodes)} aggiornati")
    return updated


async def migrate_manga_urls(db_session):
    """Aggiorna gli URL dei manga."""
    result = await db_session.exec(select(Manga))
    mangas = result.all()

    updated = 0
    for manga in mangas:
        old_url = manga.url
        if not old_url or DOMAIN_OLD not in old_url:
            continue
        new_url = old_url.replace(DOMAIN_OLD, DOMAIN_NEW)
        if new_url != old_url:
            manga.url = new_url
            updated += 1
            logger.info(f"Manga {manga.id}: {old_url[:70]}… → {new_url[:70]}…")

    await db_session.commit()
    logger.info(f"[Manga] Completato: {updated}/{len(mangas)} aggiornati")
    return updated


async def migrate_chapter_urls(db_session):
    """Aggiorna gli URL dei capitoli."""
    result = await db_session.exec(select(Chapter))
    chapters = result.all()

    updated = 0
    for ch in chapters:
        old_url = ch.url or ""
        if not old_url or DOMAIN_OLD not in old_url:
            continue
        new_url = old_url.replace(DOMAIN_OLD, DOMAIN_NEW)
        if new_url != old_url:
            ch.url = new_url
            updated += 1
            logger.info(f"Capitolo {ch.id}: {old_url[:70]}… → {new_url[:70]}…")

    await db_session.commit()
    logger.info(f"[Chapter] Completato: {updated}/{len(chapters)} aggiornati")
    return updated


async def main():
    async with engine.begin() as conn:
        from sqlmodel.ext.asyncio.session import AsyncSession
        async with AsyncSession(conn) as session:
            logger.info("=" * 60)
            logger.info("INIZIO MIGRAZIONE URL DA .or.at A .ac (UFFICIALE)")
            logger.info("=" * 60)

            n_anime = await migrate_anime_urls(session)
            n_ep = await migrate_episode_urls(session)
            n_manga = await migrate_manga_urls(session)
            n_ch = await migrate_chapter_urls(session)

            logger.info("=" * 60)
            logger.info(f"RIEPILOGO:")
            logger.info(f"  Anime:     {n_anime} aggiornati")
            logger.info(f"  Episodi:   {n_ep} aggiornati")
            logger.info(f"  Manga:     {n_manga} aggiornati")
            logger.info(f"  Capitoli:  {n_ch} aggiornati")
            logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
