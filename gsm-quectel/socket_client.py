import socketio
import socket
from cpin import send_sms

sio = socketio.Client()

@sio.event
def connect():
    print("✅ Đã kết nối thành công.")

@sio.event
def disconnect():
    print("❌ Mất kết nối.")

@sio.event
def message(data):
    print("📩 Tin nhắn từ server:", data)

# ✅ Thêm hàm này để xử lý lệnh từ server
@sio.on('command')
def on_command(data):
    print("📢 Lệnh từ server:", data)
    # Nếu muốn xử lý theo lệnh cụ thể:
    if isinstance(data, dict) and 'action' in data:
        action = data['action']
        # cmd,sms,+818087318039,This is temporary sms!

        cmd,key,computer_name,port,phone_number, content = action.split('|')
        if computer_name == socket.gethostname():
            if key == 'sms':
                send_sms(port, 115200,phone_number, content)
    else:
        print("⚠️ Dữ liệu lệnh không hợp lệ:", data)

def start_socket_client():
    sio.connect("http://31.97.76.62:5000")
    sio.wait()

def send_ws_message(txt):
    try:
        sio.send(txt)
    except Exception as e:
        print("🚫 Lỗi:", e)
