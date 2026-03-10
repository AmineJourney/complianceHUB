# Generated migration for FIX #5 — adds preferences JSONField to core.User
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='preferences',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text=(
                    'User-level notification and appearance preferences. '
                    'Shape: {email_notifications, desktop_notifications, '
                    'compliance_alerts, risk_alerts, evidence_reminders, '
                    'theme, language}'
                ),
            ),
        ),
    ]