"""
Universal Framework Importer for Compliance Platform

This command imports framework definitions from YAML files into the database.
Supports ISO 27001, TISAX, ISO 42001, SOC 2, and other frameworks.

Usage:
    python manage.py import_framework <filename.yaml>
    python manage.py import_framework <filename.yaml> --reset
    python manage.py import_framework <filename.yaml> --lib-version "1.0.0"

Examples:
    python manage.py import_framework iso27001-2022-BILINGUAL-COMPLETE.yaml
    python manage.py import_framework tisax-v6.0.2-COMPLETE.yaml --reset
    python manage.py import_framework iso42001.yaml
"""

import os
import yaml
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from library.models import (
    StoredLibrary,
    LoadedLibrary,
    Framework,
    Requirement,
)
from controls.models import (
    ReferenceControl,
    RequirementReferenceControl
)


class Command(BaseCommand):
    help = 'Import a framework from YAML file'

    def add_arguments(self, parser):
        parser.add_argument(
            'yaml_file',
            type=str,
            help='Path to YAML file (relative to library/data/ or absolute path)'
        )
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete existing framework and reimport'
        )
        parser.add_argument(
            '--lib-version',
            type=str,
            help='Override library version from YAML'
        )

    @transaction.atomic
    def handle(self, *args, **options):
        yaml_file = options['yaml_file']
        reset = options['reset']
        lib_version_override = options.get('lib_version')

        # Resolve file path
        if not os.path.isabs(yaml_file):
            # Try relative to library/data/
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            yaml_path = os.path.join(base_dir, 'library', 'data', yaml_file)
            if not os.path.exists(yaml_path):
                # Try current directory
                yaml_path = yaml_file
        else:
            yaml_path = yaml_file

        if not os.path.exists(yaml_path):
            raise CommandError(f'YAML file not found: {yaml_path}')

        # Load YAML
        self.stdout.write(f'📂 Loading: {yaml_path}')
        try:
            with open(yaml_path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
        except Exception as e:
            raise CommandError(f'Failed to parse YAML: {e}')

        # Extract framework metadata
        framework_data = data.get('framework', {})
        version_data = data.get('version', {})
        domains_data = data.get('domains', [])
        controls_data = data.get('controls', [])

        framework_name = self._get_text(framework_data.get('name', {}))
        framework_slug = framework_data.get('slug', '')
        framework_version = version_data.get('name', '1.0')
        lib_version = lib_version_override or framework_version
        release_year = version_data.get('release_year', 2024)

        self.stdout.write('')
        self.stdout.write('=' * 70)
        self.stdout.write(f'📋 Framework: {framework_name}')
        self.stdout.write(f'   Version: {framework_version}')
        self.stdout.write(f'   Slug: {framework_slug}')
        self.stdout.write(f'   Domains: {len(domains_data)}')
        self.stdout.write(f'   Controls: {len(controls_data)}')
        self.stdout.write('=' * 70)
        self.stdout.write('')

        # Generate framework code
        framework_code = f"{framework_slug.upper()}-{framework_version}"

        # Check if framework exists
        if reset:
            existing = Framework.objects.filter(code=framework_code).first()
            if existing:
                self.stdout.write(self.style.WARNING(f'⚠️  Deleting existing framework: {framework_code}'))
                
                # Delete framework (cascades to requirements)
                existing.delete()
                
                # Clean up stored/loaded libraries
                StoredLibrary.objects.filter(slug=framework_slug).delete()
                
                self.stdout.write(self.style.SUCCESS('✅ Cleanup complete'))

        # Create StoredLibrary
        stored_lib, created = StoredLibrary.objects.get_or_create(
            slug=framework_slug,
            defaults={
                'name': framework_name,
                'description': self._get_text(version_data.get('description', {})),
                'provider': framework_data.get('provider', {}).get('name', 'ISO/IEC') if 'provider' in framework_data else 'ISO/IEC',
                'category': framework_data.get('category', 'security'),
                'official_url': framework_data.get('official_url', '') or 
                               framework_data.get('provider', {}).get('official_url', ''),
            }
        )

        # Create LoadedLibrary version
        loaded_lib, created = LoadedLibrary.objects.get_or_create(
            stored_library=stored_lib,
            version=lib_version,
            defaults={
                'release_date': f"{release_year}-01-01",
                'is_current': True,
            }
        )

        # Create Framework
        framework, created = Framework.objects.get_or_create(
            code=framework_code,
            defaults={
                'name': framework_name,
                'loaded_library': loaded_lib,
                'is_published': True,
            }
        )

        if not created:
            self.stdout.write(self.style.WARNING(f'⚠️  Framework already exists: {framework_code}'))
            self.stdout.write(self.style.WARNING('   Use --reset to reimport'))
            return

        self.stdout.write(self.style.SUCCESS(f'✅ Created framework: {framework_code}'))

        # Create domain requirements (sections)
        domain_map = {}
        for domain_data in domains_data:
            domain_code = domain_data.get('code')
            domain_name = self._get_text(domain_data.get('name', {}))
            domain_desc = self._get_text(domain_data.get('description', {}))
            domain_type = domain_data.get('domain_type', 'section')

            requirement = Requirement.objects.create(
                framework=framework,
                code=domain_code,
                title=domain_name,
                description=domain_desc,
                requirement_type='section',
                parent=None,
            )
            domain_map[domain_code] = requirement

            self.stdout.write(f'  📁 Domain {domain_code}: {domain_name}')

        # Create control requirements
        control_count = 0
        requirement_count = 0

        for control_data in controls_data:
            control_code = control_data.get('code')
            domain_code = control_data.get('domain')
            control_title = self._get_text(control_data.get('title', {}))
            control_desc = self._get_text(control_data.get('description', {}))
            control_guidance = self._get_text(control_data.get('guidance', {}))
            
            # Get parent domain
            parent_requirement = domain_map.get(domain_code)
            
            if not parent_requirement:
                self.stdout.write(self.style.WARNING(f'  ⚠️  Domain not found for control {control_code}: {domain_code}'))
                continue

            # Determine requirement type
            req_type = control_data.get('requirement_type', 'control')
            if req_type not in ['control', 'clause']:
                req_type = 'control'

            # Create control requirement
            control_req = Requirement.objects.create(
                framework=framework,
                code=control_code,
                title=control_title,
                description=control_desc,
                requirement_type=req_type,
                parent=parent_requirement,
            )
            control_count += 1

            # Map control to control family for ReferenceControl
            control_family = self._map_control_family(domain_code, framework_slug)

            # Create ReferenceControl
            ref_control, _ = ReferenceControl.objects.get_or_create(
                control_id=control_code,
                defaults={
                    'name': control_title,
                    'description': control_desc,
                    'control_family': control_family,
                    'implementation_guidance': control_guidance,
                }
            )

            # Link requirement to reference control
            RequirementReferenceControl.objects.get_or_create(
                requirement=control_req,
                reference_control=ref_control
            )

            # Create sub-requirements
            requirements_data = control_data.get('requirements', [])
            for req_data in requirements_data:
                req_id = req_data.get('id')
                req_text = self._get_text(req_data.get('text', {}))
                req_guidance = self._get_text(req_data.get('implementation_guidance', {}))

                Requirement.objects.create(
                    framework=framework,
                    code=req_id,
                    title=req_text[:200] if len(req_text) > 200 else req_text,
                    description=req_text,
                    requirement_type='sub_requirement',
                    parent=control_req,
                )
                requirement_count += 1

        # Summary
        total_requirements = Requirement.objects.filter(framework=framework).count()
        
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('✅ Framework import complete!'))
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(f'📊 Domains (sections): {len(domain_map)}')
        self.stdout.write(f'📊 Controls: {control_count}')
        self.stdout.write(f'📊 Sub-requirements: {requirement_count}')
        self.stdout.write(f'📊 Total Requirements: {total_requirements}')
        self.stdout.write('')
        self.stdout.write(f'🎯 Framework Code: {framework_code}')
        self.stdout.write(f'🎯 Database ID: {framework.id}')
        self.stdout.write('')

    def _get_text(self, text_dict):
        """Extract text from bilingual dict, prefer English"""
        if isinstance(text_dict, str):
            return text_dict
        if isinstance(text_dict, dict):
            return text_dict.get('en', text_dict.get('fr', ''))
        return ''

    def _map_control_family(self, domain_code, framework_slug):
        """Map domain code to control family"""
        
        # TISAX domain mapping
        if framework_slug == 'tisax':
            mapping = {
                '1.1': 'information_security',
                '1.2': 'physical_security',
                '1.3': 'access_control',
                '1.4': 'communications_security',
                '1.5': 'system_acquisition',
                '1.6': 'operations_security',
                '1.7': 'operations_security',
                '1.8': 'incident_management',
                '1.9': 'business_continuity',
                '1.10': 'supplier_relationships',
                '2': 'physical_security',
                '3': 'compliance',
            }
            # Match by prefix
            for prefix, family in mapping.items():
                if domain_code.startswith(prefix):
                    return family
        
        # ISO 27001 domain mapping
        elif framework_slug == 'iso27001':
            mapping = {
                'CLAUSE-4': 'information_security',
                'CLAUSE-5': 'information_security',
                'CLAUSE-6': 'information_security',
                'CLAUSE-7': 'information_security',
                'CLAUSE-8': 'operations_security',
                'CLAUSE-9': 'information_security',
                'CLAUSE-10': 'information_security',
                'A.5': 'information_security',
                'A.6': 'human_resources_security',
                'A.7': 'physical_security',
                'A.8': 'access_control',
            }
            return mapping.get(domain_code, 'information_security')
        
        # ISO 42001 (AI) domain mapping
        elif framework_slug == 'iso42001':
            mapping = {
                '4': 'information_security',
                '5': 'information_security',
                '6': 'information_security',
                '7': 'information_security',
                '8': 'operations_security',
                '9': 'information_security',
                '10': 'information_security',
                'A': 'operations_security',  # AI-specific
            }
            return mapping.get(domain_code, 'information_security')
        
        # SOC 2 domain mapping
        elif framework_slug in ['soc2', 'soc2-type2']:
            mapping = {
                'CC': 'information_security',
                'A': 'operations_security',  # Availability
                'PI': 'operations_security',  # Processing Integrity
                'C': 'information_security',  # Confidentiality
                'P': 'compliance',  # Privacy
            }
            return mapping.get(domain_code, 'information_security')
        
        # Default
        return 'information_security'
