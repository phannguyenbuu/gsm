from django.contrib import admin
from .models import Chapter, Post, Comment, Choice,Quiz,PostMedia

admin.site.register(Chapter)
admin.site.register(Post)
admin.site.register(Comment)
admin.site.register(Choice)
admin.site.register(Quiz)
admin.site.register(PostMedia)

# python manage.py migrate --database=default
# python manage.py migrate --database=real
# python manage.py migrate --database=ecomove



# class ChapterAdmin(admin.ModelAdmin):
#     # Hiển thị các trường bạn muốn trong danh sách
#     list_display = ('title', 'created_at', 'total_chapters')

#     class Meta:
#         verbose_name = "Chương"
#         verbose_name_plural = "Các chương"

#     def add_view(self, request, form_url='', extra_context=None):
#         extra_context = extra_context or {}
#         extra_context['title'] = _('Thêm chương mới')  # Đổi tiêu đề trang add
#         return super().add_view(request, form_url, extra_context=extra_context)

#     # Thêm một method để hiển thị tổng số chapter
#     def total_chapters(self, obj):
#         # Trả về tổng số chapter (có thể là tổng tất cả hoặc theo logic bạn muốn)
#         return Chapter.objects.count()
#     total_chapters.short_description = 'Total_Tổng số Chapter'

# admin.site.register(Chapter, ChapterAdmin)

#@baoLong0511