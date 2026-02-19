import uuid
import yaml
import requests
from django.core.management.base import BaseCommand
from django.utils.timezone import now

from library.models import StoredLibrary, LoadedLibrary, Framework, Requirement
from controls.models import ReferenceControl  # optional if you want controls
from django.db import transaction

ISO_YAML_URL = "https://raw.githubusercontent.com/intuitem/ciso-assistant-community/main/backend/library/libraries/iso27001-2022.yaml"

class Command(BaseCommand):
    help = "Import ISO 27001:2022 framework from YAML"

    def add_arguments(self, parser):
        parser.add_argument(
            "--url", type=str, default=ISO_YAML_URL, help="URL or local path to ISO YAML"
        )
        parser.add_argument(
            "--iso-version", type=str, default="2022.1", help="Version of the loaded library"
        )

    @transaction.atomic
    def handle(self, *args, **options):
        url = options["url"]
        version = options["iso_version"]

        self.stdout.write(f"Loading ISO 27001 YAML from {url}...")
        if url.startswith("http"):
            response = requests.get(url)
            response.raise_for_status()
            yaml_content = yaml.safe_load(response.text)
        else:
            with open(url, "r") as f:
                yaml_content = yaml.safe_load(f)

        # ==============================
        # Create StoredLibrary
        # ==============================
        stored_library, created = StoredLibrary.objects.get_or_create(
            name="ISO Standards",
            defaults={
                "description": "ISO 27001 Information Security Framework",
                "raw_content": yaml.safe_dump(yaml_content),
                "content_format": "yaml",
                "source_url": url,
                "source_organization": "ISO",
                "library_type": "security",
            }
        )
        if created:
            self.stdout.write(f"StoredLibrary created: {stored_library.name}")
        else:
            self.stdout.write(f"StoredLibrary exists: {stored_library.name}")

        # ==============================
        # Create LoadedLibrary
        # ==============================
        loaded_library, created = LoadedLibrary.objects.get_or_create(
            stored_library=stored_library,
            version=version,
            defaults={
                "is_active": True,
                "processing_status": "completed",
                "release_date": now().date(),
            }
        )
        if created:
            self.stdout.write(f"LoadedLibrary created: {loaded_library.version}")
        else:
            self.stdout.write(f"LoadedLibrary exists: {loaded_library.version}")

        # ==============================
        # Create Framework
        # ==============================
        framework, created = Framework.objects.get_or_create(
            loaded_library=loaded_library,
            code="ISO27001",
            defaults={
                "name": "ISO/IEC 27001:2022",
                "description": "Information Security Management System requirements.",
                "official_name": "ISO/IEC 27001:2022",
                "issuing_organization": "ISO",
                "category": "security",
                "scope": "Covers information security controls and requirements.",
                "applicability": "Applicable to any organization seeking information security certification.",
                "official_url": "https://www.iso.org/standard/27001.html",
                "documentation_url": "https://www.iso.org/iso-27001-information-security.html",
                "is_published": True,
            }
        )
        if created:
            self.stdout.write(f"Framework created: {framework.name}")
        else:
            self.stdout.write(f"Framework exists: {framework.name}")

        # ==============================
        # Create Requirements
        # ==============================
        requirements = yaml_content.get("requirements", [])
        self.stdout.write(f"Found {len(requirements)} requirements in YAML")

        def create_requirement_tree(req_list, parent=None):
            for r in req_list:
                req_obj, created = Requirement.objects.get_or_create(
                    framework=framework,
                    code=r["code"],
                    defaults={
                        "title": r.get("title", ""),
                        "description": r.get("description", ""),
                        "parent": parent
                    }
                )
                if created:
                    self.stdout.write(f"  Requirement created: {req_obj.code}")
                # recursively create children
                children = r.get("children", [])
                if children:
                    create_requirement_tree(children, parent=req_obj)

        create_requirement_tree(requirements)

        self.stdout.write(self.style.SUCCESS("ISO 27001 import completed successfully!"))
