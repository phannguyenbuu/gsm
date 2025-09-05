import threading
import serial
import time
from pdu import parse_pdu
import binascii
from pdu import create_pdu_message

def decode_ucs2(hex_str):
    try:
        # Giải mã UCS2 (UTF-16 Big Endian)
        bytes_data = bytes.fromhex(hex_str)
        return bytes_data.decode('utf-16-be')
    except Exception as e:
        return None

def decode_pdu(pdu_str):
    try:
        # Giải mã PDU dùng thư viện gsmmodem
        sms = parse_pdu(pdu_str)
        return sms
    except Exception as e:
        return None

def decode_sms(input_str):
    ucs2_result = decode_ucs2(input_str)
    pdu_result = decode_pdu(input_str)

    return {
        "input": input_str,
        "ucs2": ucs2_result,
        "pdu": pdu_result
    }

def is_pdu_format(data):
    return data.strip().startswith("0791")  # hoặc kiểm tra độ dài, chỉ số PDU khác nữa

def decode_ucs2(hex_string):
    try:
        return bytes.fromhex(hex_string).decode("utf-16-be")
    except:
        return "[Lỗi giải mã UCS2]"
def is_pdu_format(text):
    # Đơn giản: nếu bắt đầu bằng 0791 hoặc đủ dài và chỉ chứa hex
    return text.startswith("0791") or (len(text) > 20 and all(c in '0123456789ABCDEFabcdef' for c in text))

def decode_ucs2(hex_string):
    try:
        return bytes.fromhex(hex_string).decode('utf-16-be')
    except Exception as e:
        return f"[Lỗi UCS2: {e}]"

def listen_com():
    port = 'COM91'
    baudrate = 115200
    try:
        with serial.Serial(port, baudrate, timeout=1) as ser:
            print(f"Listening for incoming SMS on {port}...")

            while True:
                line = ser.readline()
                if line:
                    text = line.decode('utf-8', errors='ignore').strip()

                    if text:
                        if '+CMT' in text:
                            print(f"📩 Header SMS: {text}")
                        else:
                            print("Receiv:e", decode_sms(text))
                else:
                    time.sleep(0.1)

    except Exception as e:
        print(f"❌ Lỗi mở {port}: {e}")

def get_phone_number(ser):
    try:
        ser.write(b'AT+CNUM\r')
        time.sleep(0.2)
        response = ser.read_all().decode(errors='ignore')
        # Lọc kết quả từ dòng trả về chứa +CNUM
        for line in response.splitlines():
            if "+CNUM" in line:
                parts = line.split(",")
                if len(parts) >= 2:
                    return parts[1].strip().replace('"', '')
        return "Unknown"
    except Exception as e:
        return f"Error: {e}"

def set_charset(ser, charset="UCS2"):
    # ser: đối tượng Serial đã mở
    cmd = f'AT+CSCS="{charset}"\r'.encode()
    ser.write(cmd)
    time.sleep(1)
    response = ser.read_all().decode(errors='ignore')
    print(f"Response AT+CSCS={charset}:", response)
    return response


def send_sms(port, baudrate, phone_number, message):
    """
    Gửi SMS qua modem với chế độ PDU mode (CMGF=0)
    - port: cổng COM gửi SMS
    - baudrate: tốc độ baud
    - phone_number: số nhận (dạng +84901234567 hoặc 0809...)
    - pdu_message: nội dung tin nhắn ở dạng PDU (chuỗi hex, không có khoảng trắng)
    
    Lưu ý: pdu_message phải được tạo ra chính xác theo chuẩn PDU (bạn phải xử lý mã hóa tin trước khi gọi).
    """

    try:
        with serial.Serial(port, baudrate, timeout=5) as ser:
            pdu_string, pdu_length = create_pdu_message(port,phone_number,message)
            # Gửi lệnh kiểm tra modem có phản hồi
            ser.write(b'AT\r')
            time.sleep(0.1)
            # res = ser.read_all().decode(errors='ignore')
            # print("Response AT:", res.strip())

            cmd = f'AT+CSCS="UCS2"\r'.encode()
            ser.write(cmd)
            time.sleep(0.1)
                        

            # Bật chế độ PDU mode
            ser.write(b'AT+CMGF=0\r')
            time.sleep(0.1)
            
            cmd = f'AT+CMGS={pdu_length}\r'
            ser.write(cmd.encode())
            time.sleep(0.1)
            response = ser.read_all().decode(errors='ignore')
            print("Response AT+CMGS:", response.strip())

            if '>' in response:
                # Gửi nội dung PDU + Ctrl+Z để gửi tin nhắn
                ser.write(pdu_string.encode() + b'\x1A')
                print(f"Đã gửi nội dung {message}, đợi phản hồi...")
                time.sleep(3)
                resp = ser.read_all().decode(errors='ignore')
                print("Phản hồi sau khi gửi SMS:", resp.strip())
                return resp
            else:
                print("Modem không trả về dấu > để nhập nội dung SMS")
                return None

    except Exception as e:
        print(f"Lỗi khi gửi SMS: {e}")

if __name__ == "__main__":
    # Bật thread nhận tin nhắn
    t_listen = threading.Thread(target=listen_com, daemon=True)
    t_listen.start()

    print("Main thread vẫn đang chạy.")
    while True:
        time.sleep(1) 

    # # Gửi SMS với nội dung dạng PDU (bạn cần tạo phù hợp nội dung và số điện thoại)
    # send_sms('COM23', 115200, '+818087318039', "Hello World!")
