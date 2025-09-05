from flask import Flask
from sim_card.app import sim_card_bp
from smsservices.app import smsservices_bp
from transaction.app import transaction_bp

app = Flask(__name__)

app.register_blueprint(sim_card_bp, url_prefix='/sim_card')
app.register_blueprint(smsservices_bp, url_prefix='/smsservices')
app.register_blueprint(transaction_bp, url_prefix='/transaction')

if __name__ == '__main__':
    app.run(port=5000, debug=True)
