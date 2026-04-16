from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0008_userprofile"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="bio",
            field=models.TextField(blank=True, default=""),
        ),
    ]
