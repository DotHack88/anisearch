from bs4 import BeautifulSoup

with open("aw_home.html", "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f.read(), "html.parser")

latest_episodes = []
hotnew_widget = soup.select_one('.widget.hotnew')
if hotnew_widget:
    # "Tutti" tab is the first .content
    all_content = hotnew_widget.select_one('.content[data-name="all"]')
    if all_content:
        for item in all_content.select('.item'):
            a_poster = item.select_one('a.poster')
            a_name = item.select_one('a.name')
            if not a_poster or not a_name: continue
            
            href = a_poster.get('href', '')
            # Extract anime_id and episode_id from href: /play/anime-name.anime_id/episode_id
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
            
            # Extract sub/dub tags
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

print(f"Found {len(latest_episodes)} latest episodes.")
print("First 3:", latest_episodes[:3])

# Calendar
calendar_episodes = []
schedule_widget = soup.select_one('#releases')
if schedule_widget:
    days = schedule_widget.select('.release-day')
    for day in days:
        day_name = day.get('id', '')
        for item in day.select('.item'):
            a_name = item.select_one('a.name')
            if not a_name: continue
            href = a_name.get('href', '')
            anime_id = href.split('.')[-1] if '.' in href else ''
            title = a_name.text.strip()
            time_div = item.select_one('.time')
            time_text = time_div.text.strip() if time_div else ''
            ep_div = item.select_one('.ep')
            ep_text = ep_div.text.strip() if ep_div else ''
            
            calendar_episodes.append({
                'day': day_name,
                'anime_id': anime_id,
                'title': title,
                'time': time_text,
                'episode': ep_text
            })

print(f"Found {len(calendar_episodes)} calendar episodes.")
if calendar_episodes:
    print("First 3:", calendar_episodes[:3])

