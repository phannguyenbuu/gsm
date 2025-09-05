# 771270
# k2xSn9Iev7dDE76frPKUjHMluG2EHlHXxtOCOHeGriY
# DJ5v3gpIWeeaj5X-NuGa5SKJMHJlB0aOBlVd55CWFUw

import requests

ACCESS_KEY = "k2xSn9Iev7dDE76frPKUjHMluG2EHlHXxtOCOHeGriY"

def get_random_photo(query):
    url = "https://api.unsplash.com/photos/random"
    headers = {
        "Authorization": f"Client-ID {ACCESS_KEY}"
    }
    params = {
        "query": query,
        "orientation": "landscape"
    }
    response = requests.get(url, headers=headers, params=params)
    if response.status_code == 200:
        data = response.json()
        return {
            "id": data["id"],
            "description": data.get("description") or data.get("alt_description"),
            "url": data["urls"]["regular"],
            "download_link": data["links"]["download"],
            "author": data["user"]["name"],
            "author_profile": data["user"]["links"]["html"]
        }
    else:
        print(f"Error: {response.status_code} - {response.text}")
        return None



import eng_to_ipa as ipa
import json

# Hàm giả lập dịch, bạn có thể thay bằng API dịch thực tế
def translate_word(word):
    photo = get_random_photo(word)
    if photo:
        print(f"Photo ID: {photo['id']}")
        print(f"Description: {photo['description']}")
        print(f"URL: {photo['url']}")
        print(f"Download link: {photo['download_link']}")
        print(f"Author: {photo['author']} ({photo['author_profile']})")

    return photo['url'] + ";" + photo['download_link']

def main():
    # Đường dẫn file
    input_path = r'static\english_words.json'
    output_path = r'static\english_image.json'

    # Đọc file json (giả sử file chứa chuỗi các từ ngăn cách dấu phẩy)
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read().strip()

    # Tách từ theo dấu phẩy
    words = [w.strip() for w in content.split(',') if w.strip()]

    # Dịch từng từ và lưu kết quả
    results = []
    for i,word in enumerate(words):
        vn = translate_word(word)
        print(i, f"{word}={vn}")
        results.append(f"{word}={vn}")

    # Ghi kết quả ra file, mỗi dòng một cặp en=vn
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(results))

    print(f"Đã xử lý {len(words)} từ và ghi ra {output_path}")

if __name__ == "__main__":
    main()

