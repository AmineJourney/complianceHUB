import secrets
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_membership_is_active'),
    ]

    operations = [
        migrations.CreateModel(
            name='Invitation',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('email', models.EmailField(blank=True, help_text='If set, only this email can accept the invite', max_length=254)),
                ('role', models.CharField(
                    choices=[
                        ('owner', 'Owner'), ('admin', 'Administrator'),
                        ('manager', 'Manager'), ('analyst', 'Analyst'),
                        ('auditor', 'Auditor'), ('viewer', 'Viewer'),
                    ],
                    default='viewer',
                    max_length=20
                )),
                ('token', models.CharField(default=secrets.token_urlsafe, max_length=64, unique=True)),
                ('expires_at', models.DateTimeField()),
                ('accepted_at', models.DateTimeField(blank=True, null=True)),
                ('is_revoked', models.BooleanField(db_index=True, default=False)),
                ('accepted_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='accepted_invitations',
                    to=settings.AUTH_USER_MODEL
                )),
                ('company', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='invitations',
                    to='core.company'
                )),
                ('invited_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='created_invitations',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'db_table': 'invitations',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='invitation',
            index=models.Index(fields=['token'], name='invitations_token_idx'),
        ),
        migrations.AddIndex(
            model_name='invitation',
            index=models.Index(fields=['company', '-created_at'], name='invitations_company_idx'),
        ),
    ]