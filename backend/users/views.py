from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import IntegrityError
from .models import Post, Comment, UserStats, Follower

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


def _serialize_user(user, viewer=None):
    stats = _sync_user_stats(user)
    followers_count = Follower.objects.filter(following=user).count()
    following_count = Follower.objects.filter(follower=user).count()
    is_following = False

    if viewer and viewer.id != user.id:
        is_following = Follower.objects.filter(
            follower=viewer,
            following=user
        ).exists()

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "stats": {
            "current_streak": stats.current_streak,
            "best_streak": stats.best_streak,
        },
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following,
    }


@api_view(['GET', 'POST'])
def get_users(request):
    if request.method == 'GET':
        users = User.objects.all()
        viewer_id = request.query_params.get("viewer_id")
        viewer = User.objects.filter(id=viewer_id).first() if viewer_id else None

        data = [
            _serialize_user(u, viewer=viewer)
            for u in users
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
            },
            "followers_count": 0,
            "following_count": 0,
            "is_following": False,
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
            },
            "followers_count": Follower.objects.filter(following=user).count(),
            "following_count": Follower.objects.filter(follower=user).count(),
            "is_following": False,
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


@api_view(['GET'])
def user_profile(request, user_id):
    viewer_id = request.query_params.get("viewer_id")
    viewer = User.objects.filter(id=viewer_id).first() if viewer_id else None

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    return Response(_serialize_user(user, viewer=viewer))


@api_view(['GET'])
def user_connections(request, user_id):
    connection_type = request.query_params.get("type")
    if connection_type not in ["followers", "following"]:
        return Response(
            {"error": "type must be 'followers' or 'following'"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    try:
        if connection_type == "followers":
            relationships = Follower.objects.select_related("follower").filter(following=user)
            users = [rel.follower for rel in relationships]
        else:
            relationships = Follower.objects.select_related("following").filter(follower=user)
            users = [rel.following for rel in relationships]

        data = [
            {
                "id": related_user.id,
                "username": related_user.username,
            }
            for related_user in users
        ]

        return Response({
            "type": connection_type,
            "count": len(data),
            "users": data,
        })
    except Exception as exc:
        return Response(
            {"error": f"Unexpected server error: {str(exc)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST', 'DELETE'])
def user_follow(request, user_id):
    follower_id = request.data.get("follower_id") or request.query_params.get("follower_id")
    if not follower_id:
        return Response(
            {"error": "follower_id is required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        follower_id = int(follower_id)
    except (TypeError, ValueError):
        return Response(
            {"error": "follower_id must be a valid integer"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        follower = User.objects.get(id=follower_id)
        following = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    if follower.id == following.id:
        return Response(
            {"error": "You cannot follow yourself"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        if request.method == 'POST':
            Follower.objects.get_or_create(follower=follower, following=following)
        else:
            Follower.objects.filter(follower=follower, following=following).delete()
    except IntegrityError:
        return Response(
            {"error": "Could not update follow relationship"},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as exc:
        return Response(
            {"error": f"Unexpected server error: {str(exc)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return Response(_serialize_user(following, viewer=follower))