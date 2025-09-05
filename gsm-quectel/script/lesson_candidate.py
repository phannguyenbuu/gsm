import random
from collections import defaultdict
from datetime import date, timedelta

import os
import django
import random
from datetime import timedelta
from django.utils import timezone
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'myproject.settings')
django.setup()

from core.models import Chapter, Post, Comment, Choice,Quiz,PostMedia, Lesson, LessonWordProgress
from django.contrib.auth.models import User
from django.db import transaction

levels = {
    'A': {'wordsPerDay': (5, 15), 'daysRepeat': (10,14), 'repeatTime': 5},
    'B': {'wordsPerDay': (15, 30), 'daysRepeat': (7,10), 'repeatTime': 4},
    'C': {'wordsPerDay': (30, 50), 'daysRepeat': (3,6), 'repeatTime': 3},
}

total_words = 3000
word_ids = list(range(total_words))

def generate_review_days_with_number(start_day, days_repeat, repeat_time):
    days = [(start_day, 1)]  # (ngày, remind_number)
    for i in range(2, repeat_time + 1):
        interval = random.randint(*days_repeat)
        days.append((days[-1][0] + interval, i))
    return days

def create_level_schedule(level):
    params = levels[level]
    words_per_day_min, words_per_day_max = params['wordsPerDay']
    days_repeat = params['daysRepeat']
    repeat_time = params['repeatTime']

    words_per_day = (words_per_day_min + words_per_day_max) // 2
    total_days = (total_words + words_per_day - 1) // words_per_day

    schedule = defaultdict(list)  # ngày -> list (level, word_id, remind_number)

    for day_offset in range(total_days):
        start_idx = day_offset * words_per_day
        end_idx = min(start_idx + words_per_day, total_words)
        words_today = word_ids[start_idx:end_idx]

        for word in words_today:
            review_days = generate_review_days_with_number(day_offset, days_repeat, repeat_time)
            for rd, remind_number in review_days:
                schedule[rd].append((level, word, remind_number))

    return schedule

def merge_schedules(schedules):
    merged = defaultdict(list)
    for sched in schedules:
        for day, items in sched.items():
            merged[day].extend(items)
    return merged

def create_learning_path(start_level='A'):
    levels_order = ['A', 'B', 'C']
    start_index = levels_order.index(start_level)
    active_levels = levels_order[start_index:]

    schedules = []
    for level in active_levels:
        sched = create_level_schedule(level)
        schedules.append(sched)

    merged_schedule = merge_schedules(schedules)
    return merged_schedule

# def create_normal_data():
#     for start_level in ['A', 'B', 'C']:
#         print(f"\n=== Lộ trình học bắt đầu từ cấp độ {start_level} ===\n")
#         schedule = create_learning_path(start_level)

#         for day in sorted(schedule.keys()):
#             level_dict = {}
#             for level, word_id, remind_number in schedule[day]:
#                 if level not in level_dict:
#                     level_dict[level] = []
#                 if remind_number == 1:
#                     level_dict[level].append(str(word_id))
#                 else:
#                     level_dict[level].append(f"{word_id}(r{remind_number})")

#             for level in sorted(level_dict.keys()):
#                 words = level_dict[level]
#                 print(f"Level {level} - Day {day} - Số từ: {len(words)} - Words: {', '.join(words)}")

#         print(f"\nTổng số ngày học: {max(schedule.keys()) + 1}")

from datetime import datetime, date, timedelta
from django.db import transaction

def create_lesson_data(user, level, date_index, schedule, indexes):
    """
    Tạo Lesson và LessonWordProgress cho user dựa trên lịch học schedule.

    Args:
        user: instance User
        level: string 'A'|'B'|'C'
        date_index: int, số thứ tự ngày học (day offset)
        schedule: dict {day_offset: [(level, word_id, remind_number), ...]}.

    Trả về:
        lesson: instance Lesson vừa tạo hoặc None nếu không có dữ liệu ngày đó.
    """

    if schedule is None:
        raise ValueError("Bạn cần truyền đầy đủ schedule")

    if date_index not in schedule:
        print(f"Không có bài học cho ngày thứ {date_index}")
        return None

    posts_in_day = [item for item in schedule[date_index] if item[0] == level]

    if not posts_in_day:
        print(f"Không có bài học cho level {level} ngày thứ {date_index}")
        return None

    with transaction.atomic():
        lesson, created = Lesson.objects.get_or_create(
            user=user,
            level=level,
            dateindex=date_index
        )

        progresses = []
        for _, word_id, remind_number in posts_in_day:
            progress = LessonWordProgress(
                lesson=lesson,
                word_id=str(indexes[word_id]),
                level=level,
                remind_number=remind_number,
                score=0,
                max_score=LessonWordProgress.REMIND_POINTS.get(remind_number, 0),
                # answered_correctly mặc định False
            )
            progresses.append(progress)

        LessonWordProgress.objects.bulk_create(progresses)

    print(f"Tạo Lesson cho user {user.username} level {level} ngày thứ {date_index} với {len(progresses)} từ.")
    return lesson


    
username = 'kmvuong'
password = '123456'

user, created = User.objects.get_or_create(username=username)
if created:
    user.set_password(password)
    user.save()
    print(f"Đã tạo user mới: {username}")
else:
    print(f"User {username} đã tồn tại")


from datetime import date, timedelta

def create_lesson():
    LessonWordProgress.objects.all().delete()
    Lesson.objects.all().delete()

    indexes = list(range(3000))
    random.shuffle(indexes)

    for start_level in ['A', 'B', 'C']:
        print(f"\n=== Lộ trình học bắt đầu từ cấp độ {start_level} ===\n")
        schedule = create_learning_path(start_level)

        # Lấy danh sách các ngày trong schedule
        days = sorted(schedule.keys())

        for day in days:
            # Nếu bạn vẫn muốn tính ngày thực tế:
            # lesson_date = start_date + timedelta(days=day)

            # Tạo lesson theo date_index và level
            create_lesson_data(user, start_level, day, schedule, indexes)

# create_lesson()


# print(Lesson.objects.count(), LessonWordProgress.objects.count())
# print(Lesson.objects.filter(user__username="kmvuong", level="C").count())
# # for lesson in LessonWordProgress.objects.all():
# #     print(lesson)
lessons = Lesson.objects.filter(user__username="kmvuong", level="A").all()



for i,lesson in enumerate(lessons):
    
    s =''
    # print(lesson)
    for itm in lesson.word_progresses.all():
        s += f"{itm.word_id},"

    if i == 20:
        print(i, s)
        print(lesson.get_all_remind_words('A'))

# user = User.objects.get(username='kmvuong')

# level = user.first_name
# print(user.username, level)

# word = Post.objects.get(key='hit')
# for m in word.media.all():
#     print(m.url)

# user = User.objects.get(username='kmvuong')
# level = user.first_name
# print(level)

# lessons = Lesson.objects.filter(user__username="kmvuong", level=level).all()
# lesson = lessons[0]
# print(lesson.score)