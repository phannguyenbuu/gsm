from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from extensions import db
from datetime import datetime
from sqlalchemy import asc

class SimCard(db.Model):
    __tablename__ = 'sim_cards'

    id = db.Column(db.Integer, primary_key=True)
    pc_name = db.Column(db.String(100), nullable=False)
    port = db.Column(db.String(50), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)
    ccid = db.Column(db.String(50), nullable=False)
    sim_provider = db.Column(db.String(100), nullable=True)
    content = db.Column(db.Text, nullable=True)
    install_date = db.Column(db.DateTime, default=datetime.utcnow)
    remove_date = db.Column(db.DateTime, nullable=True)
    sales = db.Column(db.Integer, default=0)
    sales_target = db.Column(db.Integer, default=100)
    status = db.Column(db.String(50), nullable=True)

    __table_args__ = (db.UniqueConstraint('pc_name', 'port', name='_pc_port_uc'),)

    def is_removed(self):
        return self.remove_date is not None

    def increase_sales(self, amount=1):
        if not self.is_removed():
            self.sales += amount
            db.session.commit()

    def is_near_target(self, threshold=10):
        return not self.is_removed() and (self.sales_target - self.sales) <= threshold

    def distance_to_target(self):
        if self.is_removed():
            return None
        return self.sales_target - self.sales

    def to_dict(self):
        return {
            "id": self.id,
            "pc_name": self.pc_name,
            "port": self.port,
            "phone_number": self.phone_number,
            "ccid": self.ccid,
            "sim_provider": self.sim_provider,
            "content": self.content,
            "install_date": self.install_date.isoformat() if self.install_date else None,
            "remove_date": self.remove_date.isoformat() if self.remove_date else None,
            "sales": self.sales,
            "sales_target": self.sales_target,
            "status": self.status
        }
