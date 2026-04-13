from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import User
from .models import StudySession, User

@api_view(['GET', 'POST'])
def get_users(request):
    if request.method == 'GET':
        users = User.objects.all().values()
        return Response(list(users))

    elif request.method == 'POST':
        data = request.data

        username = data.get('username')
        email = data.get('email')

        # 🔥 Basic validation (prevents crashes)
        if not username or not email:
            return Response({"error": "Missing fields"}, status=400)

        user = User.objects.create(
            username=username,
            email=email
        )

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email
        })

@api_view(['GET', 'POST'])
def study_sessions(request):
    if request.method == 'GET':
        sessions = StudySession.objects.all()

        data = [
            {
                "id": session.id,
                "user": session.user.username,
                "user_id": session.user.id,
                "duration": session.duration,
                "subject": session.subject,
                "caption": session.caption,
            }
            for session in sessions
        ]

        return Response(data)

    elif request.method == 'POST':
        data = request.data

        session = StudySession.objects.create(
            user_id=data.get('user'),
            duration=data.get('duration'),
            subject=data.get('subject'),
            caption=data.get('caption')
        )

        return Response({
            "id": session.id,
            "user": session.user.username,
            "user_id": session.user.id,
            "duration": session.duration,
            "subject": session.subject,
            "caption": session.caption,
        })