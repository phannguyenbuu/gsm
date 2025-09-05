from flask import Flask, request, Blueprint
from flask_restful import Api, Resource
from datetime import datetime
from models import SimCard  # model sử dụng db từ extensions
from extensions import db  # import db instance chung
import logging
from flask_cors import CORS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("WS_Server")

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///sim_card.db'  # DB riêng cho transaction
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app, resources={r"/api/*": {"origins": "*"}})

db.init_app(app)


with app.app_context():  # Đảm bảo có app context khi gọi create_all
    db.create_all()

class SimCardListAPI(Resource):
    def get(self):
        sims = SimCard.query.all()
        return [sim.to_dict() for sim in sims]

    def post(self):
        data = request.get_json(force=True)
        pc_name = data.get('pc_name')
        port = data.get('port')
        phone_number = data.get('phone_number', 'Unknown')
        ccid = data.get('ccid', 'Unknown')
        sim_provider = data.get('sim_provider', '')
        content = data.get('content', '')
        install_date_str = data.get('install_date', None)
        sales_target = data.get('sales_target', 100)
        status = data.get('status', '')

        if not pc_name or not port:
            return {"error": "pc_name và port là bắt buộc"}, 400

        try:
            install_date = datetime.fromisoformat(install_date_str) if install_date_str else datetime.now()
        except Exception:
            install_date = datetime.now()

        # Check tồn tại theo khóa
        sim = SimCard.query.filter_by(pc_name=pc_name, port=port).first()
        if sim:
            return {"error": "Sim với pc_name và port này đã tồn tại"}, 400

        new_sim = SimCard(
            pc_name=pc_name,
            port=port,
            phone_number=phone_number,
            ccid=ccid,
            sim_provider=sim_provider,
            content=content,
            install_date=install_date,
            sales_target=sales_target,
            status=status
        )
        db.session.add(new_sim)
        db.session.commit()

        print('Add new sim', pc_name, port, phone_number)

        return new_sim.to_dict(), 201



class SimCardDetailAPI(Resource):
    def get(self, sim_id):
        sim = SimCard.query.get(sim_id)
        if not sim:
            return {"error": "Sim không tồn tại"}, 404
        return sim.to_dict()

    def put(self, sim_id):
        sim = SimCard.query.get(sim_id)
        if not sim:
            return {"error": "Sim không tồn tại"}, 404
        data = request.get_json(force=True)

        # Cho phép cập nhật các trường tuỳ ý, ví dụ:
        for field in ['pc_name', 'port', 'phone_number', 'ccid', 'sim_provider', 'content', 'status']:
            if field in data:
                setattr(sim, field, data[field])

        if 'install_date' in data:
            try:
                sim.install_date = datetime.fromisoformat(data['install_date'])
            except Exception:
                pass

        if 'remove_date' in data:
            try:
                sim.remove_date = datetime.fromisoformat(data['remove_date'])
            except Exception:
                sim.remove_date = None

        if 'sales' in data:
            sim.sales = int(data['sales'])

        if 'sales_target' in data:
            sim.sales_target = int(data['sales_target'])

        db.session.commit()
        return sim.to_dict()

    def delete(self, sim_id):
        sim = SimCard.query.get(sim_id)
        if not sim:
            return {"error": "Sim không tồn tại"}, 404
        db.session.delete(sim)
        db.session.commit()
        return {"message": f"Đã xóa sim id {sim_id}"}


### --- API batch tạo nhiều sim từ list JSON ---
import os
import json
from sqlalchemy.exc import IntegrityError

class SimCardBatchCreate(Resource):
    def post(self):
        data_list = request.get_json(force=True)

        if not isinstance(data_list, list):
            return {"error": "Input phải là danh sách JSON"}, 400

        saved_dir = 'saved'
        if not os.path.exists(saved_dir):
            os.makedirs(saved_dir)

        created_sims = []
        errors = []

        for data in data_list:
            pc_name = data.get('pc_name')
            port = data.get('port')

            if not pc_name or not port:
                errors.append({"data": data, "error": "pc_name hoặc port thiếu"})
                continue

            phone_number = data.get('phone_number', 'Unknown')
            ccid = data.get('ccid', 'Unknown')
            sim_provider = data.get('sim_provider', '')
            content = data.get('content', '')
            install_date_str = data.get('install_date', None)
            sales_target = data.get('sales_target', 100)
            status = data.get('status', '')

            try:
                install_date = datetime.fromisoformat(install_date_str) if install_date_str else datetime.utcnow()
            except Exception:
                install_date = datetime.utcnow()

            try:
                sim = SimCard.query.filter_by(pc_name=pc_name, port=port).first()
                if sim:
                    # Nếu sim đã tồn tại, có thể cập nhật hoặc bỏ qua, ở đây ta bỏ qua để tránh duplicate
                    errors.append({"data": data, "error": "Sim với pc_name và port đã tồn tại"})
                    continue

                new_sim = SimCard(
                    pc_name=pc_name,
                    port=port,
                    phone_number=phone_number,
                    ccid=ccid,
                    sim_provider=sim_provider,
                    content=content,
                    install_date=install_date,
                    sales_target=sales_target,
                    status=status
                )
                db.session.add(new_sim)
                db.session.commit()
                created_sims.append(new_sim.to_dict())

            except IntegrityError as ie:
                db.session.rollback()
                errors.append({"data": data, "error": "Lỗi ràng buộc unique hoặc database"})
            except Exception as e:
                db.session.rollback()
                errors.append({"data": data, "error": str(e)})

        return {"created": created_sims, "errors": errors}, 201 if len(errors) == 0 else 207

### --- API tăng doanh số + trả sim gần đạt doanh số ---

class SimCardIncreaseSales(Resource):
    def post(self, sim_id):
        data = request.get_json(force=True)
        amount = data.get('amount', 1)
        if amount <= 0:
            return {"error": "amount phải là số dương"}, 400

        sim = SimCard.query.get(sim_id)
        if not sim:
            return {"error": "Sim không tồn tại"}, 404

        sim.increase_sales(amount)

        threshold = data.get('threshold', 10)
        near_sims = SimCard.query.filter(
            SimCard.remove_date.is_(None),
            (SimCard.sales_target - SimCard.sales) <= threshold
        ).order_by((SimCard.sales_target - SimCard.sales).asc()).all()

        near_list = []
        for nsim in near_sims:
            near_list.append({
                "id": nsim.id,
                "pc_name": nsim.pc_name,
                "port": nsim.port,
                "sales": nsim.sales,
                "sales_target": nsim.sales_target,
                "distance": nsim.sales_target - nsim.sales
            })

        return {
            "message": f"Đã tăng doanh số {amount} cho sim id {sim_id}",
            "near_target_sims": near_list
        }


### --- API tìm kiếm sim (id hoặc pc_name+port) ---

class SimCardSearch(Resource):
    def get(self):
        sim_id = request.args.get('id', type=int)
        pc_name = request.args.get('pc_name')
        port = request.args.get('port')

        if sim_id:
            sim = SimCard.query.get(sim_id)
            if not sim:
                return {"error": "Sim không tồn tại"}, 404
            return sim.to_dict()

        if pc_name and port:
            sim = SimCard.query.filter_by(pc_name=pc_name, port=port).first()
            if not sim:
                return {"error": "Sim không tồn tại"}, 404
            return sim.to_dict()

        return {"error": "Phải cung cấp tham số id hoặc pc_name + port"}, 400


### --- API danh sách sim gần doanh số ---

class SimCardNearTargetList(Resource):
    def get(self):
        threshold = request.args.get('threshold', default=50, type=int)

        sims = SimCard.query.filter(
            SimCard.remove_date.is_(None),
            (SimCard.sales_target - SimCard.sales) <= threshold
        ).order_by((SimCard.sales_target - SimCard.sales).asc()).all()

        result = []
        for sim in sims:
            result.append({
                "id": sim.id,
                "pc_name": sim.pc_name,
                "port": sim.port,
                "sales": sim.sales,
                "sales_target": sim.sales_target,
                "distance": sim.sales_target - sim.sales
            })
        return result

sim_card_bp = Blueprint('sim_card', __name__, url_prefix='/api')
api = Api(sim_card_bp)
app.register_blueprint(sim_card_bp)
# Đăng ký các route API
api.add_resource(SimCardListAPI, '/simcards')
api.add_resource(SimCardDetailAPI, '/simcards/<int:sim_id>')
api.add_resource(SimCardBatchCreate, '/simcards/batch_create')
api.add_resource(SimCardIncreaseSales, '/simcards/<int:sim_id>/increase_sales')
api.add_resource(SimCardSearch, '/simcards/search')
api.add_resource(SimCardNearTargetList, '/simcards/nearby')

print(app.url_map)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    logger.info("Khởi động Flask RESTful server (không chạy SocketIO)...")
    app.run(host='0.0.0.0', port=5007, debug=True)


# Danh sách SimCard (SimCardListAPI):
# GET /api/simcards: Lấy tất cả SimCard trong database dưới dạng list JSON.
# POST /api/simcards: Tạo mới 1 SimCard. Kiểm tra bắt buộc pc_name và port, tránh trùng theo cặp này.
# Chi tiết, update và xóa SimCard (SimCardDetailAPI):
# GET /api/simcards/<sim_id>: Lấy thông tin chi tiết SimCard theo id.
# PUT /api/simcards/<sim_id>: Cập nhật các trường của SimCard theo id.
# DELETE /api/simcards/<sim_id>: Xóa SimCard theo id.
# Tạo hàng loạt SimCard từ danh sách JSON (SimCardBatchCreate):
# POST /api/simcards/batch_create: Nhận list JSON nhiều SimCard để tạo hàng loạt.
# Kiểm tra tồn tại từng sim theo pc_name+port để tránh trùng.
# Trả về danh sách sim tạo thành công và lỗi.
# Tăng doanh số và lấy danh sách sim gần đạt doanh số (SimCardIncreaseSales):
# POST /api/simcards/<sim_id>/increase_sales: Tăng giá trị sales của sim theo amount.
# Trả về danh sách các sim gần đạt doanh số theo threshold.
# Tìm kiếm SimCard (SimCardSearch):
# GET /api/simcards/search: Tìm sim theo id hoặc theo cặp pc_name + port.
# Trả lỗi nếu không có đủ tham số tìm kiếm.
# Lấy danh sách SimCard gần đạt doanh số (SimCardNearTargetList):
# GET /api/simcards/nearby: Lấy danh sách các sim có sales gần sales_target trong khoảng threshold.

