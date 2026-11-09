from pathlib import Path
from bs4 import BeautifulSoup
import pytest

def test_home_scraper_parsing():
    html_path = Path(__file__).resolve().parent.parent.parent / "aw_home.html"
    if not html_path.exists():
        pytest.skip("aw_home.html non trovato nella root del workspace")

    with open(html_path, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    latest_episodes = []
    hotnew_widget = soup.select_one('.widget.hotnew')
    assert hotnew_widget is not None, "Widget hotnew non trovato"

    all_content = hotnew_widget.select_one('.content[data-name="all"]')
    assert all_content is not None, "Content data-name=all non trovato"

    for item in all_content.select('.item'):
        a_poster = item.select_one('a.poster')
        a_name = item.select_one('a.name')
        if not a_poster or not a_name:
            continue

        href = a_poster.get('href', '')
        parts = href.split('/')
        if len(parts) >= 4:
            anime_slug_id = parts[2]
            anime_id = anime_slug_id.split('.')[-1]
            episode_id = parts[3]
        else:
            continue

        img = a_poster.select_one('img')
        image_url = img.get('src') or img.get('data-src') if img else ''
        title = a_name.text.strip()
        ep_div = item.select_one('.ep')
        ep_text = ep_div.text.strip() if ep_div else ''
        dub_div = item.select_one('.dub')
        has_dub = bool(dub_div)

        latest_episodes.append({
            'anime_id': anime_id,
            'episode_id': episode_id,
            'title': title,
            'image': image_url,
            'episode': ep_text,
            'has_dub': has_dub
        })

    assert len(latest_episodes) > 0, "Nessun episodio estratto dal widget"
    first = latest_episodes[0]
    assert first['anime_id'] != ''
    assert first['episode_id'] != ''
    assert first['title'] != ''

