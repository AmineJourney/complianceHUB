# backend/controls/management/commands/migrate_to_unified_model.py

from django.core.management.base import BaseCommand
from django.db import transaction
from controls.models import ReferenceControl, UnifiedControl, UnifiedControlMapping


class Command(BaseCommand):
    help = 'Migrate existing ReferenceControls to Unified Control Model'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview migration without making changes',
        )
    
    @transaction.atomic
    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        self.stdout.write(self.style.SUCCESS('Starting migration to Unified Control Model...'))
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be saved'))
        
        # Step 1: Create Unified Controls from unique control codes
        # Group ReferenceControls by similar codes across frameworks
        control_groups = self._group_similar_controls()
        
        created_unified = 0
        created_mappings = 0
        
        for group_key, ref_controls in control_groups.items():
            # Create one UnifiedControl for this group
            unified_control = self._create_unified_control(group_key, ref_controls, dry_run)
            
            if unified_control:
                created_unified += 1
                
                # Create mappings for each ReferenceControl in this group
                for ref_control in ref_controls:
                    mapping = self._create_mapping(ref_control, unified_control, dry_run)
                    if mapping:
                        created_mappings += 1
        
        self.stdout.write(self.style.SUCCESS(
            f'✓ Created {created_unified} Unified Controls'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'✓ Created {created_mappings} Control Mappings'
        ))
        
        if dry_run:
            self.stdout.write(self.style.WARNING(
                'DRY RUN COMPLETE - Run without --dry-run to save changes'
            ))
        else:
            self.stdout.write(self.style.SUCCESS('Migration complete!'))
    
    def _group_similar_controls(self):
        """
        Group reference controls that should map to the same unified control
        This is a simplified example - adjust logic based on your data
        """
        from collections import defaultdict
        
        groups = defaultdict(list)
        
        for ref_control in ReferenceControl.objects.filter(
            is_deleted=False,
            is_published=True
        ):
            # Group by control family and name similarity
            # Adjust this logic based on your framework structure
            group_key = f"{ref_control.control_family}_{ref_control.name[:50]}"
            groups[group_key].append(ref_control)
        
        return groups
    
    def _create_unified_control(self, group_key, ref_controls, dry_run):
        """Create a UnifiedControl from a group of ReferenceControls"""
        # Use the first control as template
        template = ref_controls[0]
        
        # Generate unified control code
        control_code = f"UC-{len(UnifiedControl.objects.all()) + 1:03d}"
        
        # Determine domain based on control family
        domain_mapping = {
            'Access Control': 'Access Control',
            'Asset Management': 'Asset Management',
            'Cryptography': 'Cryptography',
            # Add more mappings...
        }
        domain = domain_mapping.get(template.control_family, 'General')
        
        unified_data = {
            'control_code': control_code,
            'control_name': template.name,
            'domain': domain,
            'category': template.control_family,
            'description': template.description or 'To be defined',
            'implementation_guidance': template.implementation_guidance or 'To be defined',
            'control_type': template.control_type,
            'automation_level': template.automation_level,
            
            # Default maturity criteria
            'maturity_level_1_criteria': 'Ad-hoc: Processes are unpredictable and reactive',
            'maturity_level_2_criteria': 'Managed: Processes are documented and repeatable',
            'maturity_level_3_criteria': 'Defined: Processes are well characterized',
            'maturity_level_4_criteria': 'Quantitatively Managed: Processes are measured',
            'maturity_level_5_criteria': 'Optimizing: Focus on continuous improvement',
            
            'is_active': True,
        }
        
        if dry_run:
            self.stdout.write(f"  Would create: {control_code} - {template.name}")
            return None
        else:
            unified_control, created = UnifiedControl.objects.get_or_create(
                control_code=control_code,
                defaults=unified_data
            )
            return unified_control
    
    def _create_mapping(self, ref_control, unified_control, dry_run):
        """Create mapping between ReferenceControl and UnifiedControl"""
        if dry_run:
            self.stdout.write(f"    Would map: {ref_control.code} → {unified_control.control_code}")
            return None
        else:
            mapping, created = UnifiedControlMapping.objects.get_or_create(
                reference_control=ref_control,
                unified_control=unified_control,
                defaults={
                    'coverage_type': 'full',
                    'coverage_percentage': 100,
                    'mapping_rationale': 'Auto-migrated from existing structure'
                }
            )
            return mapping