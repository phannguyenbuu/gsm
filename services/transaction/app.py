from flask import Flask, Blueprint, request, jsonify, current_app
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import requests
from flask_restful import Api, Resource

vps = '31.97.76.62'

# Tạo Flask app
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///transactions.db'  # DB riêng cho transaction
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Khởi tạo db
db = SQLAlchemy(app)

# Tạo blueprint
transaction_bp = Blueprint('transactions', __name__, url_prefix='/api/transactions')

api = Api(transaction_bp)  # Nếu bạn muốn dùng flask_restful, import Api trước

# Model phải kế thừa db.Model, không phải transaction_bp.Model
class Transaction(db.Model):
    __tablename__ = 'transactions'

    id = db.Column(db.Integer, primary_key=True)
    sim_id = db.Column(db.Integer, nullable=False)  # chỉ lưu id nhận từ sim_card service
    to_phone_number = db.Column(db.String(20), nullable=False)
    send_time = db.Column(db.DateTime, default=datetime.utcnow)
    service_name = db.Column(db.String(100), nullable=False)
    message_content = db.Column(db.Text, nullable=True)
    revenue = db.Column(db.Float, default=0.0)

    def to_dict(self):
        return {
            "id": self.id,
            "sim_id": self.sim_id,
            "to_phone_number": self.to_phone_number,
            "send_time": self.send_time.isoformat(),
            "service_name": self.service_name,
            "message_content": self.message_content,
            "revenue": self.revenue
        }


# Định nghĩa route trong blueprint
@transaction_bp.route('/create', methods=['POST'])
def create_transaction():
    data = request.get_json(force=True)
    pc_name = data.get('pc_name')
    port = data.get('port')
    to_phone_number = data.get('to_phone_number')
    service_name = data.get('service_name')
    message_content = data.get('message_content', '')
    revenue = data.get('revenue', 0.0)

    if not (pc_name and port and to_phone_number and service_name):
        return jsonify({"error": "Thiếu trường pc_name, port, to_phone_number hoặc service_name"}), 400

    # Gọi API sim_card service để lấy thông tin sim
    sim_card_api_url = f'http://{vps}:5000/api/simcards/search'  # URL thực tế
    params = {'pc_name': pc_name, 'port': port}
    try:
        r = requests.get(sim_card_api_url, params=params, timeout=5)
        if r.status_code != 200:
            return jsonify({"error": "Không tìm thấy SimCard hoặc lỗi API sim_card"}), 404
        sim_data = r.json()
    except requests.RequestException as e:
        current_app.logger.error(f"Lỗi gọi API sim_card: {e}")
        return jsonify({"error": "Lỗi kết nối API sim_card"}), 500

    sim_id = sim_data.get('id')
    if not sim_id:
        return jsonify({"error": "Dữ liệu sim không hợp lệ từ API sim_card"}), 500

    # Tạo transaction
    transaction = Transaction(
        sim_id=sim_id,
        to_phone_number=to_phone_number,
        send_time=datetime.utcnow(),
        service_name=service_name,
        message_content=message_content,
        revenue=revenue
    )

    db.session.add(transaction)
    db.session.commit()

    # Gọi API cập nhật doanh số cho sim_card
    update_sales_url = f"http://{vps}:5007/api/sim/{sim_id}/increase_sales"
    payload = {"amount": revenue}
    try:
        r_update = requests.post(update_sales_url, json=payload, timeout=5)
        if r_update.status_code != 200:
            current_app.logger.warning(f"Lỗi cập nhật doanh số sim_card: status {r_update.status_code}")
    except requests.RequestException as e:
        current_app.logger.warning(f"Lỗi kết nối API sim_card cập nhật doanh số: {e}")

    return jsonify({"message": "Tạo transaction thành công", "transaction": transaction.to_dict()}), 201


# Đăng ký blueprint vào app
app.register_blueprint(transaction_bp)

# Nếu dùng flask_restful Api.add_resource thì thêm vào ở đây 
# (nếu không dùng flask_restful thì không cần)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(port=5001, debug=True)




# API tạo transaction - POST /api/transactions/create:
# Yêu cầu truyền JSON có pc_name, port, to_phone_number, service_name, các trường tùy chọn message_content, revenue.
# Từ pc_name và port gọi API service sim_card để tìm sim tương ứng lấy sim_id.
# Tạo bản ghi transaction trong database.
# Gọi tiếp API tăng doanh số sim_card theo revenue.
# Trả về thông tin transaction vừa tạo.
# Kết nối giữa 2 service:
# Transaction service phụ thuộc API sim_card service (IP/port được lưu trong biến vps).
# Gọi API sim_card để lấy sim_id rồi tạo transaction liên quan.
# Gọi API sim_card để cập nhật doanh số tương ứng.
# Mục đích tổng thể:
# Đây là backend microservice quản lý transaction gửi SMS/quảng cáo hay dịch vụ cho sim.
# Liên kết chặt với sim_card service để nắm bắt sim nào có doanh số ra sao.
# Có thể mở rộng thêm API đọc, chỉnh sửa, xóa transaction hoặc thống kê.