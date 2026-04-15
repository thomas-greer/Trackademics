from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import Post


@api_view(['GET', 'POST'])
def get_users(request):
    if request.method == 'GET':
        users = User.objects.all().values("id", "username", "email")
        return Response(list(users))

    elif request.method == 'POST':
        data = request.data
        user = User.objects.create(
            username=data.get('username'),
            email=data.get('email')
        )

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email
        })


@api_view(['GET', 'POST'])
def study_sessions(request):
    if request.method == 'GET':
        sessions = Post.objects.select_related("user").all().order_by('-created_at')

        data = [
            {
                "id": s.id,
                "user": s.user.username,
                "user_id": s.user.id,
                "duration": s.duration_minutes,
                "subject": s.category,
                "caption": s.caption,
                "created_at": s.created_at,
            }
            for s in sessions
        ]

        return Response(data)

    elif request.method == 'POST':
        data = request.data

        session = Post.objects.create(
            user_id=data.get('user'),
            duration_minutes=data.get('duration'),
            category=data.get('subject'),
            caption=data.get('caption')
        )

        return Response({
            "id": session.id,
            "user": session.user.username,
            "user_id": session.user.id,
            "duration": session.duration_minutes,
            "subject": session.category,
            "caption": session.caption,
            "created_at": session.created_at,
        })


@api_view(['POST'])
def login_user(request):
    email = request.data.get('email')

    try:
        user = User.objects.get(email=email)

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email
        })

    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=404)