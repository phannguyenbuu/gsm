from flask import Flask, request, render_template, jsonify
from flask import Flask
import threading
import webview
import threading
from check_com import listen_com11
from app import scheduled_task
import sys, os
from check_com import send_at_command, send_sms_quecltel_com9

if getattr(sys, 'frozen', False):
    # đang chạy file exe PyInstaller
    base_path = sys._MEIPASS
else:
    base_path = os.path.abspath(".")

app = Flask(__name__,
            template_folder=os.path.join(base_path, "templates"),
            static_folder=os.path.join(base_path, "static"))

last_message = ""
last_sms_result = ""
simlist = None

@app.route('/data_ready')
def data_ready():
    # Kiểm tra dữ liệu đã sẵn sàng hay chưa (vd: biến toàn cục)
    if simlist != None:
        return {"ready": True, "data": simlist}
    else:
        return {"ready": False}
    
import json
from datetime import datetime

services_records = []

def sms_load_service(jsonfile):
    global services_records

    json_file_path = os.path.join(base_path, jsonfile)
    if os.path.exists(json_file_path):
        with open(json_file_path, 'r', encoding='utf-8') as f:
            services_records = json.load(f)

def sms_load_record_board(jsonfile):
    json_file_path = os.path.join(base_path, jsonfile)
    if os.path.exists(json_file_path):
        with open(json_file_path, 'r', encoding='utf-8') as f:
            sms_records = json.load(f)
    else:
        sms_records = []


    for sms in sms_records:
        sms["time"] = datetime.strptime( sms["time"].split('.')[0], '%Y-%m-%dT%H:%M:%S') 
        services = [ser["text"] for ser in services_records if ser["code"].upper() in sms["content"].upper()]

        sms["service"] = services if len(services) > 0 else ''

    return sms_records

def sms_record_board(jsonfile):

    phone_number = request.form.get('sms_phone', '')
    sms_message = request.form.get('sms_content', '')
    if not phone_number.strip():
        sms_result = "Vui lòng nhập số điện thoại."
    elif not sms_message.strip():
        sms_result = "Vui lòng nhập nội dung SMS."
    else:
        sms_result = send_sms_quecltel_com9(phone_number, sms_message)
    last_sms_result = sms_result
    message = request.form.get('message', '')
    last_message = message

    data_to_save = {
        "from_phone": request.form.get('sms_phonenumber', ''),
        "to_phone": phone_number,
        "content": sms_message,
        "time": datetime.utcnow().isoformat(),
        "service": "",
        "result": sms_result,
    }
    
    json_file_path = os.path.join(base_path, jsonfile)

    # Kiểm tra nếu chưa có file thì tạo file JSON trống (mảng rỗng)
    if not os.path.exists(json_file_path):
        with open(json_file_path, 'w', encoding='utf-8') as f:
            json.dump([], f, ensure_ascii=False, indent=4)

    # Mở file đọc dữ liệu hiện có
    with open(json_file_path, 'r', encoding='utf-8') as f:
        existing_data = json.load(f)

    # Thêm dữ liệu mới vào list
    existing_data.append(data_to_save)

    # Ghi lại file JSON với toàn bộ dữ liệu
    with open(json_file_path, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, ensure_ascii=False, indent=4)

    return existing_data, sms_message, sms_result


@app.route('/', methods=['GET', 'POST'])
def index():
    sms_load_service('json/services.json')

    active_tab = request.args.get('tab', 'sim')
    sms_records = sms_load_record_board('json/sms_data.json')
    print('current_sms_records', len(sms_records))

    global last_message, last_sms_result, simlist

    from check_com import received_lines, com7_status  # Bạn import trong hàm hoặc đầu file cũng được

    # Luôn lấy 50 dòng dữ liệu COM11 mới nhất để hiển thị
    display_lines = received_lines[-50:][::-1]

    if request.method == 'POST':
        port = request.form.get('port', 'COM40')
        baudrate = int(request.form.get('baudrate', 9600))

        

        if 'send_at' in request.form:
            message = request.form.get('message', '')
            at_command = "AT\r\n" + message + "\r\n"
            result = send_at_command(port=port, baudrate=baudrate, at_command=at_command)
            last_message = message
            last_sms_result = ""
            return render_template('receiver.html', port=port, baudrate=baudrate,
                                        active_tab='sim', sms_records = sms_records[::-1],
                                          message=message, sms_message='', 
                                          at_result=result, sms_result=sms_result,
                                          last_message=last_message, lines=display_lines)

        elif 'send_sms' in request.form:
            sms_records, sms_message, sms_result = sms_record_board('json/sms_data.json')
            

            return render_template('receiver.html', port=port, baudrate=baudrate,
                                        active_tab='sms', sms_records = sms_records[::-1],
                                          sms_message=sms_message,
                                          at_result='', sms_result=sms_result,
                                          last_message=last_message, lines=display_lines)
        

    # simlist = scheduled_task()  # giả sử scheduled_task trả về list port info

    # GET lần đầu hoặc không phải POST gửi lệnh/sms
    return render_template('receiver.html', com7_status=com7_status, port="COM39", 
                        #    simlist = simlist,
                                baudrate=115200,active_tab=active_tab,sms_records = sms_records[::-1],
                                  message="", sms_message="WelcomeY",
                                  at_result="", sms_result="", last_message="",
                                  lines=display_lines)

@app.route('/start_sim_scan', methods=['POST'])
def start_sim_scan():
    global simlist

    # Giả lập chạy do tác vụ quét sim (có thể gọi scheduled_task())
    simlist = scheduled_task()

    return jsonify({"status": "done", "simlist": simlist})


def start_flask():
    # scheduled_task()

    t = threading.Thread(target=listen_com11, daemon=True)
    print(t)
    t.start()
    app.run(debug=True)

def run_web_form():
    flask_thread = threading.Thread(target=start_flask)
    flask_thread.daemon = True
    flask_thread.start()

    
    webview.create_window("GSM Desktop", "http://127.0.0.1:5000")
    webview.start()
    

if __name__ == "__main__":
    # run_web_form()
    start_flask()
