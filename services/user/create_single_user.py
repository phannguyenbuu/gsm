from flask import Flask
from flask_sqlalchemy import SQLAlchemy
import json

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///accounts.db'  # Dùng SQLite làm ví dụ
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

class CryptoAddress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    value = db.Column(db.String(128))
    type = db.Column(db.String(20))
    account_id = db.Column(db.Integer, db.ForeignKey('account.id'))

class Account(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    _id = db.Column(db.String(50), unique=True, nullable=False)
    accountId = db.Column(db.String(50), unique=True, nullable=True)
    firstName = db.Column(db.String(50))
    lastName = db.Column(db.String(50))
    localeCode = db.Column(db.String(10))
    balanceAmount = db.Column(db.Float)
    apiKey = db.Column(db.String(100))
    isDev = db.Column(db.Boolean)
    isAdmin = db.Column(db.Boolean)
    isPartner = db.Column(db.Boolean)
    TRC20Address = db.Column(db.String(100))
    isActive = db.Column(db.Boolean)
    createdAt = db.Column(db.String(50))
    updatedAt = db.Column(db.String(50))
    discountRate = db.Column(db.Float)
    bonusChargeRate = db.Column(db.Float)
    referralBalance = db.Column(db.Float)
    referralCode = db.Column(db.String(50))
    platform = db.Column(db.String(50))
    # Có thể bổ sung các trường khác nếu muốn

    crypto_addresses = db.relationship('CryptoAddress', backref='account', lazy=True)

def load_json_to_db(json_data):
    for item in json_data:
        account = Account(
            _id=item.get('_id'),
            accountId=str(item.get('accountId')),
            firstName=item.get('firstName'),
            lastName=item.get('lastName'),
            localeCode=item.get('localeCode'),
            balanceAmount=item.get('balanceAmount'),
            apiKey=item.get('apiKey'),
            isDev=item.get('isDev'),
            isAdmin=item.get('isAdmin'),
            isPartner=item.get('isPartner'),
            TRC20Address=item.get('TRC20Address'),
            isActive=item.get('isActive'),
            createdAt=item.get('createdAt', {}).get('$date') if item.get('createdAt') else None,
            updatedAt=item.get('updatedAt', {}).get('$date') if item.get('updatedAt') else None,
            discountRate=item.get('discountRate'),
            bonusChargeRate=item.get('bonusChargeRate'),
            referralBalance=item.get('referralBalance'),
            referralCode=item.get('referralCode'),
            platform=item.get('platform')
        )
        db.session.add(account)
        db.session.flush()  # Để có id của account

        # Lưu các địa chỉ crypto
        crypto_addresses = item.get('cryptoAddressList', [])
        for ca in crypto_addresses:
            crypto_address = CryptoAddress(
                value=ca.get('value'),
                type=ca.get('type'),
                account_id=account.id
            )
            db.session.add(crypto_address)

    db.session.commit()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()

    # Giả sử bạn có dữ liệu JSON trong biến json_str
    json_str = '''[{"_id":"1834f01a-470b-4b4f-9cbd-8232f75d056c","accountId":932320605,"firstName":"zero","lastName":"effect","localeCode":"en","balanceAmount":450.847,"apiKey":"bb642c5a-c7dd-4afc-86ea-6221de6c33af","isDev":false,"isAdmin":true,"isPartner":false,"TRC20Address":"TRx9oPJGpowzSfcBgwNLvD4cEqBqiZA4iQ","isActive":true,"permission":[],"createdAt":{"$date":"2024-11-10T12:58:37.489Z"},"updatedAt":{"$date":"2025-08-10T11:30:15.925Z"},"__v":1,"webhook":"https://jpsim.run.place/api/test","bonusChargeRate":0,"discountRate":0,"referralId":0,"languageCode":"en","specialEvents":{"isChooseLanguage":true},"partnerId":0,"isAgent":false,"platform":"telegram","serviceDiscount":{"otpService":0,"rentService":0},"specialRole":0,"referralBalance":0.0,"telegramInfo":{"username":"vynghia1308"},"orderWebhook":"https://japansim.net/api/test","selectedServices":["YAHOO_JAPAN","FACEBOOK","OTHER","POKEMON"],"referralRate":0,"referralCode":"VTGMHCHW2W","webInfo":{"username":"vynghia","password":"2135e94c9283cec967823efb05ece6ce"},"cryptoAddressList":[{"value":"TRx9oPJGpowzSfcBgwNLvD4cEqBqiZA4iQ","type":"USDT-TRC20"},{"value":"0x770C465A11251cC91F36392732A9FEDE26b125ea","type":"ETH"}],"selectedProvider":["JP Docomo"]}, ...]'''  # Cắt ngắn JSON cho ví dụ

    data = json.loads(json_str)
    load_json_to_db(data)
    print("Database created and data loaded.")
