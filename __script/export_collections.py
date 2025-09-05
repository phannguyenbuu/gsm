import json
from pymongo import MongoClient
import os

# Kết nối tới MongoDB (thay phù hợp với cấu hình thực tế)
mongo_uri = f"mongodb://103.237.147.43:27017/?authSource=admin"

    # Kết nối MongoDB
client = MongoClient(mongo_uri)
db = client["JapanSim"]

# Thư mục chứa các file JSON
folder_path = r"D:\Dropbox\_Documents\_Vlance_2025\July\gsm_json"

# Đọc từng file trong thư mục
for filename in os.listdir(folder_path):
    if filename.endswith(".json") and not "user" in filename:
        filepath = os.path.join(folder_path, filename)
        collection_name = os.path.splitext(filename)[0]  # tên collection lấy từ tên file (bỏ đuôi .json)
        collection = db[collection_name]

        # Mở file json và load dữ liệu
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

            if len(data) > 0:
                # Kiểm tra data là list hay object
                if isinstance(data, list):
                    collection.insert_many(data)
                    print(f"Đã insert {len(data)} tài liệu vào collection {collection_name}")
                else:
                    collection.insert_one(data)
                    print(f"Đã insert 1 tài liệu vào collection {collection_name}")
