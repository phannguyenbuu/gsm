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

from dashboard.models import Account, CryptoAddress, GsmSim, GsmService

if __name__=="__main__":
    
    filepath = r'D:\Dropbox\_Documents\_Vlance_2025\July\gsm_json\services.json'
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    GsmService.objects.all().delete()
    GsmService.load_json_to_db(data)

    # print("Đã xuất users ra file users.json và cập nhật DB Django")