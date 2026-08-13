import bs4, json, re, sys
import io
if isinstance(sys.stdout, io.TextIOWrapper):
    sys.stdout.reconfigure(encoding='utf-8')

soup = bs4.BeautifulSoup(open('chapter.html', encoding='utf-8').read(), 'html.parser')
scripts = [s.string for s in soup.select('script') if s.string and '"pages"' in s.string]

raw = scripts[0]
m = re.search(r'\({"o":{.*', raw)
if not m:
    print('Could not find JSON data in script', file=sys.stderr)
    sys.exit(1)
text = m.group(0).strip('()')
data = json.loads(text)

ch = data['o']['w'][0][2]['chapter']
manga = data['o']['w'][0][2]['manga']
vol = ch['volume']

print('chapter id:', ch['_id'])
print('chapter slugFolder:', ch.get('slugFolder'))
print('chapter name:', ch.get('name'))
print('chapter pageLinkId:', ch.get('pageLinkId'))
print()
print('volume id:', vol['_id'])
print('volume slugFolder:', vol.get('slugFolder'))
print()
print('manga id:', manga.get('_id'))
print('manga slug:', manga.get('slug'))
print('manga linkId:', manga.get('linkId'))
print()
# Build CDN URL
cdn_base = "https://cdn.mangaworld.mx"
chapter_folder = ch.get('slugFolder', '')
volume_folder = vol.get('slugFolder', '')
manga_slug = manga.get('slug', '')
manga_id = manga.get('_id', '')
vol_id = vol['_id']
ch_id = ch['_id']

# Pattern found from HTML: /chapters/naruto-{manga_id}/{vol.slugFolder}-{vol_id}/{ch.slugFolder}-{ch_id}/{page}
print("\nFirst page URL:")
print(f"{cdn_base}/chapters/{manga_slug}-{manga_id}/{volume_folder}-{vol_id}/{chapter_folder}-{ch_id}/1.jpg")
