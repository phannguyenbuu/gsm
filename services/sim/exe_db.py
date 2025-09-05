from extensions import db
from models import SimCard
from flask import Flask

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///sim_card.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    sim_to_delete = SimCard.query.filter_by(pc_name='PC-TEST').first()
    if sim_to_delete:
        db.session.delete(sim_to_delete)
        db.session.commit()
        print(f"Đã xóa sim với pc_name='PC-TEST'")
    else:
        print("Không tìm thấy sim với pc_name='PC-TEST'")
