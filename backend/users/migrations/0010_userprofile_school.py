from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0009_userprofile_bio"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="school",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
    ]
