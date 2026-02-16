import uuid
from django.db import models
from core.models import TimeStampedModel, SoftDeleteModel
from core.mixins import TenantMixin
from django.core.exceptions import ValidationError


class Department(TenantMixin, TimeStampedModel, SoftDeleteModel):
    """
    Hierarchical department structure within a company
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # Self-referential FK for hierarchy
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children'
    )
    
    # Additional metadata
    code = models.CharField(max_length=50, blank=True, help_text='Department code/abbreviation')
    manager = models.ForeignKey(
        'core.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_departments'
    )
    
    class Meta:
        db_table = 'departments'
        unique_together = [['company', 'name']]
        ordering = ['name']
        indexes = [
            models.Index(fields=['company', 'parent']),
            models.Index(fields=['company', 'name']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.company.name})"
    
    def clean(self):
        """Validate department hierarchy"""
        # Prevent circular references
        if self.parent:
            if self.parent == self:
                raise ValidationError({'parent': 'Department cannot be its own parent'})
            
            # Check if parent belongs to same company
            if self.parent.company != self.company:
                raise ValidationError({'parent': 'Parent must belong to same company'})
            
            # Prevent deep circular references
            current = self.parent
            visited = {self.id}
            while current:
                if current.id in visited:
                    raise ValidationError({
                        'parent': 'Circular reference detected in department hierarchy'
                    })
                visited.add(current.id)
                current = current.parent
    
    def get_ancestors(self):
        """Get all ancestor departments"""
        ancestors = []
        current = self.parent
        while current:
            ancestors.append(current)
            current = current.parent
        return ancestors
    
    def get_descendants(self):
        """Get all descendant departments (recursive)"""
        descendants = []
        
        def collect_children(dept):
            for child in dept.children.filter(is_deleted=False):
                descendants.append(child)
                collect_children(child)
        
        collect_children(self)
        return descendants
    
    def get_full_path(self):
        """Get full hierarchical path"""
        ancestors = self.get_ancestors()
        ancestors.reverse()
        path = [a.name for a in ancestors] + [self.name]
        return ' > '.join(path)