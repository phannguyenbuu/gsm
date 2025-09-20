import serial

def send_at_command(port='COM3', baudrate=9600, at_command='AT\r\n', timeout=2):
    """
    Gửi lệnh AT tới cổng COM, đọc và trả về phản hồi từ thiết bị.
    
    Args:
      port (str): Tên cổng COM, ví dụ 'COM3'
      baudrate (int): Tốc độ truyền baud rate, ví dụ 9600
      at_command (str): Lệnh AT kèm \r\n ở cuối, ví dụ 'AT\r\n'
      timeout (int/float): Thời gian chờ phản hồi (giây), mặc định 2 giây
    
    Returns:
      str: Chuỗi phản hồi nhận được từ thiết bị hoặc thông báo lỗi
    """
    try:
        with serial.Serial(port, baudrate, timeout=timeout) as ser:
            # Xóa buffer cũ trước khi gửi
            ser.reset_input_buffer()
            ser.reset_output_buffer()

            # Gửi lệnh AT
            ser.write(at_command.encode('utf-8'))

            # Đọc tất cả dữ liệu trả về trong khoảng timeout
            response_lines = []
            while True:
                line = ser.readline()
                if not line:
                    break  # Hết dữ liệu hoặc timeout
                response_lines.append(line.decode('utf-8', errors='ignore').strip())
            
            # Kết hợp các dòng thành chuỗi
            response = '\n'.join(response_lines)
            
            if not response:
                return "Không nhận được phản hồi từ thiết bị."
            
            return response

    except serial.SerialException as e:
        return f"Lỗi khi mở cổng COM hoặc gửi lệnh: {e}"


import time

def send_sms_quecltel_com(port, phone_number, message):
    # port = 'COM40'
    baudrate = 9600
    at_command_mode = 'AT+CMGF=1\r'  # Chọn chế độ text mode
    at_command_send = f'AT+CMGS="{phone_number}"\r'

    try:
        with serial.Serial(port, baudrate, timeout=5) as ser:
            ser.write(at_command_mode.encode())
            time.sleep(5)  # đợi modem trả lời OK
            response = ser.read_all().decode(errors='ignore')
            print("Response after setting text mode:", response.strip())

            ser.write(at_command_send.encode())
            time.sleep(5)  # đợi dấu >
            response = ser.read_all().decode(errors='ignore')
            print("Response after CMGS command:", response.strip())

            # Gửi nội dung tin nhắn kèm Ctrl+Z (0x1A) để kết thúc
            ser.write(message.encode() + b'\x1A')
            time.sleep(10)  # chờ modem phản hồi
            response = ser.read_all().decode(errors='ignore')
            print("Response after sending message:", response.strip())

            if "OK" in response:
                return "Successful send SMS"
            else:
                return f"Response SMS: {response.strip()}"

    except serial.SerialException as e:
        return f"ERROR in open COM: {e}"

import serial

received_lines = []  # Dùng biến toàn cục lưu dòng dữ liệu nhận được

def listen_com(port, baudrate=9600):
    # port = 'COM55'
    try:
        with serial.Serial(port, baudrate, timeout=1) as ser:
            print(f"Đã mở thành công cổng {port} với baudrate {baudrate}")
            while True:
                line = ser.readline()
                print(line)

                if line:
                    text = line.decode('utf-8', errors='ignore').strip()
                    print(f"Received: {text}")
                    # Giữ tối đa 50 dòng gần nhất, tránh bộ nhớ tăng mãi
                    received_lines.append(text)
                    
                    if len(received_lines) > 50:
                        received_lines.pop(0)

                    return received_lines
                else:
                    # Tạm nghỉ 0.1s cho CPU đỡ tải
                    time.sleep(0.1)
                
    except serial.SerialException as e:
        print(f"Error opening {port}: {e}")

# Ví dụ gọi hàm
if __name__ == '__main__':
    port_name = 'COM39'
    baud = 9600
    at_cmd = 'AT\r\n'
    