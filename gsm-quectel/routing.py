# yourapp/routing.py

from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/updates/$", consumers.WebhookConsumer.as_asgi()),
    re_path(r"ws/control/$", consumers.UnityControlConsumer.as_asgi()),
    re_path(r"ws/orders/(?P<client_id>\w+)/$", consumers.OrderConsumer.as_asgi()),
]
