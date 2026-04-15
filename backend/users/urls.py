from django.urls import path
from .views import get_users, study_sessions, login_user, session_comments

urlpatterns = [
    path('', get_users),
    path('sessions/', study_sessions),
    path('sessions/<int:session_id>/comments/', session_comments),
    path('login/', login_user),  # 👈 IMPORTANT
]