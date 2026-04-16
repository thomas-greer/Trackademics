from django.db import models
from django.contrib.auth.models import User
from django.db.models import F


class Post(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="posts")
    category = models.CharField(max_length=100)
    duration_minutes = models.IntegerField()
    caption = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.category}"


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="comments")
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class Follower(models.Model):
    follower = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="following_relationships"
    )
    following = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="follower_relationships"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["follower", "following"], name="unique_follower_relationship"
            ),
            models.CheckConstraint(
                condition=~models.Q(follower=F("following")),
                name="prevent_self_follow",
            ),
        ]


class UserStats(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="stats")
    current_streak = models.IntegerField(default=0)
    best_streak = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.user.username} streaks"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    avatar = models.ImageField(upload_to="avatars/", blank=True)
    bio = models.TextField(blank=True, default="")
    school = models.CharField(max_length=120, blank=True, default="")

    def __str__(self):
        return f"Profile for {self.user.username}"


class Conversation(models.Model):
    name = models.CharField(max_length=120, blank=True, default="")
    is_group = models.BooleanField(default=False)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_conversations")
    created_at = models.DateTimeField(auto_now_add=True)
    participants = models.ManyToManyField(User, through="ConversationParticipant", related_name="conversations")

    def __str__(self):
        if self.is_group and self.name:
            return self.name
        return f"Conversation {self.id}"


class ConversationParticipant(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="participant_links")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="conversation_links")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["conversation", "user"],
                name="unique_conversation_participant",
            ),
        ]


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_messages")
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Message {self.id} in conversation {self.conversation_id}"


class PostLike(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="post_likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["post", "user"], name="unique_post_like"),
        ]


class Notification(models.Model):
    TYPE_MESSAGE = "message"
    TYPE_COMMENT = "comment"
    TYPE_LIKE = "like"
    TYPE_CHOICES = [
        (TYPE_MESSAGE, "Message"),
        (TYPE_COMMENT, "Comment"),
        (TYPE_LIKE, "Like"),
    ]

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    actor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_notifications")
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    text = models.CharField(max_length=255)
    is_read = models.BooleanField(default=False)
    post = models.ForeignKey(Post, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    message = models.ForeignKey(Message, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
