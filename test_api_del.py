import asyncio
import os
import sys
import requests

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def main():
    s = requests.Session()
    # 0. Insert
    s.post("http://localhost:8000/watch/boruto-naruto-next-generations.lYBFQ?episode_id=mMTd5")
    
    # 1. Get recent to get the cookie
    res = s.get("http://localhost:8000/watch")
    print("Recent before:", res.json())
    
    # 2. Delete the first one
    items = res.json()
    if items:
        item = items[0]
        del_res = s.delete(f"http://localhost:8000/watch/{item['anime_id']}", params={"episode_id": item['episode_id']})
        print("Delete res:", del_res.status_code, del_res.text)
        
        # 3. Get recent again
        res2 = s.get("http://localhost:8000/watch")
        print("Recent after:", res2.json())

if __name__ == "__main__":
    main()
