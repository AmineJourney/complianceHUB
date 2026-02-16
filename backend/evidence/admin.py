from django.contrib import admin
from .models import Evidence, AppliedControlEvidence, EvidenceAccessLog, EvidenceComment


@admin.register(Evidence)
class EvidenceAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'company', 'evidence_type', 'verification_status',
        'uploaded_by', 'file_size', 'created_at'
    ]
    list_filter = ['evidence_type', 'verification_status', 'is_valid', 'is_confidential']
    search_fields = ['name', 'description', 'company__name']
    readonly_fields = ['file_size', 'file_type', 'file_hash', 'created_at', 'updated_at']
    raw_id_fields = ['company', 'uploaded_by', 'verified_by', 'previous_version']


@admin.register(AppliedControlEvidence)
class AppliedControlEvidenceAdmin(admin.ModelAdmin):
    list_display = ['applied_control', 'evidence', 'link_type', 'relevance_score', 'created_at']
    list_filter = ['link_type']
    search_fields = ['applied_control__reference_control__code', 'evidence__name']
    raw_id_fields = ['company', 'applied_control', 'evidence', 'linked_by']


@admin.register(EvidenceAccessLog)
class EvidenceAccessLogAdmin(admin.ModelAdmin):
    list_display = ['evidence', 'accessed_by', 'access_type', 'ip_address', 'created_at']
    list_filter = ['access_type', 'created_at']
    search_fields = ['evidence__name', 'accessed_by__email']
    readonly_fields = ['created_at']
    raw_id_fields = ['company', 'evidence', 'accessed_by']


@admin.register(EvidenceComment)
class EvidenceCommentAdmin(admin.ModelAdmin):
    list_display = ['evidence', 'author', 'comment_preview', 'created_at']
    list_filter = ['created_at']
    search_fields = ['evidence__name', 'author__email', 'comment']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['company', 'evidence', 'author', 'parent']
    
    def comment_preview(self, obj):
        return obj.comment[:50] + '...' if len(obj.comment) > 50 else obj.comment
    comment_preview.short_description = 'Comment'

