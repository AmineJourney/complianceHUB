from django.contrib import admin
from .models import (
    ComplianceResult, ComplianceGap, FrameworkAdoption, ComplianceReport
)


@admin.register(ComplianceResult)
class ComplianceResultAdmin(admin.ModelAdmin):
    list_display = [
        'company', 'framework', 'department', 'compliance_score',
        'coverage_percentage', 'calculation_date', 'is_current'
    ]
    list_filter = ['status', 'is_current', 'calculation_date']
    search_fields = ['company__name', 'framework__code', 'framework__name']
    readonly_fields = ['calculation_date', 'created_at', 'updated_at']
    raw_id_fields = ['company', 'framework', 'department', 'calculated_by']


@admin.register(ComplianceGap)
class ComplianceGapAdmin(admin.ModelAdmin):
    list_display = [
        'requirement', 'gap_type', 'severity', 'status',
        'remediation_due_date', 'created_at'
    ]
    list_filter = ['gap_type', 'severity', 'status']
    search_fields = ['description', 'requirement__code']
    readonly_fields = ['created_at', 'updated_at', 'resolved_at']
    raw_id_fields = [
        'company', 'compliance_result', 'requirement',
        'remediation_owner', 'resolved_by'
    ]


@admin.register(FrameworkAdoption)
class FrameworkAdoptionAdmin(admin.ModelAdmin):
    list_display = [
        'company', 'framework', 'adoption_status', 'is_certified',
        'certification_expiry_date', 'created_at'
    ]
    list_filter = ['adoption_status', 'is_certified']
    search_fields = ['company__name', 'framework__code', 'certificate_number']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['company', 'framework', 'program_owner']


@admin.register(ComplianceReport)
class ComplianceReportAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'company', 'framework', 'report_type',
        'generation_status', 'created_at'
    ]
    list_filter = ['report_type', 'generation_status', 'report_format']
    search_fields = ['title', 'company__name', 'framework__code']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['company', 'framework', 'department', 'generated_by']