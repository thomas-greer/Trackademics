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
from django.db.models import IntegerField, Prefetch, Q, Sum, Value
from django.db.models.functions import Coalesce
from .models import Comment, Follower, Post, UserProfile, UserStats

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

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
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
        "comments": [_serialize_comment(request, c) for c in s.comments.all()],
    }


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

        if not username or not email or not password:
            return Response(
                {"error": "username, email, and password are required"},
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
    try:
        with transaction.atomic():
            user.username = new_username
            user.email = new_email
            user.save()
            if avatar:
                profile, _ = UserProfile.objects.get_or_create(user=user)
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