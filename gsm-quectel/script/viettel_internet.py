import time
from selenium.webdriver.common.by import By
# from cryptography.fernet import Fernet
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from bs4 import BeautifulSoup
from selenium import webdriver
import re

# def check_username():
#     try:
#         dl_info = WebDriverWait(driver, 4).until(EC.presence_of_element_located((By.CLASS_NAME, "dl-info-detail")))
#         first_div = dl_info.find_element(By.XPATH, "./div[1]")
#         span_ele = first_div.find_element(By.XPATH, ".//span")
#         username = span_ele.text

#         if dbfiles.get("username").strip() != username:
#             messagebox.showerror(title, "Vui lòng sử dụng đúng tài khoản đã đăng ký")
#             return False
#         else:
#             return True
#     except Exception as e:
#         messagebox.showerror(title, "Không tìm thấy tên tài khoản trên Viettel Pay Pro")
#         return False
    
def amount_by_cbil(cbil, element, lookup):
    try:
        amount = "Không tìm thấy mã thuê bao"
        payment_id = None      
        html_content = element.get_attribute('outerHTML')
        soup = BeautifulSoup(html_content, 'html.parser')
        pay_content_groups = soup.find_all("div", class_="row pay-content mb-3")

        # print('pay_content_groups', pay_content_groups)

        for group in pay_content_groups:
            p_tags = group.find_all("p")
            is_find = True
            # for p_tag in p_tags:
            #     if cbil in p_tag.text:
            #         is_find = True
            #         break

            if lookup and is_find:
                button_tag = group.find("button", {"id": re.compile(r'payMoneyForm:btnView\d*')})
                if button_tag:
                    payment_id = button_tag['id']

            if is_find:
                for p_tag in p_tags:
                    if "VND" in p_tag.text:
                        str_price = p_tag.text.split("VND")[0].strip()
                        amount = int(str_price.replace(",", ""))
                        if amount >= 5000:
                            return True, amount, payment_id
                        else:
                            return False, amount, payment_id

        return False, amount, payment_id
    except Exception as e:
        return False, "Lỗi thanh toán", None

def payment_cbil(driver, cbil):
    try:
        # Thực hiện thao tác thanh toán với cbil
        customer = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "payMoneyForm:contractCode")))
        customer.clear()
        customer.send_keys(cbil)
        time.sleep(0.5)
        payment_button = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "payMoneyForm:btnPay0")))
        # payment_button.click()
        time.sleep(1)
        WebDriverWait(driver, 16).until(
            EC.invisibility_of_element_located((By.ID, "payMoneyForm:j_idt6_modal")))
        element41 = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "payMoneyForm:j_idt41")))

        is_amount, amount, payment_id = amount_by_cbil(cbil, element41, True)
        print('Amount', is_amount, amount, payment_id)

        if payment_id:
            payment_btn1 = WebDriverWait(driver, 16).until(
                EC.presence_of_element_located((By.ID, payment_id)))
            payment_btn1.click()
            pin_id = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, "payMoneyForm:pinId")))
            pin_id.clear()
            pin_id.send_keys(pin)
            pay_btn = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, "payMoneyForm:btnPay")))
            pay_btn.click()
            try:
                cfm_modal = WebDriverWait(driver, 2).until(
                    EC.presence_of_element_located((By.ID, "payMoneyForm:dlgConfirm_modal")))
                driver.execute_script("arguments[0].style.zIndex = '-99';", cfm_modal)
            except:
                pass
            confirm_btn = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, "payMoneyForm:yesId0")))
            confirm_btn.click()

        # Sau khi chạy xong cbil, bạn có thể cập nhật trạng thái hoặc xem kết quả theo ý muốn

    except Exception as e:
        print('Error in:', cbil, e)
        # Nếu muốn dừng khi lỗi, có thể return hoặc raise exception
        # return hoặc raise e
        

def payment_internet(get_cbils_func, pin, stop_flag_func):
    driver = webdriver.Chrome()
    driver_link = "http://localhost:5500/core/script/demo_viettel.html"
    # "https://kpp.bankplus.vn"
    driver.get(driver_link)
    data = []

    try:
        while not stop_flag_func():
            cbils = get_cbils_func()  # Hàm bạn tự định nghĩa để lấy danh sách mới realtime
            if not cbils:
                time.sleep(3)  # Nếu không có cbils mới, đợi rồi tiếp tục
                continue

            for cbil in cbils:
                payment_cbil()

            time.sleep(5)  # Đợi sau mỗi vòng kiểm tra danh sách mới

    finally:
        driver.quit()

stop_flag = False

def stop_flag_func():
    return stop_flag

def get_cbils():
    try:
        with open('cbils.txt', 'r') as f:
            lines = f.readlines()
        cbils = [line.strip() for line in lines if line.strip()]
        return cbils
    except:
        return []



import subprocess
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import os
import sys

def start_chrome_with_remote_debugging(port=9222, user_data_dir=r"C:\ChromeSession"):
    # Đường dẫn đến chrome.exe, chỉnh sửa theo đúng máy bạn
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

    if not os.path.exists(chrome_path):
        chrome_path = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
        if not os.path.exists(chrome_path):
            print("Không tìm thấy Chrome. Vui lòng kiểm tra lại đường dẫn.")
            sys.exit(1)

    # Tạo thư mục user_data nếu chưa có
    if not os.path.exists(user_data_dir):
        os.makedirs(user_data_dir)

    # Lệnh mở Chrome với remote debugging port
    args = [
        chrome_path,
        f"--remote-debugging-port={port}",
        f'--user-data-dir={user_data_dir}',
        '--no-first-run',
        '--no-default-browser-check'
    ]

    # Khởi động Chrome dưới dạng tiến trình nền
    proc = subprocess.Popen(args)
    print(f"Đã mở Chrome với PID: {proc.pid}")
    return proc

def connect_selenium_to_chrome(port=9222):
    chrome_options = Options()
    chrome_options.add_experimental_option("debuggerAddress", f"127.0.0.1:{port}")
    driver = webdriver.Chrome(options=chrome_options)
    return driver

if __name__ == "__main__":
    # Bước 1: Mở Chrome với remote debugging
    chrome_process = start_chrome_with_remote_debugging()

    # Đợi Chrome khởi động kịp
    time.sleep(5)

    # Bước 2: Kết nối Selenium tới Chrome đó
    driver = connect_selenium_to_chrome()

    # Ví dụ thao tác
    driver.get("https://google.com")
    print("Title trang:", driver.title)

    # Ở đây bạn có thể gọi hàm payment_internet, thao tác với driver...

    # Giữ cửa sổ mở trong 10 giây để bạn quan sát
    time.sleep(10)

    # Đóng driver và thoát Chrome
    driver.quit()
    chrome_process.terminate()
    print("Kết thúc tiến trình Chrome và WebDriver")

       
    # cbils = ["CBIL001", "CBIL002"]
    # pin = "123456"
    # payment_results = payment_internet(cbils, pin, get_cbils)
    # print("All payments done:")
    # for res in payment_results:
    #     print(res)

    # driver = webdriver.Chrome()
    # driver_link = "https://kpp.bankplus.vn/pages/newInternetTelevisionViettel.jsf?serviceCode=000003&serviceType=DIGITAL"
    # # "https://kpp.bankplus.vn"
    # driver.get(driver_link)

    # cbil = 't074_gftth_hungcttgpntmvd'
    # payment_cbil(driver, cbil)
