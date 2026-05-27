from bs4 import BeautifulSoup

with open("aw_home.html", "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f.read(), "html.parser")

schedule_widget = soup.select_one('.widget.schedule')
if schedule_widget:
    print(schedule_widget.prettify())
