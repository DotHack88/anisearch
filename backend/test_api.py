import requests

url = "https://www.animeworld.ac/api/search/v1?keyword=dragon"
headers = {"User-Agent": "Mozilla/5.0"}
resp = requests.get(url, headers=headers)
print(resp.status_code)
print(resp.text[:500])

url2 = "https://www.animeworld.ac/api/search/v2?keyword=dragon"
resp2 = requests.get(url2, headers=headers)
print(resp2.status_code)
print(resp2.text[:500])
