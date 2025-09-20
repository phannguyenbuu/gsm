import requests
from dotenv import load_dotenv

def api_send_simlist(VPS_ID, payload):
    
    url = f"http://{VPS_ID}:9090/api/simlist"

    
    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        print("Response status:", response.status_code)
        print("Response text:", response.text)

        if response.status_code == 200:
            print("Gửi dữ liệu thành công:", response.json())
        else:
            print("Lỗi khi gửi dữ liệu, status code:", response.status_code)
            print("Nội dung lỗi:", response.text)

    except Exception as e:
        print("Lỗi khi gửi yêu cầu:", e)