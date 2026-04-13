from django.urls import path
from .views import get_users, study_sessions, login_user

urlpatterns = [
    path('', get_users),
    path('sessions/', study_sessions),
    path('login/', login_user),  # 👈 IMPORTANT
]