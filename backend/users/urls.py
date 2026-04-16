from django.urls import path
from .views import (
    get_users,
    study_sessions,
    login_user,
    session_comments,
    session_delete,
    user_profile,
    user_profile_update,
    user_study_analytics,
    community_study_stats,
    user_connections,
    user_follow,
)

urlpatterns = [
    path('', get_users),
    path('community-stats/', community_study_stats),
    path('<int:user_id>/study-analytics/', user_study_analytics),
    path('<int:user_id>/edit-profile/', user_profile_update),
    path('<int:user_id>/', user_profile),
    path('<int:user_id>/connections/', user_connections),
    path('<int:user_id>/follow/', user_follow),
    path('sessions/', study_sessions),
    path('sessions/<int:session_id>/comments/', session_comments),
    path('sessions/<int:session_id>/', session_delete),
    path('login/', login_user),  # 👈 IMPORTANT
]