import serial.tools.list_ports
import time

def send_at_command(ser, command, delay=0.2, read_all=True):
    ser.write(f"{command}\r".encode())
    time.sleep(delay)
    return ser.readlines() if read_all else ser.readline()

def get_phone_number(ser):
    for _ in range(2):  # thử 2 lần
        lines = send_at_command(ser, 'AT+CNUM')
        for line in lines:
            if b"+CNUM" in line:
                try:
                    number = line.decode(errors='ignore').split(',')[1].replace('"', '').strip()
                    if number.startswith('0'):
                        number = '+81' + number[1:]
                    return number
                except Exception:
                    continue
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
            # print('phone_1')

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


from flask import Flask
from threading import Thread
from socket_client import start_socket_client, send_ws_message
import json

def get_all_port_info():
    ports = serial.tools.list_ports.comports()
    port_data = []

    thread = Thread(target=start_socket_client)
    thread.daemon = True
    thread.start()

    try:
        for i, port in enumerate(ports):
            st = str(port)
            if 'XR' in st and 'USB UART' in st:
                info = get_modem_info(port)
                msg = f"{i}/{len(ports)}  Scanning {port.device} - Phone number:{info['phone_number']}"
                
                send_ws_message(msg)
                print(msg)
                port_data.append(info)
    
        send_ws_message(json.dumps(port_data))

    except Exception as e: 
        print("🚫 Lỗi:", e)

    return port_data
