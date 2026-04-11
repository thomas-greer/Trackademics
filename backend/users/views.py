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
        sessions = StudySession.objects.all()

        data = [
            {
                "id": session.id,
                "user": session.user.username,  # 👈 THIS is the fix
                "user_id": session.user.id,     # keep this for filtering
                "duration": session.duration,
                "subject": session.subject
            }
            for session in sessions
        ]

        return Response(data)

    elif request.method == 'POST':
        data = request.data

        session = StudySession.objects.create(
            user_id=data.get('user'),
            duration=data.get('duration'),
            subject=data.get('subject')
        )

        return Response({
            "id": session.id,
            "user": session.user.username,
            "user_id": session.user.id,
            "duration": session.duration,
            "subject": session.subject
        })