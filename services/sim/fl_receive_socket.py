from flask import Flask, request
from flask_socketio import SocketIO, emit
import logging

# Thiết lập logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("WS_Server")

app = Flask(__name__)
# socketio = SocketIO(app, cors_allowed_origins="*")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')  # hoặc 'gevent'

@app.route('/')
def index():
    return 'WebSocket Server đang chạy.'

@socketio.on('connect')
def handle_connect():
    logger.info(f'Client đã kết nối: {request.sid}')
    emit('response', {'message': 'Đã kết nối thành công!'})

@socketio.on('message')
def handle_message(data):
    logger.info(f'Nhận được tin nhắn: {data}')
    emit('response', {'message': 'Server đã nhận được: ' + str(data)}, broadcast=True, include_self=False)

    cmd = str(data)
    if cmd.startswith('cmd'):
        send_command(cmd)  # Truyền SID vào hàm

def send_command(cmd):
    logger.info(f'Gửi lệnh tới tất cả client: {cmd}')
    socketio.emit('command', {'action': cmd})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f'Client đã ngắt kết nối: {request.sid}')

if __name__ == '__main__':
    logger.info("Khởi động Flask WebSocket server...")
    socketio.run(app, host='0.0.0.0', port=5000)
