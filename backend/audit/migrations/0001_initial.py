from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
        ('core', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('actor_email', models.EmailField(blank=True, help_text='Snapshot of email at time of action (preserved if user deleted)', max_length=254)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.CharField(blank=True, max_length=500)),
                ('action', models.CharField(choices=[
                    ('control_applied', 'Control Applied'),
                    ('control_updated', 'Control Updated'),
                    ('control_deleted', 'Control Deleted'),
                    ('control_status_changed', 'Control Status Changed'),
                    ('evidence_uploaded', 'Evidence Uploaded'),
                    ('evidence_updated', 'Evidence Updated'),
                    ('evidence_deleted', 'Evidence Deleted'),
                    ('evidence_approved', 'Evidence Approved'),
                    ('evidence_rejected', 'Evidence Rejected'),
                    ('evidence_downloaded', 'Evidence Downloaded'),
                    ('evidence_linked', 'Evidence Linked to Control'),
                    ('evidence_unlinked', 'Evidence Unlinked from Control'),
                    ('risk_created', 'Risk Created'),
                    ('risk_updated', 'Risk Updated'),
                    ('risk_deleted', 'Risk Deleted'),
                    ('risk_status_changed', 'Risk Status Changed'),
                    ('risk_assessed', 'Risk Assessed'),
                    ('compliance_calculated', 'Compliance Calculated'),
                    ('framework_adopted', 'Framework Adopted'),
                    ('framework_certified', 'Framework Certified'),
                    ('member_invited', 'Member Invited'),
                    ('member_joined', 'Member Joined'),
                    ('member_role_changed', 'Member Role Changed'),
                    ('member_removed', 'Member Removed'),
                    ('created', 'Created'),
                    ('updated', 'Updated'),
                    ('deleted', 'Deleted'),
                ], db_index=True, max_length=60)),
                ('object_id', models.CharField(blank=True, db_index=True, max_length=36)),
                ('object_repr', models.CharField(blank=True, help_text='str() of the object at time of action', max_length=500)),
                ('resource_type', models.CharField(blank=True, db_index=True, help_text='e.g. "AppliedControl", "Evidence", "Risk"', max_length=100)),
                ('changes', models.JSONField(blank=True, default=dict, help_text='{"field": ["old_value", "new_value"]} for updates')),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('timestamp', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_actions', to=settings.AUTH_USER_MODEL)),
                ('company', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='audit_logs', to='core.company')),
                ('content_type', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='contenttypes.contenttype')),
            ],
            options={
                'db_table': 'audit_logs',
                'ordering': ['-timestamp'],
            },
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['company', '-timestamp'], name='audit_logs_company_ts_idx'),
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['company', 'action'], name='audit_logs_company_action_idx'),
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['company', 'resource_type'], name='audit_logs_company_res_idx'),
        ),
        migrations.AddIndex(
            model_name='auditlog',
            index=models.Index(fields=['actor', '-timestamp'], name='audit_logs_actor_ts_idx'),
        ),
    ]
