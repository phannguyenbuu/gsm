from datetime import datetime
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
import requests
import os
from flask_cors import CORS
import time
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import Text

def generate_account_id():
    return int(time.time() * 1000)  # timestamp milliseconds

basedir = os.path.abspath(os.path.dirname(__file__))  # Thư mục hiện tại chứa file này
db_path = os.path.join(basedir, 'user.sqlite3')

app = Flask(__name__)
os.makedirs(os.path.dirname(db_path), exist_ok=True)
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
CORS(app)
db = SQLAlchemy(app)

#############################
# Model User với accountId làm khóa chính, bỏ username
#############################

from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON

class User(db.Model):
    __tablename__ = 'users'

    accountId = Column(String, primary_key=True, default="")  # Khóa chính dùng accountId

    firstName = Column(String(100))
    lastName = Column(String(100))
    localeCode = Column(String(10), default='en')

    balanceAmount = Column(Float, default=0.0)
    apiKey = Column(String(50), unique=False)

    isDev = Column(Boolean, default=False)
    isAdmin = Column(Boolean, default=False)
    isPartner = Column(Boolean, default=False)

    # TRC20Address = Column(String(100))
    isActive = Column(Boolean, default=True)

    permission = Column(Text)

    createdAt = Column(String(100), default=datetime.now)
    updatedAt = Column(String(100))

    webhook = Column(String(255))
    
    bonusChargeRate = Column(Float, default=0)
    discountRate = Column(Float, default=0)
    referralId = Column(Integer, default=0)
    languageCode = Column(String(10), default='en')

    specialEvents = Column(Text)
    partnerId = Column(Integer, default=0)
    isAgent = Column(Boolean, default=False)
    platform = Column(String(50))

    serviceDiscount = Column(Text)

    specialRole = Column(Integer, default=0)
    referralBalance = Column(Float, default=0.0)

    telegramInfo = Column(Text)
    orderWebhook = Column(String(255))

    selectedServices = Column(Text)
    referralRate = Column(Float, default=0)
    referralCode = Column(String(50))
    webInfo = Column(Text)
    cryptoAddressList = Column(Text)
    selectedProvider = Column(Text)

    parent_id = Column(String(100), ForeignKey('users.accountId'), nullable=True)
    parent = relationship('User', remote_side=[accountId], backref='children')

    def to_dict(self):
        return {
            'accountId': self.accountId,
            'firstName': self.firstName,
            'lastName': self.lastName,
            'localeCode': self.localeCode,
            'balanceAmount': self.balanceAmount,
            'apiKey': self.apiKey,
            'isDev': self.isDev,
            'isAdmin': self.isAdmin,
            'isPartner': self.isPartner,
            'TRC20Address': self.TRC20Address,
            'isActive': self.isActive,
            'permission': self.permission,
            'createdAt': self.createdAt,
            'updatedAt': self.updatedAt,
            # '__v': self.__v,
            'webhook': self.webhook,
            'bonusChargeRate': self.bonusChargeRate,
            'discountRate': self.discountRate,
            'referralId': self.referralId,
            'languageCode': self.languageCode,
            'specialEvents': self.specialEvents,
            'partnerId': self.partnerId,
            'isAgent': self.isAgent,
            'platform': self.platform,
            'serviceDiscount': self.serviceDiscount,
            'specialRole': self.specialRole,
            'referralBalance': self.referralBalance,
            'telegramInfo': self.telegramInfo,
            'orderWebhook': self.orderWebhook,
            'selectedServices': self.selectedServices,
            'referralRate': self.referralRate,
            'referralCode': self.referralCode,
            'webInfo': self.webInfo,
            'cryptoAddressList': self.cryptoAddressList,
            'selectedProvider': self.selectedProvider,
            'parent_id': self.parent_id,

            'parent_accountId': self.parent.accountId if self.parent else None,
            'children_accountIds': [child.accountId for child in self.children] if hasattr(self, 'children') else []
        }


#############################
# Routes: CRUD User theo accountId
#############################

@app.route('/users', methods=['GET'])
def list_users():
    users = User.query.all()
    users_list = [user.to_dict() for user in users]
    return jsonify(users_list)

@app.route('/users', methods=['POST'])
def create_user():
    """
    Tạo user mới
    JSON body yêu cầu:
    - accountId (bắt buộc)
    - first_name (tuỳ chọn)
    - last_name (tuỳ chọn)
    - parent_accountId (có thể là None hoặc không truyền là user cấp cao nhất)
    """
    data = request.json or {}

    try:
        account_id = data.get('accountId')
        if not account_id:
            # Tạo accountId mới ngẫu nhiên nếu không truyền
            account_id = generate_account_id()
        else:
            # Nếu accountId truyền vào đã tồn tại, tạo mới khác
            if User.query.get(account_id):
                account_id = generate_account_id()

        parent_account_id = data.get('parent_accountId')
        parent = None
        if parent_account_id:
            parent = User.query.get(parent_account_id)
            if not parent:
                return jsonify({'error': f"Parent user with accountId '{parent_account_id}' not found"}), 400

        user = User(
            accountId=account_id,
            firstName=data.get('first_name'),
            lastName=data.get('last_name'),
            localeCode=data.get('locale_code', 'en'),
            languageCode=data.get('language_code', 'en'),
            balanceAmount=data.get('balanceAmount', 0.0),
            referralBalance=data.get('referralBalance', 0.0),
            discountRate=data.get('discountRate', 0),
            referralRate=data.get('referralRate', 0),
            bonusChargeRate=data.get('bonusChargeRate', 0),
            apiKey=data.get('api_key'),
            webhook=data.get('webhook'),
            orderWebhook=data.get('orderWebhook'),
            isDev=data.get('is_dev', False),
            isAdmin=data.get('is_admin', False),
            isPartner=data.get('is_partner', False),
            isAgent=data.get('is_agent', False),
            specialRole=data.get('specialRole', 0),
            TRC20Address=data.get('trc20_address'),
            isActive=data.get('is_active', True),
            permission=data.get('permission', None),
            partnerId=data.get('partnerId', 0),
            referralId=data.get('referralId'),  # có thể null
            webInfo=data.get('webInfo', None),
            platform=data.get('platform', 'web'),
            serviceDiscount=data.get('serviceDiscount', None),
            specialEvents=data.get('specialEvents', None),
            selectedServices=data.get('selectedServices', None),
            referralCode=data.get('referralCode'),
            telegramInfo=data.get('telegramInfo', None),
            cryptoAddressList=data.get('cryptoAddressList', None),
            selectedProvider=data.get('selectedProvider', None),
            parent=parent,
            createdAt=data.get('created_at', None),
            updatedAt=data.get('updated_at', None),
        )

        db.session.add(user)
        db.session.commit()

        return jsonify({'message': 'User created', 'user': user.to_dict()}), 201
    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': 'Unexpected error: ' + str(e)}), 500


@app.route('/users/<int:account_id>', methods=['GET'])
def get_user(account_id):
    user = User.query.get(account_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(user.to_dict())


@app.route('/users/<int:account_id>', methods=['PUT'])
def update_user(account_id):
    user = User.query.get(account_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.json or {}

    new_account_id = data.get('accountId')
    if new_account_id and new_account_id != account_id:
        if User.query.get(new_account_id):
            return jsonify({'error': 'accountId already exists'}), 400
        user.accountId = new_account_id

    parent_account_id = data.get('parent_accountId')
    if parent_account_id is not None:
        if str(parent_account_id).lower() == 'none':
            user.parent = None
        else:
            parent = User.query.get(parent_account_id)
            if not parent:
                return jsonify({'error': f"Parent user with accountId '{parent_account_id}' not found"}), 400
            user.parent = parent

    user.firstName = data.get('first_name', user.firstName)
    user.lastName = data.get('last_name', user.lastName)
    user.localeCode = data.get('locale_code', user.localeCode)
    user.balanceAmount = data.get('balance', user.balanceAmount)
    user.apiKey = data.get('api_key', user.apiKey)
    user.isDev = data.get('is_dev', user.isDev)
    user.isAdmin = data.get('is_admin', user.isAdmin)
    user.isPartner = data.get('is_partner', user.isPartner)
    user.TRC20Address = data.get('trc20_address', user.TRC20Address)
    user.isActive = data.get('is_active', user.isActive)
    permission = data.get('permission')
    if permission is not None:
        user.permission = permission

    db.session.commit()
    return jsonify({'message': 'User updated', 'user': user.to_dict()})


@app.route('/users/<int:account_id>', methods=['DELETE'])
def delete_user(account_id):
    user = User.query.get(account_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'User deleted'})


@app.route('/users/clear_all', methods=['DELETE'])
def clear_all_users():
    try:
        num_deleted = User.query.delete()
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Error deleting users: {str(e)}'}), 500
    return jsonify({'message': f'All users cleared successfully. Total users deleted: {num_deleted}'}), 200


#############################
# Các API bổ trợ nếu cần
#############################

@app.route('/users/tree/<int:account_id>', methods=['GET'])
def get_user_tree(account_id):
    user = User.query.get(account_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    def user_tree_recursive(u):
        return {
            'accountId': u.accountId,
            'firstName': u.firstName,
            'lastName': u.lastName,
            'children': [user_tree_recursive(child) for child in u.children]
        }

    return jsonify(user_tree_recursive(user))


#############################
# Main entry
#############################

if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # Tạo bảng nếu chưa tồn tại
    app.run(debug=True, host='0.0.0.0', port=5005)
