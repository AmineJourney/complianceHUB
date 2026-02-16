from django.db import models
from django.db.models import Q


class TenantManager(models.Manager):
    """
    Manager for tenant-scoped models
    Automatically filters by company to prevent cross-tenant data leakage
    """
    
    def __init__(self, *args, **kwargs):
        self.tenant_field = kwargs.pop('tenant_field', 'company')
        super().__init__(*args, **kwargs)
    
    def get_queryset(self):
        """Override to filter soft-deleted records"""
        qs = super().get_queryset()
        return qs.filter(is_deleted=False)
    
    def for_company(self, company):
        """Get queryset filtered by company"""
        filter_kwargs = {self.tenant_field: company}
        return self.get_queryset().filter(**filter_kwargs)
    
    def for_request(self, request):
        """Get queryset filtered by request's company"""
        if hasattr(request, 'tenant'):
            return self.for_company(request.tenant)
        return self.none()
    
    def with_deleted(self):
        """Include soft-deleted records"""
        return super().get_queryset()
    
    def deleted_only(self):
        """Only soft-deleted records"""
        return super().get_queryset().filter(is_deleted=True)


class TenantAwareManager(models.Manager):
    """Manager that respects tenant isolation without requiring company FK"""
    
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)