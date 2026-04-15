from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.utils import timezone
from .models import Post, Comment, UserStats

from datetime import timedelta


def _calculate_streaks_for_user(user):
    today = timezone.localdate()
    post_dates = sorted(
        {post.created_at.date() for post in Post.objects.filter(user=user)},
        reverse=True
    )

    if not post_dates:
        return 0, 0

    current_streak = 0
    if post_dates[0] == today:
        current_streak = 1
        expected_date = today - timedelta(days=1)
        for post_date in post_dates[1:]:
            if post_date == expected_date:
                current_streak += 1
                expected_date -= timedelta(days=1)
            else:
                break

    best_streak = 1
    running_streak = 1
    for previous_date, current_date in zip(post_dates, post_dates[1:]):
        if current_date == previous_date - timedelta(days=1):
            running_streak += 1
        else:
            running_streak = 1
        best_streak = max(best_streak, running_streak)

    return current_streak, best_streak


def _sync_user_stats(user):
    user_stats, _ = UserStats.objects.get_or_create(user=user)
    current_streak, best_streak = _calculate_streaks_for_user(user)

    if user_stats.current_streak != current_streak or user_stats.best_streak != best_streak:
        user_stats.current_streak = current_streak
        user_stats.best_streak = best_streak
        user_stats.save(update_fields=["current_streak", "best_streak"])

    return user_stats


@api_view(['GET', 'POST'])
def get_users(request):
    if request.method == 'GET':
        users = User.objects.all()

        data = [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "stats": {
                    "current_streak": stats.current_streak,
                    "best_streak": stats.best_streak,
                }
            }
            for u in users
            for stats in [_sync_user_stats(u)]
        ]

        return Response(data)

    elif request.method == 'POST':
        data = request.data
        user = User.objects.create(
            username=data.get('username'),
            email=data.get('email')
        )

        stats = _sync_user_stats(user)

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "stats": {
                "current_streak": stats.current_streak,
                "best_streak": stats.best_streak
            }
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

        # Recompute from post dates so streak increases once per day and resets correctly.
        user_stats = _sync_user_stats(session.user)

        return Response({
            "id": session.id,
            "user": session.user.username,
            "user_id": session.user.id,
            "duration": session.duration_minutes,
            "subject": session.category,
            "caption": session.caption,
            "created_at": session.created_at,
            "comments": [],
            "current_streak": user_stats.current_streak,
            "best_streak": user_stats.best_streak,
        })


@api_view(['POST'])
def login_user(request):
    email = request.data.get('email')

    try:
        user = User.objects.get(email=email)
        stats = _sync_user_stats(user)

        return Response({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "stats": {
                "current_streak": stats.current_streak,
                "best_streak": stats.best_streak,
            }
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