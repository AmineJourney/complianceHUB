from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ('controls', '0001_initial'),
        ('core', '0001_initial'),
    ]

    operations = [
        # ═══════════════════════════════════════════════════════════
        # UNIFIED CONTROL MODEL
        # ═══════════════════════════════════════════════════════════
        migrations.CreateModel(
            name='UnifiedControl',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4,
                    editable=False,
                    primary_key=True
                )),
                
                # Identification
                ('control_code', models.CharField(
                    max_length=100,
                    unique=True,
                    help_text='Unique code like UC-001, UC-002'
                )),
                ('control_name', models.CharField(
                    max_length=500,
                    help_text='Full control name'
                )),
                ('short_name', models.CharField(
                    max_length=200,
                    blank=True
                )),
                
                # Classification
                ('domain', models.CharField(
                    max_length=200,
                    db_index=True,
                    help_text='Security Governance, Asset Management, etc.'
                )),
                ('category', models.CharField(
                    max_length=200,
                    blank=True
                )),
                ('control_family', models.CharField(
                    max_length=200,
                    blank=True
                )),
                
                # Core content
                ('description', models.TextField(
                    help_text='Detailed description'
                )),
                ('control_objective', models.TextField(
                    blank=True,
                    help_text='What this control achieves'
                )),
                ('implementation_guidance', models.TextField(
                    help_text='How to implement this control'
                )),
                
                # Implementation properties
                ('control_type', models.CharField(
                    max_length=50,
                    choices=[
                        ('preventive', 'Preventive'),
                        ('detective', 'Detective'),
                        ('corrective', 'Corrective'),
                        ('directive', 'Directive'),
                    ],
                    blank=True
                )),
                ('automation_level', models.CharField(
                    max_length=50,
                    choices=[
                        ('manual', 'Manual'),
                        ('semi_automated', 'Semi-Automated'),
                        ('automated', 'Automated'),
                    ],
                    blank=True
                )),
                ('implementation_complexity', models.CharField(
                    max_length=50,
                    choices=[
                        ('low', 'Low'),
                        ('medium', 'Medium'),
                        ('high', 'High'),
                    ],
                    blank=True
                )),
                ('estimated_effort_hours', models.IntegerField(
                    null=True,
                    blank=True
                )),
                
                # ═══════════════════════════════════════════════
                # MATURITY MODEL (5 LEVELS - CMMI-BASED)
                # ═══════════════════════════════════════════════
                ('maturity_level_1_criteria', models.TextField(
                    blank=True,
                    help_text='Level 1 - Initial/Ad-hoc'
                )),
                ('maturity_level_2_criteria', models.TextField(
                    blank=True,
                    help_text='Level 2 - Managed'
                )),
                ('maturity_level_3_criteria', models.TextField(
                    blank=True,
                    help_text='Level 3 - Defined'
                )),
                ('maturity_level_4_criteria', models.TextField(
                    blank=True,
                    help_text='Level 4 - Quantitatively Managed'
                )),
                ('maturity_level_5_criteria', models.TextField(
                    blank=True,
                    help_text='Level 5 - Optimizing'
                )),
                
                # Testing
                ('testing_procedures', models.TextField(
                    blank=True
                )),
                ('testing_frequency', models.CharField(
                    max_length=50,
                    choices=[
                        ('continuous', 'Continuous'),
                        ('daily', 'Daily'),
                        ('weekly', 'Weekly'),
                        ('monthly', 'Monthly'),
                        ('quarterly', 'Quarterly'),
                        ('annual', 'Annual'),
                    ],
                    blank=True
                )),
                
                # Relationships
                ('prerequisites', models.JSONField(
                    default=list,
                    blank=True,
                    help_text='Array of prerequisite control codes'
                )),
                ('related_controls', models.JSONField(
                    default=list,
                    blank=True,
                    help_text='Array of related unified control IDs'
                )),
                
                # Categorization
                ('tags', models.JSONField(
                    default=list,
                    blank=True
                )),
                
                # Metadata
                ('metadata', models.JSONField(
                    default=dict,
                    blank=True
                )),
                
                # Status
                ('is_active', models.BooleanField(
                    default=True,
                    db_index=True
                )),
                ('version', models.IntegerField(
                    default=1
                )),
                
                # Timestamps
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    'core.User',
                    on_delete=models.SET_NULL,
                    null=True,
                    blank=True,
                    related_name='created_unified_controls'
                )),
                ('updated_by', models.ForeignKey(
                    'core.User',
                    on_delete=models.SET_NULL,
                    null=True,
                    blank=True,
                    related_name='updated_unified_controls'
                )),
            ],
            options={
                'db_table': 'unified_controls',
                'ordering': ['control_code'],
                'indexes': [
                    models.Index(fields=['control_code'], name='uc_code_idx'),
                    models.Index(fields=['domain'], name='uc_domain_idx'),
                    models.Index(fields=['is_active'], name='uc_active_idx'),
                ],
            },
        ),
        
        # ═══════════════════════════════════════════════════════════
        # ENHANCED CONTROL MAPPING
        # ═══════════════════════════════════════════════════════════
        migrations.CreateModel(
            name='UnifiedControlMapping',
            fields=[
                ('id', models.UUIDField(
                    default=uuid.uuid4,
                    editable=False,
                    primary_key=True
                )),
                ('reference_control', models.ForeignKey(
                    'controls.ReferenceControl',
                    on_delete=models.CASCADE,
                    related_name='unified_mappings'
                )),
                ('unified_control', models.ForeignKey(
                    'controls.UnifiedControl',
                    on_delete=models.CASCADE,
                    related_name='reference_mappings'
                )),
                
                # Coverage type (NEW!)
                ('coverage_type', models.CharField(
                    max_length=50,
                    choices=[
                        ('full', 'Full Coverage'),
                        ('partial', 'Partial Coverage'),
                        ('supplemental', 'Supplemental'),
                    ],
                    default='full',
                    help_text='How this unified control covers the reference control'
                )),
                ('coverage_percentage', models.IntegerField(
                    default=100,
                    help_text='0-100 percentage for partial coverage'
                )),
                
                # Mapping details
                ('mapping_rationale', models.TextField(
                    blank=True,
                    help_text='Why this mapping exists'
                )),
                ('gap_description', models.TextField(
                    blank=True,
                    help_text='What is missing for full coverage'
                )),
                ('supplemental_actions', models.TextField(
                    blank=True,
                    help_text='Additional actions needed'
                )),
                
                # Validation
                ('confidence_score', models.IntegerField(
                    default=100,
                    help_text='0-100 confidence in this mapping'
                )),
                ('verified_by', models.ForeignKey(
                    'core.User',
                    on_delete=models.SET_NULL,
                    null=True,
                    blank=True,
                    related_name='verified_mappings'
                )),
                ('verified_at', models.DateTimeField(
                    null=True,
                    blank=True
                )),
                
                # Metadata
                ('metadata', models.JSONField(
                    default=dict,
                    blank=True
                )),
                
                # Timestamps
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'unified_control_mappings',
                'unique_together': [['reference_control', 'unified_control']],
                'indexes': [
                    models.Index(fields=['coverage_type'],name='ucmap_covtype_idx'),
                ],
            },
        ),
        
        # ═══════════════════════════════════════════════════════════
        # ENHANCE APPLIED CONTROL WITH MATURITY
        # ═══════════════════════════════════════════════════════════
        migrations.AddField(
            model_name='appliedcontrol',
            name='unified_control',
            field=models.ForeignKey(
                'controls.UnifiedControl',
                on_delete=models.PROTECT,
                null=True,  # Nullable during migration
                blank=True,
                related_name='applied_instances',
                help_text='Link to unified control (if using unified model)'
            ),
        ),
        migrations.AddField(
            model_name='appliedcontrol',
            name='maturity_level',
            field=models.IntegerField(
                default=1,
                choices=[
                    (1, 'Level 1 - Initial/Ad-hoc'),
                    (2, 'Level 2 - Managed'),
                    (3, 'Level 3 - Defined'),
                    (4, 'Level 4 - Quantitatively Managed'),
                    (5, 'Level 5 - Optimizing'),
                ],
                db_index=True,
                help_text='Current maturity level'
            ),
        ),
        migrations.AddField(
            model_name='appliedcontrol',
            name='maturity_target_level',
            field=models.IntegerField(
                default=3,
                choices=[
                    (1, 'Level 1'),
                    (2, 'Level 2'),
                    (3, 'Level 3'),
                    (4, 'Level 4'),
                    (5, 'Level 5'),
                ],
                help_text='Target maturity level to achieve'
            ),
        ),
        migrations.AddField(
            model_name='appliedcontrol',
            name='maturity_assessment_date',
            field=models.DateField(
                null=True,
                blank=True,
                help_text='When maturity was last assessed'
            ),
        ),
        migrations.AddField(
            model_name='appliedcontrol',
            name='maturity_notes',
            field=models.TextField(
                blank=True,
                help_text='Notes about current maturity level'
            ),
        ),
    ]