import os
import yaml
import uuid
from django.core.management.base import BaseCommand
from django.db import transaction
from library.models import Requirement, LoadedLibrary, StoredLibrary, Framework
from controls.models import ReferenceControl, RequirementReferenceControl  # adjust if your path differs

class Command(BaseCommand):
    help = "Import TISAX v6 controls from YAML file"

    def add_arguments(self, parser):
        parser.add_argument(
            "--url",
            type=str,
            required=True,
            help="Path to the TISAX YAML file",
        )
        parser.add_argument(
            "--tisax-version",
            type=str,
            required=True,
            help="TISAX version identifier, e.g., 6.0.2",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        yaml_path = options["url"]
        version = options["tisax_version"]

        if not os.path.exists(yaml_path):
            self.stderr.write(f"File not found: {yaml_path}")
            return

        self.stdout.write(f"Loading TISAX YAML from {yaml_path}...")
        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        framework_data = data.get("objects", {}).get("framework", {})
        requirement_nodes = framework_data.get("requirement_nodes", [])

        if not requirement_nodes:
            self.stderr.write("No 'requirement_nodes' found in YAML")
            return

        # Create StoredLibrary
        stored_library, _ = StoredLibrary.objects.get_or_create(
            name="TISAX",
            defaults={
                "description": framework_data.get("description", ""),
                "raw_content": yaml.dump(data),
                "content_format": "yaml",
                "source_url": "https://enx.com/tisax/",
                "source_organization": "ENX Association",
                "library_type": "security",
            },
        )

        # Create LoadedLibrary
        loaded_library, _ = LoadedLibrary.objects.get_or_create(
            stored_library=stored_library,
            version=version,
            defaults={
                "is_active": True,
                "processing_status": "completed",
            },
        )

        # Create Framework
        framework, _ = Framework.objects.get_or_create(
            loaded_library=loaded_library,
            name=framework_data.get("name", f"TISAX v{version}"),
            code=f"TISAX-{version}",
            description=framework_data.get("description", ""),
            official_name=f"TISAX v{version}",
            issuing_organization=framework_data.get("provider", "ENX Association"),
            category="security",
            is_published=True,
        )

        # Helper to import requirement node recursively
        def import_node(node, parent_requirement=None):
            if node.get("assessable", False):
                code = node.get("ref_id") or str(uuid.uuid4())
                title = node.get("name", "")
                description = node.get("description", "")

                requirement, _ = Requirement.objects.get_or_create(
                    framework=framework,
                    code=code,
                    defaults={
                        "title": title,
                        "description": description,
                        "parent": parent_requirement,  # preserves hierarchy if your model has parent FK
                    },
                )

                # ReferenceControl
                ref_control, _ = ReferenceControl.objects.get_or_create(
                    code=code,
                    defaults={
                        "name": title,
                        "description": description,
                        "control_family": "information_security",
                        "control_type": "preventive",
                        "is_published": True,
                    },
                )

                # Map Requirement <-> ReferenceControl
                for group in node.get("implementation_groups", ["must"]):
                    RequirementReferenceControl.objects.get_or_create(
                        requirement=requirement,
                        reference_control=ref_control,
                        defaults={"coverage_level": group, "is_primary": True},
                    )

                parent_requirement = requirement  # use this as parent for children

            # recursively import children
            for child_node in [n for n in requirement_nodes if n.get("parent_urn") == node.get("urn")]:
                import_node(child_node, parent_requirement)

        # Import all top-level nodes (depth=1)
        top_nodes = [n for n in requirement_nodes if n.get("depth") == 1]
        self.stdout.write(f"Importing {len(requirement_nodes)} requirement nodes...")
        for node in top_nodes:
            import_node(node)

        self.stdout.write(self.style.SUCCESS(f"TISAX v{version} imported successfully!"))
