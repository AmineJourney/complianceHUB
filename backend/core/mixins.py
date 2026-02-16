from django.db import models
from .managers import TenantManager


class TenantMixin(models.Model):
    """
    Mixin for models that are scoped to a company/tenant
    """
    company = models.ForeignKey(
        'core.Company',
        on_delete=models.CASCADE,
        related_name='%(class)s_set'
    )
    
    objects = TenantManager()
    all_objects = models.Manager()  # Bypass tenant filtering
    
    class Meta:
        abstract = True
    
    def save(self, *args, **kwargs):
        """Ensure company is set"""
        if not self.company_id:
            raise ValueError(f'{self.__class__.__name__} requires a company')
        super().save(*args, **kwargs)