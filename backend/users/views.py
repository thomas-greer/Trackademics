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

        username = data.get('username')
        email = data.get('email')

        # 🔥 Basic validation (prevents crashes)
        if not username or not email:
            return Response({"error": "Missing fields"}, status=400)

        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists"}, status=400)

        user = User.objects.create(username=username, email=email)

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email
        })

@api_view(['GET', 'POST'])
def study_sessions(request):
    if request.method == 'GET':
        sessions = Post.objects.select_related("user").all()

        data = [
            {
                "id": session.id,
                "user": session.user.username,
                "user_id": session.user.id,
                "duration": session.duration_minutes,
                "subject": session.category,
                "caption": session.caption,
            }
            for session in sessions
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
        })

@api_view(['POST'])
def login_user(request):
    data = request.data
    email = data.get('email')

    if not email:
        return Response({"error": "Email required"}, status=400)

    try:
        user = User.objects.get(email=email)

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email
        })

    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=404)