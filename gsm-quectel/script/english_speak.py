from gtts import gTTS
import playsound
import os
import json

# Hàm giả lập dịch, bạn có thể thay bằng API dịch thực tế
def translate_word(word):
    tts = gTTS(text=word, lang='en')
    filename = f"static/{word}.mp3"

    tts.save(filename)
    
    return filename

def main():
    # Đường dẫn file
    input_path = r'static\english_words.json'
    output_path = r'static\english_sound.json'

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
