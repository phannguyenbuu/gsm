import wikipedia
from wikipedia.exceptions import DisambiguationError

import warnings
from bs4 import GuessedAtParserWarning
import wikipedia
from wikipedia.exceptions import DisambiguationError, PageError

# Tắt cảnh báo parser của BeautifulSoup
warnings.filterwarnings("ignore", category=GuessedAtParserWarning)
import wikipedia
from wikipedia.exceptions import DisambiguationError, PageError

def translate_word(word):
    try:
        summary = wikipedia.summary(word, sentences=10)
        return summary
    except DisambiguationError as e:
        # Lấy lựa chọn đầu tiên trong danh sách các lựa chọn
        first_choice = e.options[0]
        try:
            summary = wikipedia.summary(first_choice, sentences=10)
            return f"Từ khóa '{word}' có nhiều nghĩa. Lấy kết quả cho lựa chọn đầu tiên: '{first_choice}'\n\n{summary}"
        except Exception as ex:
            return f"Không thể lấy tóm tắt cho lựa chọn '{first_choice}': {ex}"
    except PageError:
        return f"Không tìm thấy trang Wikipedia nào cho từ khóa '{word}'. Vui lòng kiểm tra lại."
    except Exception as e:
        return f"Đã xảy ra lỗi: {str(e)}"

def main():
    input_path = r'static\english_words.json'
    output_path = r'static\english_comment.json'

    # Đọc file json (giả sử file chứa chuỗi các từ ngăn cách dấu phẩy)
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read().strip()

    words = [w.strip() for w in content.split(',') if w.strip()]

    # Mở file ghi kết quả ở chế độ ghi đè (write)
    with open(output_path, 'a', encoding='utf-8') as f:
        for i, word in enumerate(words):
            try:
                vn = translate_word(word)
                print(i, f"{word}={vn}")
                # Ghi ngay kết quả ra file, mỗi dòng một cặp en=vn
                f.write(f"{word}={vn}\n")
                f.flush()  # Đảm bảo ghi ngay xuống đĩa
            except Exception as e:
                print(f"Lỗi khi xử lý từ '{word}': {e}")
                # Ghi lỗi ra file để dễ theo dõi
                f.write(f"{word}=Lỗi: {e}\n")
                f.flush()

    print(f"Đã xử lý {len(words)} từ và ghi ra {output_path}")

if __name__ == "__main__":
    main()
