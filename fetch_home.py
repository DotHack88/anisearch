import requests
res = requests.get("https://www.animeworld.ac/")
with open("aw_home.html", "w", encoding="utf-8") as f:
    f.write(res.text)
