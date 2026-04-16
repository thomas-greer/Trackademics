import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0011_conversation_conversationparticipant_message"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PostLike",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("post", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="likes", to="users.post")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="post_likes", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("type", models.CharField(choices=[("message", "Message"), ("comment", "Comment"), ("like", "Like")], max_length=20)),
                ("text", models.CharField(max_length=255)),
                ("is_read", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("actor", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sent_notifications", to=settings.AUTH_USER_MODEL)),
                ("comment", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="users.comment")),
                ("conversation", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="users.conversation")),
                ("message", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="users.message")),
                ("post", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="users.post")),
                ("recipient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="postlike",
            constraint=models.UniqueConstraint(fields=("post", "user"), name="unique_post_like"),
        ),
    ]
