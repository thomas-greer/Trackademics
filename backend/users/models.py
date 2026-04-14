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

    def __str__(self):
        return f"Comment by {self.user.username} on Post {self.post.id}"


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

    def __str__(self):
        return f"{self.follower.username} follows {self.following.username}"