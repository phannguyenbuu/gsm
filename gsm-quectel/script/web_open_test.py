from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.chrome.webdriver import WebDriver as ChromeDriver
from selenium.webdriver.chrome.options import Options
from selenium import webdriver
from selenium.webdriver.remote.webdriver import WebDriver as RemoteWebDriver

def create_driver():
    options = Options()
    driver = ChromeDriver(options=options)
    print("Session ID:", driver.session_id)
    print("Command executor URL:", driver.command_executor._url)
    return driver

def attach_to_session(executor_url, session_id):
    # Thay đổi hàm execute để không tạo session mới
    original_execute = RemoteWebDriver.execute

    def new_command_execute(self, command, params=None):
        if command == "newSession":
            # Trả về session id cũ mà không tạo mới
            return {'success': 0, 'value': None, 'sessionId': session_id}
        return original_execute(self, command, params)

    RemoteWebDriver.execute = new_command_execute

    opts = webdriver.ChromeOptions()
    driver = webdriver.Remote(command_executor=executor_url, options=opts)
    driver.session_id = session_id

    RemoteWebDriver.execute = original_execute
    return driver

from urllib.parse import urlparse

if __name__ == "__main__":
    # Bước 1: Khởi tạo driver lần đầu, mở trình duyệt, đăng nhập,... lưu session
    driver = create_driver()
    # Thực hiện việc logout login, thao tác... rồi lấy:
    # session_id = driver.session_id
    # executor_url = driver.command_executor._url

    # Bước 2: Lần chạy lại, dùng attach để tái sử dụng session
    saved_session_id = "4b302f88204295699031a697548dc99b"
    saved_executor_url = "http://localhost:38216"

    parsed = urlparse(saved_executor_url)
    # Lấy "host:port"
    debugger_address = f"{parsed.hostname}:{parsed.port}"

    options = Options()
    options.add_experimental_option("debuggerAddress", debugger_address)

    driver = webdriver.Chrome(options=options)

    # Bây giờ driver liên kết tới Chrome đã mở và giữ nguyên session đã đăng nhập
    print(driver.current_url)

    driver.get("https://www.google.com")
    print(driver.title)
