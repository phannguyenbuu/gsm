from django.db import models
from django.contrib.auth.models import User
import json
import re
import random
from datetime import datetime

def convertDateTime(text):
    text = text.replace("Remind at:","").strip()
    match = re.search(r'([\d/]+, \d{1,2}:\d{2}:\d{2} [AP]M)', text)

    if match:
        date_str = match.group(1)  # '6/27/2025, 11:00:19 PM'
        
        # 2. Chuyển chuỗi thành datetime object
        dt = datetime.strptime(date_str, '%m/%d/%Y, %I:%M:%S %p')
        
        # 3. Định dạng lại theo chuẩn YYYY-MM-DD HH:MM:SS (24h)
        formatted = dt.strftime('%Y-%m-%d %H:%M:%S')
        
        print('Ngày giờ chuẩn:', formatted)
        return formatted
    else:
        print('Không tìm thấy ngày giờ hợp lệ trong chuỗi.')

    return None

class Chapter(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def _getAllPost(self):
        posts_list = []
        for post in self.posts.all():
            media_list = []
            for media in post.media.all():
                media_list.append({
                    'id': media.id,
                    'media_type': media.media_type,
                    'url': media.url,
                    'thumbnail_url': media.thumbnail_url,
                })

                # Lấy comment của post
                

            posts_list.append({
                'id': post.id,
                'title': post.title,
                'content': post.content,
                'author': post.author.username,
                'remind_at': post.remind_at.isoformat() if post.remind_at else '',
                'starRate': post.rates,
                'post_media': media_list,  # Thêm danh sách media vào đây
                
            })
        # Trả về chuỗi JSON
        return json.dumps(posts_list, ensure_ascii=False)
    
    def __str__(self):
        return self.title



class Post(models.Model):
    hint = models.CharField(max_length=50,default='',null=True, blank=True)
    key = models.CharField(max_length=50, primary_key=True)
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name='posts',null=True,blank=True)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts',null=True,blank=True)
    title = models.CharField(max_length=255)  # Tiêu đề bài học
    content = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    remind_at = models.DateTimeField(null=True, blank=True)
    rates = models.IntegerField(default=0)

    layout_x = models.IntegerField(default=0)
    layout_y = models.IntegerField(default=0)

    def randomMedia(self):
        return self.media.all()[random.randint(0,4)].url

    def Choice(self):
        import random
        choices = list(self.quizzes.first().choices.all())
        random.shuffle(choices)

        return choices

    def _applyData(self, data):
        
        # links = data.get('links')
        
        self.title = data.get('title')
        self.content = data.get('content')
        self.remind_at = convertDateTime(data.get('remind'))
        self.rates = data.get('rate')
        self.save()


    def _getAllComments(self):
        comments_list = []
        for comment in self.comments.all():
            # Lấy media của comment (nếu có)
            comment_media_list = []
            for cmedia in comment.media.all():
                comment_media_list.append({
                    'id': cmedia.id,
                    'media_type': cmedia.media_type,
                    'file_url': cmedia.file.url if cmedia.file else None,
                    'url': cmedia.url,
                    'thumbnail_url': cmedia.thumbnail_url,
                })

            comments_list.append({
                'id': comment.id,
                'author': comment.author.username,
                'content': comment.content,
                'created_at': comment.created_at.isoformat(),
                'starRate': comment.rates,
                'remind_at': comment.remind_at.isoformat() if comment.remind_at else '',
                'quiz_id': comment.quiz.id if comment.quiz else None,
                'quizOptions': [
                    {
                        'id': choice.id,
                        'choice_text': choice.choice_text,
                        'is_correct': 'Y' if choice.is_correct else 'N',
                    }
                    for choice in comment.quiz.choices.all()]  if comment.quiz else None,
                'media': comment_media_list,
                
                # Bạn có thể thêm đệ quy lấy replies nếu cần
            })
        return json.dumps(comments_list, ensure_ascii=False)
    
    def __str__(self):
        return f"{self.key}={self.title}"
    
class Quiz(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='quizzes')
    question_text = models.TextField()  # Câu hỏi trắc nghiệm
    created_at = models.DateTimeField(auto_now_add=True)
    remind_at = models.DateTimeField(null=True, blank=True)
    

    def __str__(self):
        return f"Quiz for {self.post.title}: {self.question_text[:50]}"

class Choice(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='choices')
    choice_text = models.CharField(max_length=255)  # Nội dung lựa chọn (a,b,c,d)
    is_correct = models.BooleanField(default=False)  # Đánh dấu đáp án đúng

    def __str__(self):
        return f"{self.choice_text} ({'Correct' if self.is_correct else 'Wrong'})"
    
class PostMedia(models.Model):
    MEDIA_TYPE_CHOICES = (
        ('image', 'Image'),
        ('file', 'File'),
        ('video', 'Video'),
        ('link', 'Link'),
    )
    # Một media liên kết với 1 post hoặc 1 comment, chỉ một trong hai được set
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='media', null=True, blank=True)
    comment = models.ForeignKey('Comment', on_delete=models.CASCADE, related_name='media', null=True, blank=True)
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES)
    file = models.FileField(upload_to='post_media/', blank=True, null=True)  # cho hình ảnh, video, file
    url = models.URLField(blank=True, null=True)  # cho link
    thumbnail_url = models.URLField(blank=True, null=True)  # cho link
    title = models.CharField(max_length=255, null=True, blank=True)


    def _applyData(self, data):
        self.title = data.get('title')
        self.content = data.get('content')
        self.remind_at = convertDateTime(data.get('remind'))
        self.rates = data.get('rate')
        self.save()

    def __str__(self):
        target = self.post or self.comment
        return f"{self.title} - {self.media_type} for {'Post' if self.post else 'Comment'}"

class Comment(models.Model):
    title = models.CharField(max_length=255, null=True, blank=True)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    remind_at = models.DateTimeField(null=True, blank=True)
    rates = models.IntegerField(default=0)
    quiz = models.ForeignKey(Quiz, on_delete=models.SET_NULL, null=True, blank=True, related_name='comments')

    def __str__(self):
        return f"Comment by {self.author.username} on Post {self.post.id}"

    def _applyData(self, data):
        
        # links = data.get('links')
        
        self.title = data.get('title')
        self.content = data.get('content')
        self.remind_at = convertDateTime(data.get('remind'))
        self.rates = data.get('rate')
        self.save()
