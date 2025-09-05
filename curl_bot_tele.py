import requests

def send_bot_message(account_id, message, buttons=None):
    if buttons is None:
        buttons = []
    url = "http://japansim.net/api/bot/send-message"
    params = {
        "key": "231e9392-a3a0-4e50-8a84-7f68b4a93c52"
    }
    payload = {
        "accountId": account_id,
        "message": message,
        "buttons": buttons
    }
    headers = {
        "Content-Type": "application/json"
    }

    response = requests.post(url, params=params, json=payload, headers=headers)
    return response

# Thử gọi hàm kiểm tra
resp = send_bot_message("test-account", "Hello from Python test!", [{"label":"Button1","action":"doSomething"}])
print("Status code:", resp.status_code)
print("Response body:", resp.text)
