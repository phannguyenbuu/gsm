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

input_path = 'static/more_infor_image.json'

with open(input_path, 'r', encoding='utf-8') as f:
    contents = f.read().split('\n')

post = Post.objects.get(
    key='reference_images')

cur = ''
for content in contents:
    if content.startswith('>>>'):
        cur = content[3:]
    
    elif cur != '':
        print(cur)
        PostMedia.objects.create(
            post = post,
            title=cur,
            url=content
        )

