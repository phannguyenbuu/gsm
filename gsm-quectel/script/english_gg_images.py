from selenium import webdriver
from selenium.webdriver.common.by import By
import time

def get_preview_images(max_images=5):
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")  # Chạy ẩn
    driver = webdriver.Chrome(options=options)

    
    output_path = r'static/more_infor_image.json'


    words = ["personality","academic","psychological","interests","career","support","iq","eq","sports"]

    for idx, keyword in enumerate(words):
        url = f"https://unsplash.com/s/photos/{keyword}"
        driver.get(url)

        for _ in range(3):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)

        images = driver.find_elements(By.CSS_SELECTOR, "img.czQTa")

        urls = []
        for img in images[:max_images]:
            srcset = img.get_attribute("srcset")
            if srcset:
                parts = srcset.split(", ")
                largest = parts[-1]
                largest_url = largest.split(" ")[0]
                urls.append(largest_url)
            else:
                src = img.get_attribute("src")
                if src:
                    urls.append(src)

        content_line = f">>>{keyword}\n" + "\n".join(urls)
        print(idx, content_line)

        with open(output_path, 'a', encoding='utf-8') as f:
            f.write(content_line + "\n")  # Thêm xuống dòng

    driver.quit()

if __name__ == "__main__":
    get_preview_images()
