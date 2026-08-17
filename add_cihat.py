import urllib.request
import json

API_KEY = "AIzaSyCruRe16p-dp4dMxes3HFT_vXVaHUE5kVk"
DB_URL = "https://calismatakvimi-7e26b-default-rtdb.europe-west1.firebasedatabase.app"

# 1. Create Auth User
auth_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"
auth_data = json.dumps({
    "email": "cihat.erol@takvim2026.app",
    "password": "password123",
    "returnSecureToken": True
}).encode('utf-8')

req = urllib.request.Request(auth_url, data=auth_data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as response:
        res = json.loads(response.read().decode('utf-8'))
        uid = res['localId']
        print(f"Auth created. UID: {uid}")
        
        # 2. Add to Database
        db_data = json.dumps({
            "ad": "Cihat",
            "soyad": "Erol",
            "email": "cihat.erol@takvim2026.app",
            "rol": "admin",
            "rolIsim": "Admin",
            "uid": uid
        }).encode('utf-8')
        
        db_req = urllib.request.Request(f"{DB_URL}/cihat_takvim_2026/users/{uid}.json", data=db_data, headers={'Content-Type': 'application/json'}, method='PUT')
        with urllib.request.urlopen(db_req) as db_resp:
            print("Database updated:", db_resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print(f"Error: {e.code}")
    print(e.read().decode('utf-8'))

