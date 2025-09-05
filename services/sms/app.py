import os
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from flask import request, jsonify
import time

basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(basedir, 'sms.sqlite3')
os.makedirs(os.path.dirname(db_path), exist_ok=True)

app = Flask(__name__)

# Cấu hình CORS cho HTTP API
CORS(app)

# Cấu hình database
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{db_path}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Khởi tạo các extension
db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins='*', logger=True, engineio_logger=True)

# Tạo bảng nếu chưa có
with app.app_context():
    db.create_all()

# Tiếp tục định nghĩa model, route, socket events ...


class SMS_Transition(db.Model):
    __tablename__ = 'sms_transitions'

    id = db.Column(db.Integer, primary_key=True)
    accountId = db.Column(db.String(64), nullable=True)
    time_at = db.Column(db.DateTime, default=datetime.utcnow)
    phone_source = db.Column(db.String(64), nullable=True)
    phone_number = db.Column(db.String(20), nullable=False)
    sms_content = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), nullable=True)  # ví dụ: success, failed, pending
    result_message = db.Column(db.Text, nullable=True)  # kết quả trả về từ lệnh gửi


# Lưu client sid đang kết nối socket
client_sid = None
command_results = {}

@socketio.on('connect')
def on_connect():
    global client_sid
    print(f"Client connected: {request.sid}")
    client_sid = request.sid
    emit('response', {'message': 'Connected to server'})

@socketio.on('disconnect')
def on_disconnect():
    global client_sid
    print(f"Client disconnected: {request.sid}")
    if client_sid == request.sid:
        client_sid = None

@socketio.on('command_response')
def on_command_response(data):
    cmd_id = data.get('cmd_id')
    result = data.get('result')
    print(f"Received command response: {cmd_id} -> {result}")
    if cmd_id:
        command_results[cmd_id] = result


# API gửi lệnh chung
@app.route('/api/send_cmd', methods=['POST'])
def api_send_cmd():
    data = request.json
    cmd_id = data.get('cmd_id')
    command = data.get('command')

    if not cmd_id or not command:
        return jsonify({'error': 'cmd_id và command bắt buộc'}), 400

    global client_sid
    if not client_sid:
        return jsonify({'error': 'Không có client socket kết nối'}), 400

    socketio.emit('send_command', {'cmd_id': cmd_id, 'command': command}, to=client_sid)

    # Đợi kết quả command_response
    timeout = 10
    interval = 0.1
    waited = 0
    while waited < timeout:
        if cmd_id in command_results:
            result = command_results.pop(cmd_id)
            return jsonify({'cmd_id': cmd_id, 'result': result})
        time.sleep(interval)
        waited += interval
    
    return jsonify({'error': 'Timeout chờ lệnh thực thi'}), 504

import datetime
# --- API mới gửi SMS ---
from datetime import datetime

@app.route('/api/send_sms', methods=['POST'])
def api_send_sms():
    data = request.json
    accountId = data.get('accountId')
    phone_source = data.get('phone_source')
    phone_number = data.get('phone_number')
    sms_content = data.get('sms_content')

    if not phone_number or not sms_content:
        return jsonify({'error': 'phone_number và sms_content bắt buộc'}), 400
    
    global client_sid
    if not client_sid:
        return jsonify({'error': 'Không có client socket kết nối'}), 400

    # Tạo cmd_id và command
    cmd_id = str(uuid.uuid4())
    cmd = f"cmd|sms|API_SERVER|COM_PORT|{phone_number}|{sms_content}"

    # Lưu bản ghi mới vào database với trạng thái pending
    sms_transition = SMS_Transition(
        accountId=accountId,
        time_at=datetime.utcnow(),
        phone_source=phone_source,
        phone_number=phone_number,
        sms_content=sms_content,
        status='pending'
    )
    db.session.add(sms_transition)
    db.session.commit()  # commit để lấy id nếu cần

    print(f"Sending SMS command: {cmd_id} -> {cmd}")
    socketio.emit('send_command', {'cmd_id': cmd_id, 'command': cmd}, to=client_sid)

    # Đợi kết quả trả về
    timeout = 15
    interval = 0.1
    waited = 0
    result = None
    while waited < timeout:
        if cmd_id in command_results:
            result = command_results.pop(cmd_id)
            # Cập nhật trạng thái và kết quả vào database
            sms_transition.status = 'done'
            sms_transition.result_message = result
            db.session.commit()
            return jsonify({'cmd_id': cmd_id, 'result': result})
        time.sleep(interval)
        waited += interval

    # Nếu timeout, cập nhật trạng thái failed
    sms_transition.status = 'failed'
    sms_transition.result_message = 'Timeout chờ gửi SMS'
    db.session.commit()

    return jsonify({'error': 'Timeout chờ gửi SMS'}), 504


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5006)



# Model SMS_Transition:
# Lưu trữ các bản ghi lịch sử gửi SMS với các trường:
# id: khóa chính
# accountId: tài khoản user gửi
# time_at: thời gian gửi SMS
# phone_source: nguồn gửi (có thể máy, hệ thống)
# phone_number: số nhận SMS
# sms_content: nội dung SMS
# status: trạng thái gửi (ví dụ success, failed, pending)
# result_message: kết quả gửi (phản hồi từ thiết bị/lệnh)
# Quản lý kết nối SocketIO:
# Lưu client_sid của client đang kết nối WebSocket để gửi/nhận lệnh.
# Xử lý sự kiện connect, disconnect để biết client đang online hay offline.
# Sự kiện command_response để nhận phản hồi từ client về kết quả lệnh gửi.
# API /api/send_cmd:
# Nhận lệnh gửi từ client HTTP, gồm cmd_id và command.
# Gửi lệnh qua SocketIO đến client đã kết nối.
# Đợi phản hồi trong timeout 10s, trả kết quả qua HTTP.
# Trả lỗi timeout nếu client không phản hồi.
# API /api/send_sms:
# Nhận yêu cầu gửi SMS gồm accountId, phone_source, phone_number, sms_content.
# Tạo một bản ghi SMS_Transition trạng thái pending.
# Tạo lệnh gửi SMS định dạng chuỗi cmd|sms|....
# Gửi lệnh qua SocketIO đến client.
# Đợi kết quả trả về trong timeout 15s.
# Cập nhật bản ghi SMS_Transition trạng thái done hoặc failed tùy kết quả.
# Trả kết quả hoặc lỗi timeout qua HTTP.
