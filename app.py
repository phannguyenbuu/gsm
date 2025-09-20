from flask import Flask, request, render_template, jsonify
from flask import Flask
import threading
import webview
import threading
from check_com import listen_com11
from simlist import get_all_port_info, scheduled_task
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
simlist = []

@app.route('/data_ready')
def data_ready():
    # Kiểm tra dữ liệu đã sẵn sàng hay chưa (vd: biến toàn cục)
    if simlist != None:
        return {"ready": True, "data": simlist}
    else:
        return {"ready": False}
    
import json
from datetime import datetime


def sms_load_services(jsonfile):
    services_records = []

    json_file_path = os.path.join(base_path, jsonfile)
    if os.path.exists(json_file_path):
        with open(json_file_path, 'r', encoding='utf-8') as f:
            services_records = json.load(f)

    return services_records

def search_service(item, services_records):
    services = [ser["text"] for ser in services_records if ser["code"].upper() in item["content"].upper()]
    return ','.join(services if len(services) > 0 else [])


def sms_load_data(jsonfile, services_records):
    json_file_path = os.path.join(base_path, jsonfile)
    if os.path.exists(json_file_path):
        with open(json_file_path, 'r', encoding='utf-8') as f:
            sms_records = json.load(f)
    else:
        sms_records = []

    print('services_records', len(services_records))


    for sms in sms_records:
        sms["time"] = datetime.strptime( sms["time"].split('.')[0], '%Y-%m-%dT%H:%M:%S') 
        sms['service'] = search_service(sms, services_records)

    return sms_records

def sms_save_data(jsonfile, services_records):
    mode = 'otp' if 'otp' in jsonfile else 'sms'

    phonenumber = request.form.get('phonenumber', '')
    sms_phonenumber = request.form.get('sms_phonenumber', '')
    sms_content = request.form.get('sms_content', '')

    if mode == 'sms':
        if not sms_phonenumber.strip():
            sms_result = "Nhập số nhận"
        elif not sms_content.strip():
            sms_result = "Nhập nội dung SMS"
        else:
            sms_result = send_sms_quecltel_com9(sms_phonenumber, sms_content)
    elif mode == 'otp':
        if not phonenumber.strip():
            sms_result = "Nhập số nhận"

    # last_sms_result = sms_result
    # message = request.form.get('message', '')
    # last_message = message

    if mode == 'sms':
        data_to_save = {
            "from_phone": phonenumber,
            "to_phone": sms_phonenumber,
            "content": sms_content,
            "time": datetime.utcnow().isoformat(),
            "result": sms_result,
        }
    elif mode == 'otp':
        data_to_save = {
            "to_phone": sms_phonenumber,
            "content": sms_content,
            "time": datetime.utcnow().isoformat(),
            "result": sms_result,
        }

    data_to_save['service'] = search_service(data_to_save, services_records)
    
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

    return existing_data, sms_content, sms_result


@app.route('/', methods=['GET', 'POST'])
def index():
    services_records = sms_load_services('json/services.json')
    print('total_services', len(services_records))
    active_tab = request.args.get('tab', 'sim')
    
    sms_records = sms_load_data('json/sms_data.json', services_records)
    otp_records = sms_load_data('json/otp_data.json', services_records)

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
                                        active_tab='sim',
                                        simlist=simlist,
                                         
                                        sms_records = sms_records[::-1], sms_content=sms_content, sms_result=sms_result,
                                        otp_records = otp_records[::-1], otp_content=otp_content, otp_result=otp_result,

                                        message=message, 
                                        at_result=result,
                                        last_message=last_message, lines=display_lines)

        elif 'send_sms' in request.form:
            sms_records, sms_content, sms_result = sms_save_data('json/sms_data.json', services_records)
            otp_records, otp_content, otp_result = sms_save_data('json/sms_data.json', services_records)
            
            return render_template('receiver.html', port=port, baudrate=baudrate,
                                        active_tab='sms', 
                                        simlist=simlist,

                                        sms_records = sms_records[::-1], sms_content=sms_content, sms_result=sms_result,
                                        otp_records = otp_records[::-1], otp_content=otp_content, otp_result=otp_result,
                                          
                                        at_result='',
                                        last_message=last_message, lines=display_lines)
        

        elif 'sim_list' in request.form:
            simlist = get_all_port_info()
            
            for sim in simlist:
                if sim.phone_number != "Unknown" and sim.phone_number[0] != 0:
                    sim.phone_number = '0' + sim.phone_number

            simlist.sort(key=lambda x: float(x.com_name.replace('COM', '')))

            return render_template('receiver.html', simlist=simlist,
                                sms_records = sms_records[::-1], sms_result="",
                                otp_records = otp_records[::-1], otp_result="",
)
        

    # simlist = scheduled_task()  # giả sử scheduled_task trả về list port info

    # GET lần đầu hoặc không phải POST gửi lệnh/sms
    return render_template('receiver.html', com7_status=com7_status, port="COM39", 
                        #    simlist = simlist,
                                baudrate=115200,active_tab=active_tab,

                                sms_records = sms_records[::-1], sms_result="",
                                otp_records = otp_records[::-1], otp_result="",

                                message="", sms_message="WelcomeY",
                                at_result="", last_message="",
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
