from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('controls', '0002_add_unified_controls'),
    ]

    operations = [
        # Add GIN index for tags (PostgreSQL specific)
        migrations.RunSQL(
            sql="CREATE INDEX idx_unified_controls_tags ON unified_controls USING gin(tags jsonb_path_ops);",
            reverse_sql="DROP INDEX IF EXISTS idx_unified_controls_tags;"
        ),
        
        # Add index for maturity level on AppliedControl
        migrations.AddIndex(
            model_name='appliedcontrol',
            index=models.Index(fields=['maturity_level', 'status'], name='idx_applied_maturity_status'),
        ),
    ]