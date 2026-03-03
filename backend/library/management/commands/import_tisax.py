"""
management/commands/import_tisax.py

Imports TISAX v6 from the local YAML file at:
    backend/library/data/tisax-v6.yaml

Imports THREE things (now matching import_iso27001.py):
  1. Framework + requirement tree
  2. ReferenceControl records  (one per assessable requirement node)
  3. RequirementReferenceControl mappings

Usage:
    python manage.py import_tisax
    python manage.py import_tisax --path /full/path/to/tisax-v6.yaml
    python manage.py import_tisax --reset   # wipe & reimport
"""

import os
import yaml
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import transaction

from library.models import StoredLibrary, LoadedLibrary, Framework, Requirement
from controls.models import ReferenceControl, RequirementReferenceControl


DEFAULT_PATH = Path(__file__).resolve().parents[2] / "data" / "tisax-v6.yaml"

# Map inferred category to ReferenceControl.control_family choices
CATEGORY_TO_FAMILY = {
    "information":    "information_security",
    "physical":       "physical_security",
    "personnel":      "human_resources",
    "technical":      "access_control",
    "organizational": "information_security",
    "supplier":       "supplier_relationships",
    "incident":       "incident_management",
    "continuity":     "business_continuity",
    "prototype":      "physical_security",
    "development":    "system_acquisition",
    "cloud":          "operations_security",
}

CATEGORY_TO_TYPE = {
    "information":    "preventive",
    "physical":       "preventive",
    "personnel":      "preventive",
    "technical":      "preventive",
    "organizational": "preventive",
    "supplier":       "detective",
    "incident":       "corrective",
    "continuity":     "corrective",
    "prototype":      "preventive",
    "development":    "preventive",
    "cloud":          "preventive",
}


class Command(BaseCommand):
    help = "Import TISAX v6 — framework, requirements, reference controls, and mappings"

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
            help="Delete existing TISAX requirements/mappings and reimport from scratch",
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
                "  python manage.py import_tisax --path /full/path/to/tisax-v6.yaml"
            )
            return

        self.stdout.write(f"Reading {yaml_path} …")
        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        # ── 2. Extract sections ───────────────────────────────────────────────
        objects = data.get("objects", {})
        framework_data = objects.get("framework", data)
        requirement_nodes = framework_data.get("requirement_nodes", [])

        if not requirement_nodes:
            self.stderr.write(self.style.ERROR(
                "No 'requirement_nodes' found — check the YAML structure."
            ))
            return

        self.stdout.write(f"Found {len(requirement_nodes)} requirement nodes")

        framework_name = framework_data.get("name", f"TISAX v{version}")
        framework_desc = framework_data.get(
            "description", "Trusted Information Security Assessment Exchange"
        )
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
        self._log("StoredLibrary", stored_library.name, created)

        # ── 4. LoadedLibrary ──────────────────────────────────────────────────
        loaded_library, created = LoadedLibrary.objects.get_or_create(
            stored_library=stored_library,
            version=version,
            defaults={"is_active": True, "processing_status": "completed"},
        )
        if not created and not loaded_library.is_active:
            loaded_library.is_active = True
            loaded_library.save()
        self._log("LoadedLibrary", f"v{version}", created)

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
        self._log("Framework", framework.name, created)

        if not created and reset:
            self.stdout.write(self.style.WARNING("  --reset: removing requirements & mappings …"))
            RequirementReferenceControl.objects.filter(
                requirement__framework=framework
            ).delete()
            framework.requirements.all().delete()

        # ── 6. Requirements ───────────────────────────────────────────────────
        self.stdout.write("\nImporting requirement nodes …")
        urn_to_req = {}
        req_created = req_skipped = 0
        assessable_nodes = []  # (node_dict, Requirement) for step 7

        for node in requirement_nodes:
            urn        = node.get("urn", "")
            ref_id     = node.get("ref_id", "")
            name       = node.get("name", "")
            description = node.get("description", "")
            assessable = node.get("assessable", False)
            depth      = node.get("depth", 1)
            parent_urn = node.get("parent_urn", "")
            impl_groups = node.get("implementation_groups", [])

            code = ref_id or urn.split(":")[-1]
            if not code and not name:
                continue

            parent_req = urn_to_req.get(parent_urn) if parent_urn else None
            priority   = _priority_from_groups(impl_groups)

            req, req_was_created = Requirement.objects.get_or_create(
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

            if assessable:
                assessable_nodes.append((node, req))

            if req_was_created:
                req_created += 1
            else:
                req_skipped += 1

        self.stdout.write(f"  Created: {req_created}  Already existed: {req_skipped}")

        # ── 7. Reference Controls ─────────────────────────────────────────────
        #
        # TISAX YAML has no separate reference_controls section.
        # We create one ReferenceControl per assessable requirement using that
        # requirement's own data — each assessable node IS effectively a control
        # in TISAX (unlike ISO 27001 where controls are a separate list).
        #
        self.stdout.write("\nImporting reference controls from assessable requirements …")
        rc_created = rc_skipped = 0

        for node, req in assessable_nodes:
            ref_id      = node.get("ref_id", "")
            name        = node.get("name", "")
            description = node.get("description", "")
            impl_groups = node.get("implementation_groups", [])
            urn         = node.get("urn", "")

            category = _category_from_node(ref_id, [g.lower() for g in impl_groups])
            # Prefix with TISAX- to avoid code collisions with ISO 27001 controls
            code = f"TISAX-{ref_id}" if ref_id else f"TISAX-{urn.split(':')[-1]}"

            rc, was_created = ReferenceControl.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "description": description or name,
                    "control_family": CATEGORY_TO_FAMILY.get(category, "information_security"),
                    "control_type":   CATEGORY_TO_TYPE.get(category, "preventive"),
                    "priority":       _priority_from_groups(impl_groups),
                    "is_published":   True,
                    "implementation_guidance": description or "",
                },
            )

            if was_created:
                rc_created += 1
            else:
                rc_skipped += 1
                # Backfill missing fields on pre-existing stubs
                changed = False
                if not rc.name and name:
                    rc.name = name
                    changed = True
                if not rc.description and description:
                    rc.description = description
                    changed = True
                if changed:
                    rc.save()

            # ── 8. Requirement → ReferenceControl mapping ─────────────────────
            RequirementReferenceControl.objects.get_or_create(
                requirement=req,
                reference_control=rc,
                defaults={
                    "coverage_level": "full",
                    "is_primary": True,
                    "validation_status": "validated",
                },
            )

        self.stdout.write(f"  Created: {rc_created}  Already existed: {rc_skipped}")

        # ── 9. Summary ────────────────────────────────────────────────────────
        assessable_count = sum(1 for n in requirement_nodes if n.get("assessable", False))
        total_maps = RequirementReferenceControl.objects.filter(
            requirement__framework=framework
        ).count()

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"✅  TISAX v{version} import complete"))
        self.stdout.write(f"   Total nodes in YAML : {len(requirement_nodes)}")
        self.stdout.write(f"   Assessable (leaf)   : {assessable_count}")
        self.stdout.write(f"   Req created         : {req_created}")
        self.stdout.write(f"   Reference controls  : {rc_created} created, {rc_skipped} existing")
        self.stdout.write(f"   Req→control maps    : {total_maps}")
        self.stdout.write("")
        self.stdout.write("Next — adopt the framework for a company:")
        self.stdout.write(
            '  POST /api/compliance/adoptions/  {"framework": "<framework-uuid>"}'
        )

    def _log(self, kind, label, created):
        verb = "Created" if created else "Found"
        self.stdout.write(f"  {verb} {kind}: {label}")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _priority_from_groups(groups: list) -> str:
    gl = [g.lower() for g in groups]
    if "must" in gl or "critical" in gl:
        return "critical"
    if "should" in gl or "high" in gl:
        return "high"
    if "may" in gl or "medium" in gl:
        return "medium"
    return "low"


def _category_from_node(ref_id: str, impl_groups_lower: list) -> str:
    """
    Infer a category string from the TISAX ref_id prefix
    (e.g. IS-1.1 → information, PH-1.1 → physical)
    or fall back to implementation_groups keywords.
    """
    r = ref_id.lower()
    if r.startswith("is"):
        return "information"
    if r.startswith("ph") or r.startswith("pp"):
        return "physical"
    if r.startswith("hr"):
        return "personnel"
    if r.startswith("sm"):
        return "supplier"
    if r.startswith("bc") or r.startswith("cr"):
        return "continuity"
    if r.startswith("dev") or r.startswith("sd"):
        return "development"
    if r.startswith("cl"):
        return "cloud"
    # Fall back to impl_group keywords
    for group in impl_groups_lower:
        for key in CATEGORY_TO_FAMILY:
            if key in group:
                return key
    return "information"