import serial.tools.list_ports
import time
import socket
from threading import Thread
from queue import Queue
import json
from socket_client import send_ws_message

def send_at_command(ser, command, delay=0.2, read_all=True):
    ser.write(f"{command}\r".encode())
    time.sleep(delay)
    return ser.readlines() if read_all else ser.readline()

# def parse_cpbr(raw_data):
#     phone_numbers = []
#     for line in raw_data:
#         line_str = line.decode(errors='ignore').strip()
#         if line_str.startswith('+CPBR:'):
#             parts = line_str.split(',')
#             if len(parts) >= 2:
#                 number = parts[1].replace('"', '').strip()
#                 formatted_number = '+' + number  # Thêm dấu '+' vào đầu số
#                 phone_numbers.append(formatted_number)
#     return phone_numbers

# def get_phone_number(ser):
#     try:
#         raw_data = send_at_command(ser, 'AT+CPBR=1,10', delay=3, read_all=True)
#         print('cbp', raw_data)
#         v = parse_cpbr(raw_data)[0] if raw_data else "Unknown"
#         # print('>>> Reading CPBR:', v)
#         return v
#     except Exception as e:
#         print(f"Error reading CPBR: {e}")
#         return "Unknown"


def parse_cpbr(raw_data):
    phone_numbers = []
    for line in raw_data:
        line_str = line.decode(errors='ignore').strip()
        if line_str.startswith('+CPBR:'):
            parts = line_str.split(',')
            if len(parts) >= 2:
                number = parts[1].replace('"', '').strip() if parts[1] else ''
                formatted_number = '+' + number  # Thêm dấu '+' vào đầu số
                phone_numbers.append(formatted_number)
    return phone_numbers

def parse_cnum(raw_data):
    for line in raw_data:
        line_str = line.decode(errors='ignore').strip()
        if line_str.startswith('+CNUM:'):
            parts = line_str.split(',')
            if len(parts) >= 2:
                number = parts[1].replace('"', '').strip() if parts[1] else ''
                return '+' + number
    return None


def format_number(s):
    res = s.replace('+','') if s else ''
    if res.startswith('81'):
        res = '0' + res[2:]
    return res

def get_phone_number(ser):
    import time
    try:
        raw_data = send_at_command(ser, 'AT+CPBR=1,10', delay=3, read_all=True)
        print('Raw CPBR:', raw_data)
        numbers = parse_cpbr(raw_data)
        if numbers:
            return format_number(numbers[0])
        else:
            # Nếu không lấy được bằng CPBR thì thử lệnh CNUM
            raw_cnum = send_at_command(ser, 'AT+CNUM', delay=3, read_all=True)
            print('Raw CNUM:', raw_cnum)
            number_cnum = parse_cnum(raw_cnum)
            return number_cnum if format_number(number_cnum) else "Unknown"
    except Exception as e:
        print(f"Error reading phone number: {e}")
        return "Unknown"


def get_modem_info(port):
    info = {
        'com_name': port.device,
        'status': 'Unknown',
        'sim_provider': 'Unknown',
        'phone_number': 'Unknown',
        'ccid': 'Unknown',
        'content': 'Unknown'
    }

    try:
        with serial.Serial(port.device, baudrate=115200, timeout=2) as ser:
            # print('phone_C')
            response = send_at_command(ser, 'AT', read_all=False).decode(errors='ignore').strip()
            info['status'] = 'OK' if 'OK' in response else 'No Response'
            # print('phone_A')

            # CCID
            ccid = send_at_command(ser, 'AT+CCID', read_all=False).decode(errors='ignore').strip()
            info['ccid'] = ccid
            # print('phone_0')

            # Số điện thoại
            info['phone_number'] = get_phone_number(ser)
            print(info['phone_number'])
                
            # time.sleep(1)
            # print('Result 1',ser.read_all().decode(errors='ignore'))

            # Nhà mạng
            provider = send_at_command(ser, 'AT+COPS?', read_all=False).decode(errors='ignore').strip()
            info['sim_provider'] = provider
            # print('phone_2')

            
            msg = send_at_command(ser, 'AT+CMGL="ALL"', read_all=False).decode(errors='ignore').strip()
            info['content'] = msg
            # print('phone_3')

           
            # sio.wait()
    except Exception as e:
        info['status'] = f"Error: {str(e)}"

    return info



def worker(ports_subset, results, idx_start=0):
    """
    Thread worker: xử lý nhóm port con, lấy info từng port và lưu vào results (list).
    idx_start để biết chỉ số bắt đầu của nhóm port
    """
    for i, port in enumerate(ports_subset):
        try:
            info = get_modem_info(port)
            msg = f"{idx_start + i}/{total_ports} - {socket.gethostname()} - Scanning {port.device} - Phone number: {info['phone_number']}"
            print(msg)
            # Gửi message qua WS hoặc xử lý ở đây nếu cần
            # send_ws_message(msg)

            results[idx_start + i] = info  # Gán thông tin đúng vị trí trong kết quả chung
        except Exception as e:
            print(f"Error scanning {port.device}: {e}")
            results[idx_start + i] = {'com_name': port.device, 'status': f'Error: {e}'}
            
import time

def get_all_port_info():
    start_time = time.time()
    
    ports = serial.tools.list_ports.comports()
    global total_ports
    total_ports = len(ports)

    # Kết quả khởi tạo list trống theo số port, sẽ gán giá trị sau
    port_data = [None] * total_ports

    # Số thread bạn muốn chia
    num_threads = 20
    if total_ports < num_threads:
        num_threads = total_ports  # hạn chế số thread không vượt số port

    # Chia ports thành các nhóm gần bằng
    chunk_size = (total_ports + num_threads - 1) // num_threads  # chia trần

    threads = []

    for i in range(num_threads):
        start_idx = i * chunk_size
        end_idx = min(start_idx + chunk_size, total_ports)
        ports_subset = ports[start_idx:end_idx]
        t = Thread(target=worker, args=(ports_subset, port_data, start_idx))
        t.start()
        threads.append(t)

    # Đợi tất cả thread kết thúc
    for t in threads:
        t.join()

    # Sau khi hoàn tất, port_data đã đầy đủ thông tin
    try:
        send_ws_message(json.dumps(port_data))
    except Exception:
        pass

    end_time = time.time()  # Đo thời gian kết thúc
    duration = end_time - start_time

    print(f"Thời gian bắt đầu: {time.localtime(start_time)}, thực thi toàn bộ hàm: {duration:.2f} giây")

    total = 0
    for info in port_data:
        if info['phone_number'] != 'Unknown':
            total += 1

    print('Total', total)
    return port_data
