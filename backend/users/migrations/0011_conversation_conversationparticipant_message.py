import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0010_userprofile_school"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Conversation",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(blank=True, default="", max_length=120)),
                ("is_group", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="created_conversations", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="ConversationParticipant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("joined_at", models.DateTimeField(auto_now_add=True)),
                ("conversation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="participant_links", to="users.conversation")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="conversation_links", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name="Message",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("content", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("conversation", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="messages", to="users.conversation")),
                ("sender", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sent_messages", to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddField(
            model_name="conversation",
            name="participants",
            field=models.ManyToManyField(related_name="conversations", through="users.ConversationParticipant", to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddConstraint(
            model_name="conversationparticipant",
            constraint=models.UniqueConstraint(fields=("conversation", "user"), name="unique_conversation_participant"),
        ),
    ]
