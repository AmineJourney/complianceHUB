"""
management/commands/import_tisax.py

Imports TISAX v6 from the local YAML file at:
    backend/library/data/tisax-v6.yaml

Usage (from backend/):
    python manage.py import_tisax
    python manage.py import_tisax --path library/data/tisax-v6.yaml
    python manage.py import_tisax --reset   # wipe & reimport
    python manage.py import_tisax --path C:\\full\\path\\to\\tisax-v6.yaml --reset
"""

import os
import yaml
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import transaction

from library.models import StoredLibrary, LoadedLibrary, Framework, Requirement


DEFAULT_PATH = Path(__file__).resolve().parents[2] / "data" / "tisax-v6.yaml"


class Command(BaseCommand):
    help = "Import TISAX v6 from the local YAML file in library/data/"

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default=str(DEFAULT_PATH),
            help="Path to the tisax-v6.yaml file (default: library/data/tisax-v6.yaml)",
        )
        parser.add_argument(
            "--lib-version",
            type=str,
            default="6.0.2",
            help="Version string for the LoadedLibrary record (default: 6.0.2)",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing TISAX requirements and reimport from scratch",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        yaml_path = options["path"]
        version = options["lib_version"]
        reset = options["reset"]

        # ── 1. Load YAML ──────────────────────────────────────────────────────
        if not os.path.exists(yaml_path):
            self.stderr.write(self.style.ERROR(f"File not found: {yaml_path}"))
            self.stderr.write(
                "Pass the full path explicitly:\n"
                "  python manage.py import_tisax --path C:\\...\\backend\\library\\data\\tisax-v6.yaml"
            )
            return

        self.stdout.write(f"Reading {yaml_path} …")
        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        # ── 2. Extract framework metadata ─────────────────────────────────────
        # Support both top-level requirement_nodes and objects.framework wrapper
        objects = data.get("objects", {})
        framework_data = objects.get("framework", data)  # fallback to root
        requirement_nodes = framework_data.get("requirement_nodes", [])

        if not requirement_nodes:
            self.stderr.write(self.style.ERROR(
                "No 'requirement_nodes' found — check the YAML structure."
            ))
            return

        self.stdout.write(f"Found {len(requirement_nodes)} requirement nodes")

        framework_name = framework_data.get("name", f"TISAX v{version}")
        framework_desc = framework_data.get("description", "Trusted Information Security Assessment Exchange")
        provider = framework_data.get("provider", "ENX Association")

        # ── 3. StoredLibrary ──────────────────────────────────────────────────
        stored_library, created = StoredLibrary.objects.get_or_create(
            name="TISAX",
            defaults={
                "description": "Trusted Information Security Assessment Exchange (TISAX)",
                "raw_content": yaml.safe_dump(data),
                "content_format": "yaml",
                "source_url": "https://enx.com/en-EN/TISAX/",
                "source_organization": "ENX Association",
                "library_type": "security",
            },
        )
        self.stdout.write(
            ("Created" if created else "Found existing") + f" StoredLibrary: {stored_library.name}"
        )

        # ── 4. LoadedLibrary ──────────────────────────────────────────────────
        loaded_library, created = LoadedLibrary.objects.get_or_create(
            stored_library=stored_library,
            version=version,
            defaults={
                "is_active": True,
                "processing_status": "completed",
            },
        )
        if created:
            self.stdout.write(f"Created LoadedLibrary v{version}")
        else:
            self.stdout.write(f"Found existing LoadedLibrary v{version}")
            if not loaded_library.is_active:
                loaded_library.is_active = True
                loaded_library.save()

        # ── 5. Framework ──────────────────────────────────────────────────────
        framework_code = f"TISAX-{version}"
        framework, created = Framework.objects.get_or_create(
            loaded_library=loaded_library,
            code=framework_code,
            defaults={
                "name": framework_name,
                "description": framework_desc,
                "official_name": f"TISAX v{version}",
                "issuing_organization": provider,
                "category": "security",
                "scope": "Information security for automotive supply chain",
                "applicability": "Automotive suppliers and partners handling sensitive information",
                "official_url": "https://enx.com/en-EN/TISAX/",
                "documentation_url": "https://portal.enx.com/en-EN/TISAX/",
                "is_published": True,
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"Created Framework: {framework.name}"))
        else:
            self.stdout.write(f"Found existing Framework: {framework.name}")
            if reset:
                self.stdout.write(self.style.WARNING("--reset: deleting existing requirements …"))
                framework.requirements.all().delete()

        # ── 6. Build requirements (flat list → tree via parent_urn) ───────────
        #
        # The YAML is a flat list ordered parent-before-child.
        # We iterate once, building a {urn → Requirement} lookup as we go.
        # parent_urn always points to an already-processed node so we can
        # resolve it immediately without recursion.

        urn_to_req = {}
        created_count = 0
        skipped_count = 0

        for node in requirement_nodes:
            urn = node.get("urn", "")
            ref_id = node.get("ref_id", "")
            name = node.get("name", "")
            description = node.get("description", "")
            assessable = node.get("assessable", False)
            depth = node.get("depth", 1)
            parent_urn = node.get("parent_urn", "")
            impl_groups = node.get("implementation_groups", [])

            # Use ref_id as code when present; fall back to last URN segment
            code = ref_id or urn.split(":")[-1]

            if not code and not name:
                skipped_count += 1
                continue

            parent_req = urn_to_req.get(parent_urn) if parent_urn else None
            priority = _priority_from_groups(impl_groups)

            req, req_created = Requirement.objects.get_or_create(
                framework=framework,
                code=code,
                defaults={
                    "title": name,
                    "description": description or "",
                    "parent": parent_req,
                    "is_mandatory": assessable,
                    "priority": priority,
                    "sort_order": depth * 10,
                },
            )

            urn_to_req[urn] = req

            if req_created:
                created_count += 1
            else:
                skipped_count += 1

        # ── 7. Summary ────────────────────────────────────────────────────────
        assessable_count = sum(1 for n in requirement_nodes if n.get("assessable", False))

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"✅ TISAX v{version} import complete"))
        self.stdout.write(f"   Total nodes in YAML : {len(requirement_nodes)}")
        self.stdout.write(f"   Assessable (leaf)   : {assessable_count}")
        self.stdout.write(f"   Requirements created: {created_count}")
        self.stdout.write(f"   Already existed     : {skipped_count}")
        self.stdout.write("")
        self.stdout.write("Next step — adopt the framework for a company:")
        self.stdout.write(
            "  POST /api/compliance/adoptions/  {\"framework\": \"<framework-uuid>\"}"
        )


def _priority_from_groups(groups: list) -> str:
    groups_lower = [g.lower() for g in groups]
    if "must" in groups_lower or "critical" in groups_lower:
        return "critical"
    if "should" in groups_lower or "high" in groups_lower:
        return "high"
    if "may" in groups_lower or "medium" in groups_lower:
        return "medium"
    return "low"