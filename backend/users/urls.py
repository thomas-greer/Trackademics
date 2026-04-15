from django.urls import path
from .views import (
    get_users,
    study_sessions,
    login_user,
    session_comments,
    user_profile,
    user_connections,
    user_follow,
)

urlpatterns = [
    path('', get_users),
    path('<int:user_id>/', user_profile),
    path('<int:user_id>/connections/', user_connections),
    path('<int:user_id>/follow/', user_follow),
    path('sessions/', study_sessions),
    path('sessions/<int:session_id>/comments/', session_comments),
    path('login/', login_user),  # 👈 IMPORTANT
]