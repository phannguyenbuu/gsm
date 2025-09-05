import socketio

def check_socketio_connection(server_url):
    sio = socketio.Client()

    # Bắt sự kiện connect thành công
    @sio.event
    def connect():
        print("Đã kết nối tới server Socket.IO!")
        sio.disconnect()

    # Bắt sự kiện kết nối lỗi
    @sio.event
    def connect_error(data):
        print("Kết nối thất bại:", data)

    # Bắt sự kiện ngắt kết nối
    @sio.event
    def disconnect():
        print("Đã ngắt kết nối.")

    try:
        sio.connect(server_url)
        sio.wait()
    except Exception as e:
        print("Lỗi khi kết nối:", e)

if __name__ == "__main__":
    server_url = "http://31.97.76.62:5000"  # Thay bằng địa chỉ server Socket.IO bạn dùng
    check_socketio_connection(server_url)
