import requests

user_id = 581217544
# url = f"http://31.97.76.62:5005/users/tree/{user_id}"
url = f"http://31.97.76.62:5005/users"

response = requests.get(url)
if response.status_code == 200:
    user_data = response.json()
    # print(len(user_data))
    print("User data:", user_data[0]['webInfo'])
else:
    print(f"User not found or error: {response.status_code}")







# import requests

# account_id = 581217544
# url = f"http://localhost:5005/users/{account_id}"

# payload = {
#     "balance": 100
# }

# response = requests.put(url, json=payload)
# if response.status_code == 200:
#     print("Balance updated successfully")
#     print(response.json())
# else:
#     print(f"Failed to update balance: {response.status_code} - {response.text}")
