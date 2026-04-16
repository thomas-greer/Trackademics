from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.utils import timezone
from django.db import DatabaseError, IntegrityError, transaction
from django.db.utils import OperationalError, ProgrammingError
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db.models import Count, IntegerField, Prefetch, Q, Sum, Value
from django.db.models.functions import Coalesce
from .models import (
    Comment,
    Conversation,
    ConversationParticipant,
    Follower,
    Notification,
    Message,
    Post,
    PostLike,
    UserProfile,
    UserStats,
)

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


def _avatar_url(request, user):
    """
    Avoid touching user.profile / JOINs so this stays safe if UserProfile rows
    or even the users_userprofile table are missing (migrations not applied yet).
    """
    try:
        row = UserProfile.objects.filter(user_id=user.pk).only("avatar").first()
    except (ProgrammingError, OperationalError, DatabaseError):
        return ""
    if not row or not row.avatar or not row.avatar.name:
        return ""
    try:
        return request.build_absolute_uri(row.avatar.url)
    except Exception:
        return ""


def _sync_user_stats(user):
    user_stats, _ = UserStats.objects.get_or_create(user=user)
    current_streak, best_streak = _calculate_streaks_for_user(user)

    if user_stats.current_streak != current_streak or user_stats.best_streak != best_streak:
        user_stats.current_streak = current_streak
        user_stats.best_streak = best_streak
        user_stats.save(update_fields=["current_streak", "best_streak"])

    return user_stats


def _serialize_user(request, user, viewer=None):
    stats = _sync_user_stats(user)
    followers_count = Follower.objects.filter(following=user).count()
    following_count = Follower.objects.filter(follower=user).count()
    is_following = False

    if viewer and viewer.id != user.id:
        is_following = Follower.objects.filter(
            follower=viewer,
            following=user
        ).exists()

    profile_row = UserProfile.objects.filter(user_id=user.id).only("bio", "school").first()
    bio = (profile_row.bio or "").strip() if profile_row else ""
    school = (profile_row.school or "").strip() if profile_row else ""

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "bio": bio,
        "school": school,
        "avatar_url": _avatar_url(request, user),
        "stats": {
            "current_streak": stats.current_streak,
            "best_streak": stats.best_streak,
        },
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following,
    }


def _serialize_comment(request, c):
    return {
        "id": c.id,
        "user": c.user.username,
        "user_id": c.user.id,
        "user_avatar": _avatar_url(request, c.user),
        "content": c.content,
        "created_at": c.created_at,
    }


def _serialize_session_post(request, s):
    return {
        "id": s.id,
        "user": s.user.username,
        "user_id": s.user.id,
        "user_avatar": _avatar_url(request, s.user),
        "duration": s.duration_minutes,
        "subject": s.category,
        "caption": s.caption,
        "created_at": s.created_at,
        "likes_count": s.likes.count(),
        "comments": [_serialize_comment(request, c) for c in s.comments.all()],
    }


def _create_notification(recipient, actor, notif_type, text, **kwargs):
    if not recipient or not actor or recipient.id == actor.id:
        return
    Notification.objects.create(
        recipient=recipient,
        actor=actor,
        type=notif_type,
        text=text,
        **kwargs,
    )


def _is_admin_user(user):
    return bool(user and user.username == "admin" and user.email == "admin@gmail.com")


@api_view(['GET', 'POST'])
def get_users(request):
    if request.method == 'GET':
        users = User.objects.all().order_by("username")
        search = (request.query_params.get("search") or "").strip()
        if search:
            users = users.filter(username__icontains=search)[:40]

        viewer_raw = request.query_params.get("viewer_id")
        viewer = None
        if viewer_raw not in (None, ""):
            try:
                vid = int(str(viewer_raw).strip())
            except (TypeError, ValueError):
                viewer = None
            else:
                viewer = User.objects.filter(id=vid).first()

        # Hide the admin account from normal users in discovery/search lists.
        if not _is_admin_user(viewer):
            users = users.exclude(username="admin", email="admin@gmail.com")

        data = [
            _serialize_user(request, u, viewer=viewer)
            for u in users
        ]

        return Response(data)

    elif request.method == 'POST':
        data = request.data
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        school = (data.get('school') or "").strip()

        if not username or not email or not password or not school:
            return Response(
                {"error": "username, email, password, and school are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {"error": "Username already exists"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {"error": "Email already exists"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.school = school
        profile.save(update_fields=["school"])

        return Response(
            _serialize_user(request, user, viewer=user),
            status=status.HTTP_201_CREATED,
        )


@api_view(['GET', 'POST'])
def study_sessions(request):
    if request.method == 'GET':
        comment_qs = Comment.objects.select_related("user").order_by("created_at")
        base_qs = Post.objects.select_related("user").prefetch_related(
            Prefetch("comments", queryset=comment_qs),
        )

        author_id = request.query_params.get("author_id")
        viewer_id = request.query_params.get("viewer_id")

        if author_id is not None and str(author_id).strip() != "":
            try:
                aid = int(author_id)
            except (TypeError, ValueError):
                return Response(
                    {"error": "author_id must be a valid integer"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            sessions = base_qs.filter(user_id=aid).order_by("-created_at")
        elif viewer_id is not None and str(viewer_id).strip() != "":
            try:
                vid = int(viewer_id)
            except (TypeError, ValueError):
                return Response([])

            viewer = User.objects.filter(id=vid).first()
            if not viewer:
                return Response([])

            following_ids = list(
                Follower.objects.filter(follower=viewer).values_list(
                    "following_id", flat=True
                )
            )
            author_ids = list(following_ids) + [vid]
            sessions = base_qs.filter(user_id__in=author_ids).order_by("-created_at")
        else:
            sessions = base_qs.all().order_by("-created_at")

        data = [_serialize_session_post(request, s) for s in sessions]

        return Response(data)

    elif request.method == 'POST':
        data = request.data

        session = Post.objects.create(
            user_id=data.get('user'),
            duration_minutes=data.get('duration'),
            category=data.get('subject'),
            caption=data.get('caption')
        )
        session = Post.objects.select_related("user").get(pk=session.pk)

        # Recompute from post dates so streak increases once per day and resets correctly.
        user_stats = _sync_user_stats(session.user)

        payload = _serialize_session_post(request, session)
        payload["current_streak"] = user_stats.current_streak
        payload["best_streak"] = user_stats.best_streak
        return Response(payload)


@api_view(["DELETE"])
def session_delete(request, session_id):
    user_id = request.data.get("user") or request.query_params.get("user_id")
    if not user_id:
        return Response(
            {"error": "user_id is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return Response(
            {"error": "user_id must be a valid integer"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        post = Post.objects.get(id=session_id)
    except Post.DoesNotExist:
        return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

    if post.user_id != user_id:
        return Response(
            {"error": "You can only delete your own posts"},
            status=status.HTTP_403_FORBIDDEN,
        )

    author = post.user
    post.delete()
    _sync_user_stats(author)

    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
def login_user(request):
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response(
            {"error": "username and password are required"},
            status=status.HTTP_400_BAD_REQUEST
        )

    user = authenticate(username=username, password=password)
    if not user:
        return Response(
            {"error": "Invalid username or password"},
            status=status.HTTP_401_UNAUTHORIZED
        )

    _sync_user_stats(user)
    return Response(_serialize_user(request, user, viewer=user))


@api_view(['GET', 'POST'])
def session_comments(request, session_id):
    try:
        post = Post.objects.get(id=session_id)
    except Post.DoesNotExist:
        return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        comments = post.comments.select_related("user").all().order_by("created_at")
        return Response([_serialize_comment(request, c) for c in comments])

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

    payload = _serialize_comment(request, comment)
    payload["post_id"] = post.id
    _create_notification(
        recipient=post.user,
        actor=user,
        notif_type=Notification.TYPE_COMMENT,
        text=f"{user.username} commented on your post.",
        post=post,
        comment=comment,
    )
    return Response(payload, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def user_profile_update(request, user_id):
    try:
        target_id = int(user_id)
    except (TypeError, ValueError):
        return Response(
            {"error": "Invalid user id"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    viewer_raw = request.POST.get("viewer_id") or request.data.get("viewer_id")
    if viewer_raw is None or str(viewer_raw).strip() == "":
        return Response(
            {"error": "viewer_id is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        viewer_id = int(str(viewer_raw).strip())
    except (TypeError, ValueError):
        return Response(
            {"error": "viewer_id must be a valid integer"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if viewer_id != target_id:
        return Response(
            {"error": "You can only edit your own profile"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        user = User.objects.get(id=target_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    new_username = request.POST.get("username") or request.data.get("username") or user.username
    if isinstance(new_username, str):
        new_username = new_username.strip()
    if not new_username:
        return Response(
            {"error": "Username cannot be empty"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    new_email = request.POST.get("email") or request.data.get("email") or user.email
    if isinstance(new_email, str):
        new_email = new_email.strip()
    if not new_email:
        return Response(
            {"error": "Email cannot be empty"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        validate_email(new_email)
    except ValidationError:
        return Response(
            {"error": "Invalid email address"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.exclude(pk=user.pk).filter(username=new_username).exists():
        return Response(
            {"error": "Username already exists"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if User.objects.exclude(pk=user.pk).filter(email__iexact=new_email).exists():
        return Response(
            {"error": "Email already exists"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    avatar = request.FILES.get("avatar")
    new_bio = request.POST.get("bio")
    if new_bio is None:
        new_bio = request.data.get("bio")
    if isinstance(new_bio, str):
        new_bio = new_bio.strip()
    else:
        new_bio = ""
    new_school = request.POST.get("school")
    if new_school is None:
        new_school = request.data.get("school")
    if isinstance(new_school, str):
        new_school = new_school.strip()
    else:
        new_school = ""
    try:
        with transaction.atomic():
            user.username = new_username
            user.email = new_email
            user.save()
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.bio = new_bio
            profile.school = new_school
            if avatar:
                profile.avatar = avatar
            profile.save()
    except ProgrammingError as exc:
        return Response(
            {
                "error": (
                    "The database does not have the profile-picture table yet. "
                    "From your project’s backend folder, run: python manage.py migrate "
                    "(on a machine that can reach the same Postgres database your API uses). "
                    f"Technical detail: {exc}"
                )
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except (OperationalError, DatabaseError) as exc:
        return Response(
            {
                "error": (
                    "A database error occurred while saving your profile. "
                    "Confirm Postgres is reachable and run: python manage.py migrate. "
                    f"Details: {exc}"
                )
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    except Exception as exc:
        return Response(
            {
                "error": (
                    "Could not save your profile. "
                    "Install Pillow (pip install Pillow) if the server logs mention it. "
                    f"Details: {exc}"
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.get(pk=user.pk)
    return Response(_serialize_user(request, user, viewer=user))


@api_view(['GET'])
def user_profile(request, user_id):
    viewer_raw = request.query_params.get("viewer_id")
    viewer = None
    if viewer_raw not in (None, ""):
        try:
            vid = int(str(viewer_raw).strip())
        except (TypeError, ValueError):
            viewer = None
        else:
            viewer = User.objects.filter(id=vid).first()

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    # Keep admin account hidden from non-admin users.
    if user.username == "admin" and user.email == "admin@gmail.com" and not _is_admin_user(viewer):
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    return Response(_serialize_user(request, user, viewer=viewer))


@api_view(["GET"])
def user_study_analytics(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    today = timezone.localdate()

    last_7_days = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        total = Post.objects.filter(user=user, created_at__date=day).aggregate(
            s=Sum("duration_minutes")
        )["s"]
        minutes = int(total or 0)
        last_7_days.append(
            {
                "date": day.isoformat(),
                "label": day.strftime("%a"),
                "minutes": minutes,
            }
        )

    this_week_start = today - timedelta(days=today.weekday())
    last_week_start = this_week_start - timedelta(days=7)
    last_week_end = this_week_start - timedelta(days=1)

    this_week_minutes = int(
        Post.objects.filter(
            user=user,
            created_at__date__gte=this_week_start,
            created_at__date__lte=today,
        ).aggregate(s=Sum("duration_minutes"))["s"]
        or 0
    )
    last_week_minutes = int(
        Post.objects.filter(
            user=user,
            created_at__date__gte=last_week_start,
            created_at__date__lte=last_week_end,
        ).aggregate(s=Sum("duration_minutes"))["s"]
        or 0
    )

    combined = this_week_minutes + last_week_minutes
    if combined > 0:
        this_week_percent = round(100 * this_week_minutes / combined, 1)
        last_week_percent = round(100 * last_week_minutes / combined, 1)
    else:
        this_week_percent = 0.0
        last_week_percent = 0.0

    tw_filter = Q(
        posts__created_at__date__gte=this_week_start,
        posts__created_at__date__lte=today,
    )
    pairs = list(
        User.objects.annotate(
            tw=Coalesce(
                Sum("posts__duration_minutes", filter=tw_filter),
                Value(0),
                output_field=IntegerField(),
            )
        ).values_list("id", "tw")
    )
    all_minutes = [int(m or 0) for _, m in pairs]
    user_tw = int(dict(pairs).get(user.id, 0) or 0)
    n_users = len(pairs)
    avg_tw = round(sum(all_minutes) / n_users, 1) if n_users else 0.0

    sorted_m = sorted(all_minutes)
    if sorted_m:
        mid = len(sorted_m) // 2
        if len(sorted_m) % 2 == 1:
            median_tw = float(sorted_m[mid])
        else:
            median_tw = (sorted_m[mid - 1] + sorted_m[mid]) / 2.0
    else:
        median_tw = 0.0

    others_minutes = [int(m) for uid, m in pairs if uid != user.id]
    if len(others_minutes) == 0:
        beats_percent = None
    else:
        below = sum(1 for m in others_minutes if m < user_tw)
        beats_percent = round(100 * below / len(others_minutes), 1)

    return Response(
        {
            "last_7_days": last_7_days,
            "this_week_minutes": this_week_minutes,
            "last_week_minutes": last_week_minutes,
            "this_week_percent": this_week_percent,
            "last_week_percent": last_week_percent,
            "week_range_this": {
                "start": this_week_start.isoformat(),
                "end": today.isoformat(),
            },
            "week_range_last": {
                "start": last_week_start.isoformat(),
                "end": last_week_end.isoformat(),
            },
            "community": {
                "avg_this_week_minutes": avg_tw,
                "median_this_week_minutes": median_tw,
                "your_this_week_minutes": user_tw,
                "beats_percent_of_peers": beats_percent,
                "peer_count": len(others_minutes),
            },
        }
    )


@api_view(["GET"])
def community_study_stats(request):
    today = timezone.localdate()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    week_daily_hours = []
    for i in range(7):
        day = week_start + timedelta(days=i)
        total_min = Post.objects.filter(created_at__date=day).aggregate(
            s=Sum("duration_minutes")
        )["s"]
        minutes = int(total_min or 0)
        hours = round(minutes / 60.0, 2)
        week_daily_hours.append(
            {
                "date": day.isoformat(),
                "label": day.strftime("%a"),
                "hours": hours,
                "minutes": minutes,
            }
        )

    week_total_minutes = int(
        Post.objects.filter(
            created_at__date__gte=week_start,
            created_at__date__lte=week_end,
        ).aggregate(s=Sum("duration_minutes"))["s"]
        or 0
    )
    week_total_hours = round(week_total_minutes / 60.0, 2)

    all_minutes = int(Post.objects.aggregate(s=Sum("duration_minutes"))["s"] or 0)
    total_hours_all_time = round(all_minutes / 60.0, 1)

    cumulative_week_hours = []
    run = 0.0
    for d in week_daily_hours:
        run += d["hours"]
        cumulative_week_hours.append(
            {
                "label": d["label"],
                "hours": round(run, 2),
            }
        )

    return Response(
        {
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "week_daily_hours": week_daily_hours,
            "week_total_hours": week_total_hours,
            "total_hours_all_time": total_hours_all_time,
            "cumulative_week_hours": cumulative_week_hours,
        }
    )


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
                "avatar_url": _avatar_url(request, related_user),
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

    return Response(_serialize_user(request, following, viewer=follower))


def _conversation_title(conversation, viewer_id):
    if conversation.is_group and conversation.name:
        return conversation.name
    other = (
        conversation.participants.exclude(id=viewer_id).order_by("username").first()
    )
    if other:
        return other.username
    return "Direct message"


def _serialize_message(msg):
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "sender_username": msg.sender.username,
        "content": msg.content,
        "created_at": msg.created_at,
    }


def _serialize_conversation(conversation, viewer_id):
    latest = conversation.messages.select_related("sender").order_by("-created_at").first()
    participant_ids = list(
        conversation.participants.values_list("id", flat=True)
    )
    return {
        "id": conversation.id,
        "created_at": conversation.created_at,
        "name": conversation.name,
        "is_group": conversation.is_group,
        "title": _conversation_title(conversation, viewer_id),
        "participant_ids": participant_ids,
        "participants": [
            {
                "id": u.id,
                "username": u.username,
                "avatar_url": "",
            }
            for u in conversation.participants.order_by("username")
        ],
        "latest_message": _serialize_message(latest) if latest else None,
    }


@api_view(["GET", "POST"])
def messaging_conversations(request):
    if request.method == "GET":
        viewer_raw = request.query_params.get("viewer_id")
    else:
        viewer_raw = request.data.get("viewer_id")
    if not viewer_raw:
        return Response({"error": "viewer_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        viewer_id = int(viewer_raw)
    except (TypeError, ValueError):
        return Response({"error": "viewer_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)
    viewer = User.objects.filter(id=viewer_id).first()
    if not viewer:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        conversations = (
            Conversation.objects.filter(participants=viewer)
            .prefetch_related("participants", "messages__sender")
            .order_by("-created_at")
            .distinct()
        )
        payload = [_serialize_conversation(c, viewer_id) for c in conversations]
        payload.sort(
            key=lambda c: (
                c["latest_message"]["created_at"] if c["latest_message"] else c["created_at"]
            ),
            reverse=True,
        )
        return Response(payload)

    participant_ids = request.data.get("participant_ids") or []
    if not isinstance(participant_ids, list):
        return Response({"error": "participant_ids must be a list"}, status=status.HTTP_400_BAD_REQUEST)
    cleaned = set()
    for p in participant_ids:
        try:
            cleaned.add(int(p))
        except (TypeError, ValueError):
            return Response({"error": "participant_ids must contain integers"}, status=status.HTTP_400_BAD_REQUEST)
    cleaned.add(viewer_id)
    participants = list(User.objects.filter(id__in=cleaned))
    if len(participants) != len(cleaned):
        return Response({"error": "One or more participants were not found"}, status=status.HTTP_404_NOT_FOUND)

    is_group = len(cleaned) > 2
    name = (request.data.get("name") or "").strip() if is_group else ""
    if is_group and not name:
        name = "Study Group"

    if not is_group and len(cleaned) == 2:
        existing = (
            Conversation.objects.filter(is_group=False, participants__id=viewer_id)
            .filter(participants__id=list(cleaned - {viewer_id})[0])
            .distinct()
            .first()
        )
        if existing:
            return Response(_serialize_conversation(existing, viewer_id))

    with transaction.atomic():
        convo = Conversation.objects.create(name=name, is_group=is_group, created_by=viewer)
        ConversationParticipant.objects.bulk_create(
            [ConversationParticipant(conversation=convo, user=u) for u in participants]
        )
    convo = Conversation.objects.prefetch_related("participants", "messages__sender").get(id=convo.id)
    return Response(_serialize_conversation(convo, viewer_id), status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
def messaging_conversation_detail(request, conversation_id):
    viewer_raw = request.query_params.get("viewer_id") or request.data.get("viewer_id")
    if not viewer_raw:
        return Response({"error": "viewer_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        viewer_id = int(viewer_raw)
    except (TypeError, ValueError):
        return Response({"error": "viewer_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

    if not ConversationParticipant.objects.filter(conversation_id=conversation_id, user_id=viewer_id).exists():
        return Response({"error": "You are not in this conversation"}, status=status.HTTP_403_FORBIDDEN)

    convo = Conversation.objects.filter(id=conversation_id).first()
    if not convo:
        return Response({"error": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)

    convo.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET", "POST"])
def messaging_conversation_messages(request, conversation_id):
    if request.method == "GET":
        viewer_raw = request.query_params.get("viewer_id")
    else:
        viewer_raw = request.data.get("viewer_id")
    if not viewer_raw:
        return Response({"error": "viewer_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        viewer_id = int(viewer_raw)
    except (TypeError, ValueError):
        return Response({"error": "viewer_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)
    if not ConversationParticipant.objects.filter(conversation_id=conversation_id, user_id=viewer_id).exists():
        return Response({"error": "You are not in this conversation"}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "GET":
        msgs = Message.objects.filter(conversation_id=conversation_id).select_related("sender").order_by("created_at")
        return Response([_serialize_message(m) for m in msgs])

    content = (request.data.get("content") or "").strip()
    if not content:
        return Response({"error": "content is required"}, status=status.HTTP_400_BAD_REQUEST)
    msg = Message.objects.create(conversation_id=conversation_id, sender_id=viewer_id, content=content)
    msg = Message.objects.select_related("sender").get(id=msg.id)
    other_participants = User.objects.filter(
        conversation_links__conversation_id=conversation_id
    ).exclude(id=viewer_id).distinct()
    for recipient in other_participants:
        _create_notification(
            recipient=recipient,
            actor=msg.sender,
            notif_type=Notification.TYPE_MESSAGE,
            text=f"{msg.sender.username} sent you a message.",
            message=msg,
            conversation_id=conversation_id,
        )
    return Response(_serialize_message(msg), status=status.HTTP_201_CREATED)


@api_view(["POST"])
def session_like(request, session_id):
    user_id = request.data.get("user") or request.query_params.get("user_id")
    if not user_id:
        return Response({"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return Response({"error": "user_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)
    user = User.objects.filter(id=user_id).first()
    post = Post.objects.filter(id=session_id).first()
    if not user or not post:
        return Response({"error": "User or post not found"}, status=status.HTTP_404_NOT_FOUND)

    like, created = PostLike.objects.get_or_create(post=post, user=user)
    if created:
        _create_notification(
            recipient=post.user,
            actor=user,
            notif_type=Notification.TYPE_LIKE,
            text=f"{user.username} liked your post.",
            post=post,
        )
    return Response({"liked": created, "likes_count": post.likes.count()})


@api_view(["GET"])
def notifications_list(request):
    user_id = request.query_params.get("user_id")
    if not user_id:
        return Response({"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return Response({"error": "user_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)
    notifications = Notification.objects.filter(recipient_id=user_id).select_related("actor")[:40]
    data = [
        {
            "id": n.id,
            "type": n.type,
            "text": n.text,
            "is_read": n.is_read,
            "actor_id": n.actor_id,
            "actor_username": n.actor.username,
            "conversation_id": n.conversation_id,
            "post_id": n.post_id,
            "created_at": n.created_at,
        }
        for n in notifications
    ]
    unread_count = Notification.objects.filter(recipient_id=user_id, is_read=False).count()
    return Response({"unread_count": unread_count, "notifications": data})


@api_view(["POST"])
def notifications_mark_read(request):
    user_id = request.data.get("user_id")
    if not user_id:
        return Response({"error": "user_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return Response({"error": "user_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)
    notif_id = request.data.get("notification_id")
    qs = Notification.objects.filter(recipient_id=user_id, is_read=False)
    if notif_id:
        qs = qs.filter(id=notif_id)
    qs.update(is_read=True)
    return Response({"ok": True})


@api_view(["GET"])
def admin_users_overview(request):
    viewer_raw = request.query_params.get("viewer_id")
    if not viewer_raw:
        return Response({"error": "viewer_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        viewer_id = int(viewer_raw)
    except (TypeError, ValueError):
        return Response({"error": "viewer_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)
    viewer = User.objects.filter(id=viewer_id).first()
    if not _is_admin_user(viewer):
        return Response({"error": "Admin access denied"}, status=status.HTTP_403_FORBIDDEN)

    users = (
        User.objects.all()
        .annotate(post_count=Count("posts"))
        .order_by("username")
    )
    payload = [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "post_count": int(u.post_count or 0),
        }
        for u in users
    ]
    return Response(payload)


@api_view(["PATCH", "DELETE"])
def admin_user_manage(request, target_user_id):
    viewer_raw = request.data.get("viewer_id") or request.query_params.get("viewer_id")
    if not viewer_raw:
        return Response({"error": "viewer_id is required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        viewer_id = int(viewer_raw)
    except (TypeError, ValueError):
        return Response({"error": "viewer_id must be an integer"}, status=status.HTTP_400_BAD_REQUEST)
    viewer = User.objects.filter(id=viewer_id).first()
    if not _is_admin_user(viewer):
        return Response({"error": "Admin access denied"}, status=status.HTTP_403_FORBIDDEN)

    target = User.objects.filter(id=target_user_id).first()
    if not target:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        if target.id == viewer.id:
            return Response({"error": "Admin account cannot delete itself"}, status=status.HTTP_400_BAD_REQUEST)
        target.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    new_username = (request.data.get("username") or target.username).strip()
    new_email = (request.data.get("email") or target.email).strip()
    if not new_username or not new_email:
        return Response({"error": "username and email are required"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_email(new_email)
    except ValidationError:
        return Response({"error": "Invalid email address"}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.exclude(id=target.id).filter(username=new_username).exists():
        return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.exclude(id=target.id).filter(email__iexact=new_email).exists():
        return Response({"error": "Email already exists"}, status=status.HTTP_400_BAD_REQUEST)

    target.username = new_username
    target.email = new_email
    target.save(update_fields=["username", "email"])
    return Response(
        {
            "id": target.id,
            "username": target.username,
            "email": target.email,
            "post_count": Post.objects.filter(user=target).count(),
        }
    )