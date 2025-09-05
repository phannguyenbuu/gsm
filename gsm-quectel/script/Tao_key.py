import json
import pytz
import random
import string
import tkinter as tk
from datetime import datetime
from tkinter import messagebox
from pymongo import MongoClient
from cryptography.fernet import Fernet
from dateutil.relativedelta import relativedelta

def random_key():
    prefix = "HPK6868-"
    key = prefix + "-".join("".join(random.choices(string.ascii_uppercase + string.digits, k=7)) for _ in range(5))
    return key

def get_vietnam_time():
    try:
        timezone = pytz.timezone('Asia/Ho_Chi_Minh')
        isotime = (datetime.now(timezone)).strftime("%d-%m-%Y")
        strtime = (datetime.now(timezone)).strftime("%m%Y")
        return [isotime, strtime]
    except Exception as e:
        messagebox.showerror("Thông báo", f"*Er01 - Không thể kết nối internet")
        root.destroy()

def create_12(dte, cpi):
    try:
        date_obj = datetime.strptime(dte, "%m%Y")
        rsl = []
        for _ in range(12):
            rsl.append({
                "dte": str(date_obj.strftime("%m%Y")),
                "payment_internet": cpi,
                "deb_cart": cpi,
                "lookup_cart": cpi,
                "lookup_ftth": cpi,
                "deb_evn": cpi
            })
            date_obj += relativedelta(months=1) 
        return rsl
    except Exception as e:
        print(f"e: {e}")

def check_user_exits(usr):
    cks = collection.find_one({"username": usr}, {"key": 1})
    return cks

def create_user():
    try:
        usr = (inp_usr.get()).strip().upper()
        pwd = (inp_pwd.get()).strip()

        cks = check_user_exits(usr)
        if not cks:
            cpi = int((inp_cpi.get()).strip())
            active_code = random_key()
            dte = get_vietnam_time()
            
            rsl = create_12(dte[1], cpi)

            data_hash = {
                "username": usr,
                "password": pwd,
                "services": rsl
            }

            cipher = Fernet(b'h_ThisAAutoToolVjppro-CopyRight-ByCAOAC7690=')
            json_data = json.dumps(data_hash)
            encrypted_data = cipher.encrypt(json_data.encode())
            
            hex_data = encrypted_data.hex()

            data = {
                "username": usr,
                "password": bool(pwd),
                "package": cpi,
                "active": False,
                "key": active_code,
                "files": hex_data,
                "created_at": dte[0],
            }

            collection.insert_one(data)
            out_rsl.config(state="normal")
            out_rsl.delete("1.0", "end")
            out_rsl.insert("1.0",active_code)
            out_rsl.config(state="disabled")
            messagebox.showinfo("Thông báo", "Đã thêm thành công")
        else:
            out_rsl.config(state="normal")
            out_rsl.delete("1.0", "end")
            out_rsl.insert("1.0", cks["key"])
            out_rsl.config(state="disabled")
            messagebox.showwarning("Thông báo", "Tài khoản đã tồn tại")

    except Exception as e:
        print(e)

root = tk.Tk()
root.title("Tạo mã kích hoạt")
root.geometry("440x300") 
try:
    root.option_add("*Font", "Arial 10")
    root.iconbitmap("tools\\hpk\\hpk.ico")
except: 
    pass

usr_frm = tk.Frame(root)
usr_frm.pack(expand=True, side="top", padx=4)
pwd_frm = tk.Frame(root)
pwd_frm.pack(expand=True, side="top", padx=4)

out_frm = tk.Frame(root)
out_frm.pack(expand=True, side="top", pady=4)

inhash_frm = tk.Frame(root)
inhash_frm.pack(expand=True, side="top")

lbl_usr = tk.Label(usr_frm, text="Tài khoản")
lbl_usr.pack(side="left")
inp_usr = tk.Entry(usr_frm, width=24)
inp_usr.pack(side="left", padx=4)

lbl_pwd = tk.Label(pwd_frm, text="Mật khẩu")
lbl_pwd.pack(side="left")
inp_pwd = tk.Entry(pwd_frm, width=24)
inp_pwd.pack(side="left", padx=4)

temp_lbl = tk.Label(usr_frm, text="")
temp_lbl.pack(side="left", padx=4)

lbl_cpi = tk.Label(usr_frm, text="lần/tháng")
lbl_cpi.pack(side="right")
inp_cpi = tk.Entry(usr_frm, width=8)
inp_cpi.pack(side="right", padx=4)
inp_cpi.insert(0, "800")

out_rsl = tk.Text(out_frm, height=4 , state="disabled", bg="#ddd")
out_rsl.pack( padx=10)


btn_cre = tk.Button(root, text="Tạo key", fg="blue", command=create_user)
btn_cre.pack(side='right', padx=16, pady=10)

uri = "mongodb+srv://huytq0104:huypro7690@hpk.jdkmqqs.mongodb.net/?retryWrites=true&w=majority&appName=HPK"
client = MongoClient(uri)
try:
    db = client["Tools"]
    collection = db["Users"]
    usernames = collection.distinct("username")

# In ra tất cả các giá trị username
    for username in usernames:
        print(username)
except Exception as e:
    messagebox.showerror("Thông báo", f"Không thể kết nối database!")
    

root.mainloop()
