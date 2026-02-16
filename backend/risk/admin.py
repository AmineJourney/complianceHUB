from django.contrib import admin
from .models import (
    RiskMatrix, Risk, RiskAssessment, RiskEvent, RiskTreatmentAction
)


@admin.register(RiskMatrix)
class RiskMatrixAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'company', 'likelihood_levels', 'impact_levels',
        'is_active', 'created_at'
    ]
    list_filter = ['is_active']
    search_fields = ['name', 'company__name']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['company']


@admin.register(Risk)
class RiskAdmin(admin.ModelAdmin):
    list_display = [
        'risk_id', 'title', 'company', 'risk_category',
        'inherent_risk_level', 'status', 'risk_owner'
    ]
    list_filter = ['risk_category', 'inherent_risk_level', 'status', 'risk_source']
    search_fields = ['title', 'description', 'risk_id']
    readonly_fields = ['inherent_risk_score', 'inherent_risk_level', 'created_at', 'updated_at']
    raw_id_fields = ['company', 'risk_matrix', 'risk_owner', 'department']
    
    fieldsets = (
        ('Identification', {
            'fields': ('company', 'risk_matrix', 'title', 'description', 'risk_id')
        }),
        ('Categorization', {
            'fields': ('risk_category', 'risk_source', 'department', 'tags')
        }),
        ('Inherent Risk', {
            'fields': ('inherent_likelihood', 'inherent_impact', 'inherent_risk_score', 'inherent_risk_level')
        }),
        ('Context', {
            'fields': ('potential_causes', 'potential_consequences')
        }),
        ('Treatment', {
            'fields': ('treatment_strategy', 'treatment_plan', 'status', 'target_likelihood', 'target_impact')
        }),
        ('Ownership', {
            'fields': ('risk_owner',)
        }),
        ('Review', {
            'fields': ('last_review_date', 'next_review_date', 'review_frequency_days')
        }),
    )


@admin.register(RiskAssessment)
class RiskAssessmentAdmin(admin.ModelAdmin):
    list_display = [
        'risk', 'applied_control', 'control_effectiveness',
        'residual_score', 'residual_risk_level', 'assessment_date', 'is_current'
    ]
    list_filter = ['control_effectiveness', 'residual_risk_level', 'is_current']
    search_fields = ['risk__title', 'applied_control__reference_control__code']
    readonly_fields = ['residual_score', 'residual_risk_level', 'created_at', 'updated_at']
    raw_id_fields = ['company', 'risk', 'applied_control', 'assessed_by']


@admin.register(RiskEvent)
class RiskEventAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'risk', 'event_date', 'actual_impact',
        'financial_impact', 'is_resolved'
    ]
    list_filter = ['is_resolved', 'event_date']
    search_fields = ['title', 'description', 'risk__title']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['company', 'risk']


@admin.register(RiskTreatmentAction)
class RiskTreatmentActionAdmin(admin.ModelAdmin):
    list_display = [
        'action_title', 'risk', 'action_type', 'status',
        'action_owner', 'due_date', 'progress_percentage'
    ]
    list_filter = ['action_type', 'status']
    search_fields = ['action_title', 'action_description', 'risk__title']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['company', 'risk', 'action_owner']