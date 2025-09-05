import json
from datetime import datetime
from django.core.management.base import BaseCommand
import os
import django
import sys
import pymongo

from pymongo import MongoClient
import json

current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(current_dir)


print(current_dir)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "gsm.settings")  # Thay myproject bằng tên project Django của bạn
django.setup()

from dashboard.models import Account, CryptoAddress


def to_mongosh(file):
    client = MongoClient('mongodb://103.237.147.43:27017')

    # 2. Chọn database và collection
    db = client.JapanSim
    users_collection = db.users

    # 3. Đọc file JSON chứa danh sách user để upload
    with open(file, 'r', encoding='utf-8') as f:
        users_data = json.load(f)  # users_data phải là 1 list các dict

    print(len(users_data))

    # 4. Chèn dữ liệu vào collection 'users'
    if isinstance(users_data, list):
        users_collection.insert_many(users_data)
    else:
        users_collection.insert_one(users_data)

    print("Uploaded", len(users_data), "users to MongoDB collection 'users' in 'JapanSim' database.")


if __name__=="__main__":
    # data = read_mongo('103.237.147.43','root','123456','JapanSim','users')

    

    filepath = r'D:\Dropbox\_Documents\_Vlance_2025\July\gsm_json\users.json'

    to_mongosh(filepath)

    # with open(filepath, 'r', encoding='utf-8') as f:
    #     data = json.load(f)
            
        # Account.objects.all().delete()
        # Account.load_json_to_db(data)

    # print("Đã xuất users ra file users.json và cập nhật DB Django")