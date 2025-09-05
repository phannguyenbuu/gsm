
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponseBadRequest, FileResponse, Http404
from django.core.serializers import serialize
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.conf import settings
from django.contrib.auth.models import User

import json
import os
import platform
import re
import subprocess
from time import sleep

from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from django.template import Template, Context, engines
from django.utils.safestring import mark_safe

from core.models import Chapter, Post, Comment, Choice,Quiz,PostMedia
import ast
import json
from django.http import JsonResponse
from django.core.exceptions import ObjectDoesNotExist

import random
from datetime import datetime, date

class ShowLearn():
    def __init__(self, request, db_name, page_count = 0, imagelist = []):
        self.id = request.GET.get('id')

        try:
            
            post = Post.objects.using(db_name).get(key=self.id)
            
        except Post.DoesNotExist:
            self.context = {}
            return None
        
        print(Post.objects.using(db_name).count(), db_name, self.id, post)

        media_qs = post.media.all()
        background_img = media_qs[0].url if media_qs.exists() else ''

        # words = ["personality","academic","psychological","interests","career","support","iq","eq","sports"]

        self.images = imagelist
        
        comments = []
        for i, comment in enumerate(post.comments.all()):
            # if comment.title == "Điểm":
            #     # print(comment.content)
            #     dict = {}
            #     data_dict = ast.literal_eval(comment.content)

            #     for k, v in data_dict.items():
            #         dict[k] = str(v)

            #     items.append({
            #         'title': comment.title,
            #         'content': dict,
            #         'url': self.images[i],
            #     })

            # else:
            comments.append({'title':comment.title,
                            'content': comment.content,
                            'url': self.images[i],
            })

        self.context = {
            'item': post,
            'page_title': post.title,
            'page_content': post.content,
            'comments': comments,
            'backgroundImg': background_img,
            'pages': Post.objects.count() if page_count == 0 else page_count,
            'text_shadow': "text-shadow: 0px 0px 5px rgba(0, 0, 0, 1);",
            'images': self.images,
        }

@csrf_exempt
def upload_image(request):
    if request.method == 'POST' and request.FILES.get('image'):
        image = request.FILES['image']
        save_path = os.path.join(settings.MEDIA_ROOT, 'images')
        os.makedirs(save_path, exist_ok=True)
        file_path = os.path.join(save_path, image.name)

        with open(file_path, 'wb+') as destination:
            for chunk in image.chunks():
                destination.write(chunk)

        url = request.build_absolute_uri(settings.MEDIA_URL + 'images/' + image.name)
        return JsonResponse({'url': url})

    return JsonResponse({'error': 'No image file provided'}, status=400)

@csrf_exempt
def upload_document(request):
    if request.method == 'POST' and request.FILES.get('document'):
        document = request.FILES['document']
        save_path = os.path.join(settings.MEDIA_ROOT, 'documents')
        os.makedirs(save_path, exist_ok=True)
        file_path = os.path.join(save_path, document.name)

        with open(file_path, 'wb+') as destination:
            for chunk in document.chunks():
                destination.write(chunk)

        url = request.build_absolute_uri(settings.MEDIA_URL + 'documents/' + document.name)
        return JsonResponse({'url': url})

    return JsonResponse({'error': 'No document file provided'}, status=400)


@csrf_exempt  # Nếu bạn chưa xử lý CSRF token, nhớ bảo mật sau nhé
def save_post_content(request, data_type):
    if request.method == 'POST':
        try:
            data = json.loads(request.body.decode('utf-8'))
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Dữ liệu JSON không hợp lệ'}, status=400)

        
        post_id = data.get('post_id')
        print(data_type, post_id)
        
        if not post_id:
            return JsonResponse({'error': 'Thiếu dữ liệu'}, status=400)

        model = Chapter

        if data_type == 1:
            model = Post
        elif data_type == 2:
            model = Comment
        elif data_type == 3:
            model = PostMedia

        post = get_object_or_404(model, id=post_id)
        post._applyData(data)
        print('POST_SAVE',post_id)
        post.save()

        return JsonResponse({'status': 'success', 'message': 'Lưu thành công'})

    return JsonResponse({'error': 'Phương thức không hợp lệ'}, status=405)

from django.http import JsonResponse, HttpResponseNotAllowed

@csrf_exempt
def remove_post_content(request, pk):
    if request.method != 'DELETE':
        return HttpResponseNotAllowed(['DELETE'])
    
    
    
    post = get_object_or_404(pk, pk=pk.split('-')[-1])
    print(post)
    post.delete()
    return JsonResponse({'status': 'success', 'message': 'Post deleted successfully'})

@csrf_exempt  # Chỉ dùng nếu bạn không dùng CSRF token, không khuyến khích
def search_view(request):
    query = request.GET.get('word')
    value_lower = query.lower()

    # Tìm bản ghi có key chính xác (case-insensitive)
    words = Post.objects.filter(key__iexact=value_lower)

    # Nếu không có bản ghi chính xác, tìm bản ghi chứa chuỗi
    if not words.exists():
        words = Post.objects.filter(key__icontains=value_lower)

    # Lọc distinct theo key thủ công
    seen_keys = set()
    unique_posts = []
    for post in words:
        if post.key not in seen_keys:
            seen_keys.add(post.key)
            unique_posts.append(post)

    words = unique_posts
    for i, lp in enumerate(words):
        lp.layout_x = i * 500
        lp.save()


    print('search', len(words))

    context = {
        'lesson_score': 0,
        'dateIndex': 0,

        'words_count': len(words),
        'mode':'search',
        'words': words,
        'backgroundImg': words[0].media.all()[0].url,
        'title': f"SEARCH {len(words)} RESULTS",
    }

    return render(request, 'learn.html', context)


@csrf_exempt  # Chỉ dùng khi test, sang prod cần CSRF token đầy đủ nhé
def post_property(request):
    if request.method == "POST":
        # Lấy dữ liệu từ form
        data = {
            "title": request.POST.get("title"),
            "location": request.POST.get("location"),
            "area": int(request.POST.get("area", 0)),
            "levels": int(request.POST.get("levels", 0)),
            "total_area": int(request.POST.get("total_area", 0)),
            "direction": request.POST.get("direction"),
            "transaction_type": request.POST.get("transaction_type"),
            "price": int(request.POST.get("price", 0)),
            "legal_status": request.POST.get("legal_status"),
            "nearby": request.POST.getlist("nearby"),  # lấy list checkbox
            "description": request.POST.get("description", ""),
            "contact_info_1": request.POST.get("contact_info_1"),
            "contact_info_2": request.POST.get("contact_info_2"),
            "contact_info_3": request.POST.get("contact_info_3"),
            "contact_info_mail": request.POST.get("contact_info_mail"),
        }

        # # Đọc dữ liệu cũ từ file JSON nếu có
        # try:
        #     with open(DATA_FILE, "r", encoding="utf-8") as f:
        #         properties = json.load(f)
        # except (FileNotFoundError, json.JSONDecodeError):
        #     properties = []

        # # Thêm dữ liệu mới
        # properties.append(data)

        # # Ghi lại vào file JSON
        # os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        # with open(DATA_FILE, "w", encoding="utf-8") as f:
        #     json.dump(properties, f, ensure_ascii=False, indent=2)

        return JsonResponse({"status": "success", "message": "Đăng tin thành công!", "data": data})
    else:
        return JsonResponse({"status": "fail", "message": "Phương thức không hợp lệ. Vui lòng dùng POST."})
    


def get_default_view_content(bk_index, color_1, color_2):
    shortcuts = list(Post.objects.get(key="TopShortcut").quizzes.all())
    user = User.objects.first()
    images = [itm.url for itm in Post.objects.get(key='BackgroundImages').media.all()]

    return {
            'color_1': color_1,
            'color_2': color_2,
            'title2': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'user': user,
            'social_buttons': Post.objects.get(key="SocialButton").quizzes.all(),
            'menus': Post.objects.get(key="MainMenu").quizzes.all(),
            'shortcuts': [shortcuts[0],shortcuts[2]],
            'last_shortcuts': shortcuts[1],
            'top_phone': user.last_name.replace("<br>","     |     "),
            'text_shadow':'text-shadow: 0px 0px 4px rgba(0, 0, 0, 1);',
            'black_shadow':"""content: "";position: absolute;inset: 0;top:0; right:0; bottom:0; left:0;background-color: rgba(0, 0, 0, 0.8);pointer-events: none;z-index: 1;""",
            'images':images,
            'bk':images[bk_index],
        }


def get_nav_data(key):
    post = Post.objects.using('db_ecomove').get(key=key)

    if post:
        navtabs = [{
            'title': itm.title,
            'description': itm.description,
            'index': i,
        } for i,itm in enumerate(post.quizzes.all())]
        
        for itm in navtabs:
            medias = list(post.media.all())

            if len(medias) > itm['index']:
                media = medias[itm['index']]
                itm['url'] = media.url
                media.title = itm['title']
                media.description = itm['description']
                media.save()

        return {'title':post.title, 'tabs':navtabs}
    else:
        return {}