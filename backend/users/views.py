from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from .models import Post, Comment


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
        sessions = Post.objects.select_related("user").prefetch_related(
            "comments__user"
        ).all().order_by('-created_at')

        data = [
            {
                "id": s.id,
                "user": s.user.username,
                "user_id": s.user.id,
                "duration": s.duration_minutes,
                "subject": s.category,
                "caption": s.caption,
                "created_at": s.created_at,
                "comments": [
                    {
                        "id": c.id,
                        "user": c.user.username,
                        "user_id": c.user.id,
                        "content": c.content,
                        "created_at": c.created_at,
                    }
                    for c in s.comments.all().order_by("created_at")
                ],
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
            "comments": [],
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


@api_view(['GET', 'POST'])
def session_comments(request, session_id):
    try:
        post = Post.objects.get(id=session_id)
    except Post.DoesNotExist:
        return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        comments = post.comments.select_related("user").all().order_by("created_at")
        return Response([
            {
                "id": c.id,
                "user": c.user.username,
                "user_id": c.user.id,
                "content": c.content,
                "created_at": c.created_at,
            }
            for c in comments
        ])

    data = request.data
    user_id = data.get("user")
    content = data.get("content")

    if not user_id:
        return Response(
            {"error": "user is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    if not content or not str(content).strip():
        return Response(
            {"error": "content is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    comment = Comment.objects.create(
        post=post,
        user=user,
        content=str(content).strip(),
    )

    return Response(
        {
            "id": comment.id,
            "post_id": post.id,
            "user": comment.user.username,
            "user_id": comment.user.id,
            "content": comment.content,
            "created_at": comment.created_at,
        },
        status=status.HTTP_201_CREATED
    )