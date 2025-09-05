from flask import Flask, request, render_template_string
app = Flask(__name__)

last_message = ""
last_sms_result = ""

@app.route('/', methods=['GET', 'POST'])
def index():
    global last_message, last_sms_result

    from check_com import received_lines, com7_status  # Bạn import trong hàm hoặc đầu file cũng được

    # Luôn lấy 50 dòng dữ liệu COM11 mới nhất để hiển thị
    display_lines = received_lines[-50:][::-1]

    if request.method == 'POST':
        port = request.form.get('port', 'COM40')
        baudrate = int(request.form.get('baudrate', 9600))

        from check_com import send_at_command, send_sms_quecltel_com9

        if 'send_at' in request.form:
            message = request.form.get('message', '')
            at_command = "AT\r\n" + message + "\r\n"
            result = send_at_command(port=port, baudrate=baudrate, at_command=at_command)
            last_message = message
            last_sms_result = ""
            return render_template_string(template, port=port, baudrate=baudrate,
                                          message=message, sms_message='',
                                          at_result=result, sms_result=last_sms_result,
                                          last_message=last_message, lines=display_lines)

        elif 'send_sms' in request.form:
            phone_number = request.form.get('sms_phone', '')
            sms_message = request.form.get('sms_message', '')
            if not phone_number.strip():
                sms_result = "Vui lòng nhập số điện thoại."
            elif not sms_message.strip():
                sms_result = "Vui lòng nhập nội dung SMS."
            else:
                sms_result = send_sms_quecltel_com9(phone_number, sms_message)
            last_sms_result = sms_result
            message = request.form.get('message', '')
            last_message = message
            return render_template_string(template, port=port, baudrate=baudrate,
                                          message=message, sms_message=sms_message,
                                          at_result='', sms_result=sms_result,
                                          last_message=last_message, lines=display_lines)

    # GET lần đầu hoặc không phải POST gửi lệnh/sms
    return render_template_string(template, com7_status=com7_status, port="COM39", baudrate=115200,
                                  message="", sms_message="WelcomeY",
                                  at_result="", sms_result="", last_message="",
                                  lines=display_lines)


# Mẫu HTML duy nhất cho tất cả trường hợp
template = """
<p>Trạng thái COM7: {{ com7_status }}</p>
<h2>Quản lý cổng COM và gửi SMS</h2>
<form method="post">
    <label>Cổng COM: </label><input type="text" name="port" value="{{port}}"><br>
    <label>Baudrate: </label><input type="number" name="baudrate" value="{{baudrate}}"><br><br>

    <h3>Gửi lệnh AT</h3>
    <label>Lệnh AT (thêm sau 'AT'): </label><input type="text" name="message" value="{{message}}"><br>
    <input type="submit" name="send_at" value="Gửi lệnh AT"><br><br>
    {% if at_result %}
    <b>Phản hồi lệnh AT:</b><br><pre>{{ at_result }}</pre><br>
    {% endif %}

    <h3>Gửi SMS qua Quectel (qua cổng COM hiện tại)</h3>
    <label>Số điện thoại: </label><input type="text" name="sms_phone" value="09049623584" placeholder="+84123456789"><br>
    <label>Nội dung SMS: </label><input type="text" name="sms_message" value="{{sms_message}}"><br>
    <input type="submit" name="send_sms" value="Gửi SMS"><br><br>
    {% if sms_result %}
    <b>Phản hồi gửi SMS:</b><br><pre>{{ sms_result }}</pre><br>
    {% endif %}

    <h3>Tin nhắn vừa gửi lệnh AT: {{ last_message }}</h3>

    <h2>Nhận dữ liệu từ cổng COM7</h2>
    <pre style="background:#f0f0f0; height:300px; overflow:auto; border:1px solid #ccc;">
{% for line in lines %}
{{ line }}
{% endfor %}
    </pre>
    <p><i>Trang sẽ tự động refresh sau mỗi 5 giây</i></p>
    <script>
        setTimeout(() => {
            window.location.reload();
        }, 5000);
    </script>
</form>
"""

if __name__ == "__main__":
    import threading
    from check_com import listen_com11

    t = threading.Thread(target=listen_com11, daemon=True)
    print(t)
    t.start()
    
    app.run(debug=True)
