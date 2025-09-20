from flask import Flask, render_template
from port_scanner import get_all_port_info
from check_simlist_api import api_send_simlist
import json
from apscheduler.schedulers.background import BackgroundScheduler
import logging
from datetime import datetime


import os

def get_env():
    device_name = os.getenv("DEVICE")
    database_url = os.getenv("DATABASE_URL")
    secret_key = os.getenv("SECRET_KEY")
    vps_id = os.getenv("VPS_ID")
    debug = os.getenv("DEBUG", "False")

    print("device_name:", device_name)
    print("vps_id:", vps_id)
    print("Database URL:", database_url)
    print("Secret Key:", secret_key)
    print("Debug:", debug)

    return {
        "device_name": device_name,
        "vps_id": vps_id,
        "databaseUrl": database_url,
        "secretKey": secret_key,
        "debug": debug
    }



logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def scheduled_task():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    logger.info(f">>>Chạy chức năng định kỳ 15 phút lúc {now}")
    
    print("Chạy chức năng định kỳ 15 phút")
    port_data = get_all_port_info()

    payload = {
        "device_name": get_env()["device_name"],
        "port_data": port_data
    }

    print('payload:', json.dumps(payload))

    api_send_simlist(get_env()["vps_id"], payload)
    return port_data


scheduler = BackgroundScheduler()
scheduler.add_job(func=scheduled_task, trigger="interval", minutes=15)
scheduler.start()

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html', ports=scheduled_task())

if __name__ == '__main__':
    scheduled_task()
    app.run(debug=True)
