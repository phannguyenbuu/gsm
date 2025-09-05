import os
import django
import random
from datetime import timedelta
from django.utils import timezone
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
django.setup()

from core.models import Chapter, Post, Comment, Choice,Quiz,PostMedia,Lesson
from django.contrib.auth.models import User

import json

# User
# ├── Post
# │    ├── PostMedia
# │    ├── Comment
# │    │    ├── PostMedia
# │    │    └── Comment (parent - replies)
# │    └── Quiz
# │         └── Choice
# └── Lesson
#      └── LessonWordProgress



def reset_data():
    # Xóa dữ liệu cũ
    Choice.objects.all().delete()
    Quiz.objects.all().delete()
    Comment.objects.all().delete()
    PostMedia.objects.all().delete()
    Post.objects.all().delete()
    Chapter.objects.all().delete()
    User.objects.filter(username='testuser').delete()

    # Tạo user test
    user, created = User.objects.get_or_create(username='testuser')
    if created:
        user.set_password('password')
        user.save()

if __name__ == '__main__':
    reset_data()
    file_path = 'static/house.json'

    chapter = Chapter.objects.create(title="SÀN 1", description="SÀN GIAO DỊCH SỐ 1")
    author = User.objects.get(username='agent-001')

    # Mở và đọc file JSON
    with open(file_path, 'r', encoding='utf-8') as f:
        houses = json.load(f)  # houses là một list các dict

    author = User.objects.first()  # hoặc User.objects.get(username='admin') tùy bạn
    

    for i, house in enumerate(houses):
        post = Post.objects.create(title=house.get('title', ''), 
                                   key=f"{i}",
                                   author=author, 
                                   content="", 
                                   chapter = chapter)
        # Danh sách các trường muốn tạo comment riêng với tiêu đề tiếng Việt hợp lý
        comment_fields = [
            # ('Tiêu đề tin đăng', 'title'),
            ('Vị trí', 'location'),
            ('Diện tích (m²)', 'area'),
            ('Tổng diện tích sàn (m²)', 'total_area'),
            ('Hướng nhà', 'direction'),
            ('Loại giao dịch (Bán/Thuê)', 'transaction_type'),
            ('Giá bán/giá thuê (VNĐ)', 'price'),
            ('Tình trạng pháp lý', 'legal_status'),
            ('Tiện ích gần kề', 'nearby'),
            ("Mô tả chi tiết", "description"),
            ("Số điện thoại 1", "contact_info_1"),
            ("Số điện thoại 2", "contact_info_2"),
            ("Số điện thoại 3", "contact_info_3"),
            ("Email liên hệ", "contact_info_mail"),
        ]


        for label, field_key in comment_fields:
            value = house.get(field_key, '')

            # Nếu field là list (ví dụ sở thích), chuyển sang chuỗi
            if isinstance(value, list):
                value = ', '.join(value)

            # Bỏ qua nếu giá trị rỗng
            if not value:
                continue

            # Tạo comment với nội dung dạng "Label: value"
            Comment.objects.create(
                post=post,
                author=author,
                title=f"{field_key}",
                content=f"{value}",
            )


        # media = PostMedia.objects.create(
        #     post=post,
        #     media_type='image',
        #     url=house_urls[i+1],
        # )
       
    print("Đã tạo xong dữ liệu Posts, Comments và PostMedia cho houses.")


            

