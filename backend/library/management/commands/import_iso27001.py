"""
management/commands/import_iso27001.py

Full import of ISO 27001:2022 from library/data/iso27001-2022.yaml.

Imports THREE things from the YAML:
  1. Framework + requirement tree  (objects.framework.requirement_nodes)
  2. Reference controls            (objects.reference_controls)
  3. Requirement->control mappings (requirement_node.reference_controls URN list)

Usage:
    python manage.py import_iso27001
    python manage.py import_iso27001 --path C:\\...\\backend\\library\\data\\iso27001-2022.yaml
    python manage.py import_iso27001 --reset
"""

import os
import yaml
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import transaction

from library.models import StoredLibrary, LoadedLibrary, Framework, Requirement
from controls.models import ReferenceControl, RequirementReferenceControl


DEFAULT_PATH = Path(__file__).resolve().parents[2] / "data" / "iso27001-2022.yaml"

CATEGORY_TO_FAMILY = {
    "policy":         "information_security",
    "process":        "operations_security",
    "technical":      "access_control",
    "physical":       "physical_security",
    "organizational": "information_security",
    "people":         "human_resources",
    "legal":          "compliance",
    "risk":           "risk_management",
    "supplier":       "supplier_relationships",
    "incident":       "incident_management",
    "continuity":     "business_continuity",
    "cryptography":   "cryptography",
    "asset":          "asset_management",
    "communications": "communications_security",
    "acquisition":    "system_acquisition",
}

CATEGORY_TO_TYPE = {
    "policy":         "preventive",
    "process":        "preventive",
    "technical":      "preventive",
    "physical":       "preventive",
    "organizational": "preventive",
    "people":         "preventive",
    "legal":          "detective",
    "risk":           "preventive",
    "supplier":       "detective",
    "incident":       "corrective",
    "continuity":     "corrective",
    "cryptography":   "preventive",
    "asset":          "preventive",
    "communications": "preventive",
    "acquisition":    "preventive",
}


class Command(BaseCommand):
    help = "Import ISO 27001:2022 — framework, reference controls, and mappings"

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default=str(DEFAULT_PATH),
            help="Path to iso27001-2022.yaml",
        )
        parser.add_argument(
            "--lib-version",
            type=str,
            default="2022.1",
            help="Version string for LoadedLibrary (default: 2022.1)",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing ISO 27001 requirements/mappings and reimport",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        yaml_path = options["path"]
        version = options["lib_version"]
        reset = options["reset"]

        # 1. Load YAML
        if not os.path.exists(yaml_path):
            self.stderr.write(self.style.ERROR(f"File not found: {yaml_path}"))
            self.stderr.write(
                "Pass full path: python manage.py import_iso27001 "
                "--path C:\\...\\backend\\library\\data\\iso27001-2022.yaml"
            )
            return

        self.stdout.write(f"Reading {yaml_path} ...")
        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        objects = data.get("objects", {})
        framework_data = objects.get("framework", {})
        requirement_nodes = framework_data.get("requirement_nodes", [])
        raw_controls = objects.get("reference_controls", [])

        if not requirement_nodes:
            self.stderr.write(self.style.ERROR("No requirement_nodes found."))
            return

        self.stdout.write(f"  Requirement nodes : {len(requirement_nodes)}")
        self.stdout.write(f"  Reference controls: {len(raw_controls)}")

        # 2. StoredLibrary
        stored_library, created = StoredLibrary.objects.get_or_create(
            name="ISO Standards",
            defaults={
                "description": "ISO/IEC information security standards",
                "raw_content": yaml.safe_dump(data),
                "content_format": "yaml",
                "source_url": "https://www.iso.org/standard/27001.html",
                "source_organization": "ISO/IEC",
                "library_type": "security",
            },
        )
        self._log("StoredLibrary", stored_library.name, created)

        # 3. LoadedLibrary
        loaded_library, created = LoadedLibrary.objects.get_or_create(
            stored_library=stored_library,
            version=version,
            defaults={"is_active": True, "processing_status": "completed"},
        )
        if not created and not loaded_library.is_active:
            loaded_library.is_active = True
            loaded_library.save()
        self._log("LoadedLibrary", f"v{version}", created)

        # 4. Framework
        framework, created = Framework.objects.get_or_create(
            loaded_library=loaded_library,
            code="ISO27001-2022",
            defaults={
                "name": framework_data.get("name", "ISO/IEC 27001:2022"),
                "description": framework_data.get("description", ""),
                "official_name": "ISO/IEC 27001:2022",
                "issuing_organization": "ISO/IEC",
                "category": "security",
                "scope": "Information security management systems requirements",
                "applicability": "Any organization seeking ISO 27001 certification",
                "official_url": "https://www.iso.org/standard/27001.html",
                "is_published": True,
            },
        )
        self._log("Framework", framework.name, created)

        if not created and reset:
            self.stdout.write(self.style.WARNING("  --reset: removing requirements & mappings ..."))
            RequirementReferenceControl.objects.filter(
                requirement__framework=framework
            ).delete()
            framework.requirements.all().delete()

        # 5. Reference controls
        self.stdout.write("\nImporting reference controls ...")
        urn_to_rc = {}
        rc_created = rc_skipped = 0

        for ctrl in raw_controls:
            urn = ctrl.get("urn", "")
            ref_id = ctrl.get("ref_id", "")
            name = ctrl.get("name", "")
            description = ctrl.get("description", "")
            category = ctrl.get("category", "").lower()
            code = ref_id or urn.split(":")[-1]
            if not code:
                continue

            rc, created = ReferenceControl.objects.get_or_create(
                code=code,
                defaults={
                    "name": name,
                    "description": description or name,
                    "control_family": CATEGORY_TO_FAMILY.get(category, "information_security"),
                    "control_type": CATEGORY_TO_TYPE.get(category, "preventive"),
                    "priority": "medium",
                    "is_published": True,
                    "implementation_guidance": description or "",
                },
            )
            urn_to_rc[urn] = rc
            if created:
                rc_created += 1
            else:
                rc_skipped += 1
                # Fill missing fields on existing stubs
                changed = False
                if not rc.name and name:
                    rc.name = name; changed = True
                if not rc.description and description:
                    rc.description = description; changed = True
                if changed:
                    rc.save()

        self.stdout.write(f"  Created: {rc_created}  Already existed: {rc_skipped}")

        # 6. Requirements
        self.stdout.write("\nImporting requirement nodes ...")
        urn_to_req = {}
        req_created = req_skipped = 0
        req_control_links = []   # [(Requirement, [ctrl_urn, ...])]

        for node in requirement_nodes:
            urn = node.get("urn", "")
            ref_id = node.get("ref_id", "")
            name = node.get("name", "")
            description = node.get("description", "")
            assessable = node.get("assessable", False)
            depth = node.get("depth", 1)
            parent_urn = node.get("parent_urn", "")
            impl_groups = node.get("implementation_groups", [])
            control_urns = node.get("reference_controls", [])

            code = ref_id or urn.split(":")[-1]
            if not code and not name:
                continue

            parent_req = urn_to_req.get(parent_urn) if parent_urn else None

            req, created = Requirement.objects.get_or_create(
                framework=framework,
                code=code,
                defaults={
                    "title": name,
                    "description": description or "",
                    "parent": parent_req,
                    "is_mandatory": assessable,
                    "priority": _priority_from_groups(impl_groups),
                    "sort_order": depth * 10,
                },
            )
            urn_to_req[urn] = req
            if control_urns:
                req_control_links.append((req, control_urns))
            if created:
                req_created += 1
            else:
                req_skipped += 1

        self.stdout.write(f"  Created: {req_created}  Already existed: {req_skipped}")

        # 7. Requirement -> ReferenceControl mappings
        self.stdout.write("\nCreating requirement->control mappings ...")
        map_created = map_skipped = stubs = 0

        for req, control_urns in req_control_links:
            for ctrl_urn in control_urns:
                rc = urn_to_rc.get(ctrl_urn)
                if rc is None:
                    # Dependency library control (e.g. doc-pol) not in our list
                    ref_id = ctrl_urn.split(":")[-1]
                    rc, _ = ReferenceControl.objects.get_or_create(
                        code=ref_id,
                        defaults={
                            "name": ref_id.replace(".", " ").replace("_", " ").title(),
                            "description": f"Referenced control: {ctrl_urn}",
                            "control_family": "information_security",
                            "control_type": "preventive",
                            "priority": "medium",
                            "is_published": True,
                        },
                    )
                    urn_to_rc[ctrl_urn] = rc
                    stubs += 1

                _, created = RequirementReferenceControl.objects.get_or_create(
                    requirement=req,
                    reference_control=rc,
                    defaults={
                        "coverage_level": "full",
                        "is_primary": True,
                        "validation_status": "validated",
                    },
                )
                if created:
                    map_created += 1
                else:
                    map_skipped += 1

        self.stdout.write(f"  Created: {map_created}  Already existed: {map_skipped}  Stubs: {stubs}")

        # 8. Summary
        assessable = sum(1 for n in requirement_nodes if n.get("assessable"))
        total_rc = ReferenceControl.objects.filter(is_deleted=False).count()
        total_maps = RequirementReferenceControl.objects.filter(
            requirement__framework=framework
        ).count()

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("ISO 27001:2022 import complete"))
        self.stdout.write(f"   Requirement nodes    : {len(requirement_nodes)} ({assessable} assessable)")
        self.stdout.write(f"   Reference controls   : {total_rc} in DB")
        self.stdout.write(f"   Req->control mappings: {total_maps}")

    def _log(self, kind, label, created):
        verb = "Created" if created else "Found"
        self.stdout.write(f"  {verb} {kind}: {label}")


def _priority_from_groups(groups):
    gl = [g.lower() for g in groups]
    if "critical" in gl or "must" in gl:
        return "critical"
    if "high" in gl or "should" in gl:
        return "high"
    if "medium" in gl or "may" in gl or "soa" in gl:
        return "medium"
    return "low"