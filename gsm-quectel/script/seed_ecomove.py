import os
import django
import random
from datetime import timedelta
from django.utils import timezone
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
django.setup()

from core.models import Chapter, Post, Choice,Quiz,PostMedia
from django.contrib.auth.models import User

db_name='db_ecomove'

if __name__ == '__main__':
    # Post.objects.using('db_ecomove').create(
    #     title='TopShortcuts',
    #     content='Top shortcuts'
    # )
    print(len(Post.objects.all()))

    # for post in Post.objects.all():
    #     print(post._meta.app_label)
    # posts = Post.objects.using('default').all()
    # print(len(posts))
# @baoLong0511