from django.urls import path
from .views import get_users, study_sessions

urlpatterns = [
    path('', get_users),
    path('sessions/', study_sessions),
]