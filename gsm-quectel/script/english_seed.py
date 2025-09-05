import os
import django
import random
from datetime import timedelta
from django.utils import timezone
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
django.setup()

from core.models import Chapter, Post, Comment, Choice,Quiz,PostMedia
from django.contrib.auth.models import User

import re

def read_content(text):
    # Tạo regex pattern để tìm key=value, trong đó key là từ không chứa dấu bằng, value là mọi thứ sau dấu =
    pattern = re.compile(r'^([^\s=]+)=(.*)', re.MULTILINE | re.DOTALL)

    # Tách toàn bộ text thành các phần bắt đầu bằng key=
    # Cách khác: tách theo key bằng cách tìm vị trí các key rồi lấy phần giữa

    # Dùng regex để tìm tất cả vị trí key=
    matches = list(re.finditer(r'^([^\s=]+)=', text, re.MULTILINE))

    result = {}

    for i, match in enumerate(matches):
        key = match.group(1)
        start = match.end()  # vị trí bắt đầu value
        if i + 1 < len(matches):
            end = matches[i + 1].start()  # vị trí bắt đầu key tiếp theo
        else:
            end = len(text)
        value = text[start:end].strip()
        result[key] = value

    return result


def read_all_jsons():
    words = {}

    with open('static/english_words.json', 'r', encoding='utf-8') as f:
        for w in f.read().split(','):
            words[w] = {}

    with open('static/english_content.json', 'r', encoding='utf-8') as f:
        dict = read_content(f.read())

        for k,v in dict.items():
            if k in words:
                words[k]['content'] = v
            

    with open('static/english_vn.json', 'r', encoding='utf-8') as f:
        dict = read_content(f.read())

        for k,v in dict.items():
            words[k]['vn'] = v

    with open('static/english_image.json', 'r', encoding='utf-8') as f:
        dict = read_content(f.read())

        for k,v in dict.items():
            words[k]['image'] = v.split(';')

    with open('static/english_pronoun.json', 'r', encoding='utf-8') as f:
        dict = read_content(f.read())

        for k,v in dict.items():
            words[k]['hint'] = v.split(';')
    
    for k,v in words.items():
        print(k,v)

    return words

def create_sample_data():
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

    chapters = []
    posts = []
    quizzes = []
    comments = []
    choices = []
    post_medias = []

    chapters_data = [
        {
            'title': 'Từ vựng Oxford căn bản',
            'description': 'Học 3000 từ vựng tiếng Anh căn bản để giao tiếp theo Oxford'
        },
    ]

    now = timezone.now()

    # Tạo Chapter
    for ch_data in chapters_data:
        chapter = Chapter(
            title=ch_data['title'],
            description=ch_data['description'],
            created_at=now
        )
        chapters.append(chapter)
    Chapter.objects.bulk_create(chapters)
    print(f'Created {len(chapters)} chapters')

    chapters = list(Chapter.objects.all())

    words = read_all_jsons()
    
    # Tạo Post
    chapter = chapters[0]

    posts = []
    post_medias = []

    for k, v in words.items():
        post = Post(
            key=k,
            hint=v['hint'],
            chapter=chapter,
            author=user,
            title=v['vn'],
            content=v['content'] if 'content' in v else '',
            created_at=now,
            remind_at=now + timedelta(days=random.randint(1,15)),
        )
        posts.append(post)

    # Bulk create posts
    Post.objects.bulk_create(posts)
    print(f'Created {len(posts)} posts')

    # Sau khi bulk_create, posts chưa chắc đã có id được cập nhật
    # Vì vậy, bạn cần lấy lại các post đã lưu từ DB để có id
    # Giả sử key là primary key, bạn có thể lấy lại posts như sau:

    saved_posts = Post.objects.filter(key__in=[p.key for p in posts])
    post_dict = {p.key: p for p in saved_posts}

    # Tạo post_medias với post đã có id
    for k, v in words.items():
        post = post_dict.get(k)
        if not post:
            continue  # bỏ qua nếu không tìm thấy post
        for img in v['image']:
            media = PostMedia(
                post=post,
                media_type='image',
                url=img,
                thumbnail_url=v['image'][0]
            )
            post_medias.append(media)

    # Bulk create post_medias
    PostMedia.objects.bulk_create(post_medias)
    print(f'Created {len(post_medias)} post media links')


    a = 123  # số không được chọn, ví dụ
    numbers = random.sample([x for x in range(3000) if x != a], 3)
    print(numbers)

    

    for k, v in words.items():
        post = post_dict.get(k)

        quiz = Quiz(
            post=post,
            question_text="Nghĩa tiếng Việt",
            created_at=now
        )
        quizzes.append(quiz)

    Quiz.objects.bulk_create(quizzes)
    print(f'Created {len(quizzes)} quizzes')

    quizzes = list(Quiz.objects.all())
    days_after = random.randint(1, 10)
    remind_at = now + timedelta(days=days_after)

    # for i, quiz in enumerate(quizzes):
    #     comment = Comment(
    #         post=quiz.post,
    #         author=user,
    #         content=f"Câu hỏi",
    #         created_at=now,
    #         remind_at=remind_at + timedelta(days=random.randint(1,15)),
    #         quiz=quiz
    #     )
    #     comments.append(comment)

    # Comment.objects.bulk_create(comments)
    # print(f'Created {len(comments)} comments')

    keys = words.keys()
    # Tạo Choice cho mỗi Quiz
    for k in keys:
        post = post_dict.get(k)
        quiz = post.quizzes.all()[0]

        selected = random.sample([key for key in keys if key != k], 3)
        selected.append(k)

        random.shuffle(selected)

        for s in selected:
            vn = words[s]['vn']
            choice = Choice(
                quiz=quiz,
                choice_text=vn,
                is_correct=s==k
            )
            choices.append(choice)

    Choice.objects.bulk_create(choices)
    print(f'Created {len(choices)} choices')

if __name__ == '__main__':
    create_sample_data()
    
    # for p in Post.objects.all():
    #     s = ''
        
    #     print('-',p, (p.media.count()))
    #     for choice in p.quizzes.first().choices.all():
    #         print('+', '[v]' if choice.is_correct else '', choice.choice_text)

