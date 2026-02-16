import uuid
from django.db import models
from django.core.exceptions import ValidationError
from core.models import TimeStampedModel, SoftDeleteModel


class StoredLibrary(TimeStampedModel, SoftDeleteModel):
    """
    Master library storage for compliance frameworks
    Stores raw content that can be versioned via LoadedLibrary
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(
        max_length=255, 
        unique=True,
        help_text='Library name (e.g., "ISO Standards", "NIST Framework")'
    )
    description = models.TextField(blank=True)
    
    # Raw content storage
    raw_content = models.TextField(
        help_text='Raw library data (JSON, XML, or structured text)'
    )
    content_format = models.CharField(
        max_length=20,
        choices=[
            ('json', 'JSON'),
            ('xml', 'XML'),
            ('yaml', 'YAML'),
            ('text', 'Plain Text'),
        ],
        default='json'
    )
    
    # Source metadata
    source_url = models.URLField(blank=True, help_text='Official source URL')
    source_organization = models.CharField(max_length=255, blank=True)
    
    # Library type categorization
    library_type = models.CharField(
        max_length=50,
        choices=[
            ('security', 'Security & Privacy'),
            ('quality', 'Quality Management'),
            ('financial', 'Financial Compliance'),
            ('healthcare', 'Healthcare'),
            ('industry', 'Industry-Specific'),
            ('other', 'Other'),
        ],
        default='security'
    )
    
    class Meta:
        db_table = 'stored_libraries'
        verbose_name_plural = 'Stored Libraries'
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['library_type']),
        ]
    
    def __str__(self):
        return self.name
    
    def get_active_version(self):
        """Get currently active LoadedLibrary version"""
        return self.loaded_versions.filter(is_active=True, is_deleted=False).first()
    
    def get_all_versions(self):
        """Get all versions ordered by version number"""
        return self.loaded_versions.filter(is_deleted=False).order_by('-version')


class LoadedLibrary(TimeStampedModel, SoftDeleteModel):
    """
    Versioned instance of a StoredLibrary
    Multiple versions can exist, but only one should be active
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    stored_library = models.ForeignKey(
        StoredLibrary,
        on_delete=models.CASCADE,
        related_name='loaded_versions'
    )
    
    version = models.CharField(
        max_length=50,
        help_text='Version identifier (e.g., "2023.1", "v4.0")'
    )
    
    is_active = models.BooleanField(
        default=False,
        help_text='Only one version should be active per StoredLibrary'
    )
    
    # Version metadata
    release_date = models.DateField(null=True, blank=True)
    deprecation_date = models.DateField(null=True, blank=True)
    
    # Processing status
    processing_status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending Processing'),
            ('processing', 'Processing'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )
    processing_notes = models.TextField(blank=True)
    
    # Change tracking
    changelog = models.TextField(
        blank=True,
        help_text='What changed in this version'
    )
    
    class Meta:
        db_table = 'loaded_libraries'
        verbose_name_plural = 'Loaded Libraries'
        unique_together = [['stored_library', 'version']]
        ordering = ['-version']
        indexes = [
            models.Index(fields=['stored_library', 'is_active']),
            models.Index(fields=['is_active', 'processing_status']),
        ]
    
    def __str__(self):
        return f"{self.stored_library.name} v{self.version}"
    
    def clean(self):
        """Validate loaded library"""
        # Check if another version is already active
        if self.is_active and not self.pk:
            active_exists = LoadedLibrary.objects.filter(
                stored_library=self.stored_library,
                is_active=True,
                is_deleted=False
            ).exclude(pk=self.pk).exists()
            
            if active_exists:
                raise ValidationError({
                    'is_active': f'Another version of {self.stored_library.name} is already active'
                })
    
    def activate(self):
        """Activate this version and deactivate others"""
        # Deactivate all other versions
        LoadedLibrary.objects.filter(
            stored_library=self.stored_library,
            is_deleted=False
        ).exclude(pk=self.pk).update(is_active=False)
        
        # Activate this version
        self.is_active = True
        self.save()
    
    def get_framework_count(self):
        """Count frameworks in this version"""
        return self.frameworks.filter(is_deleted=False).count()


class Framework(TimeStampedModel, SoftDeleteModel):
    """
    Compliance framework within a LoadedLibrary
    (e.g., ISO 27001, SOC 2 Type II, NIST CSF)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    loaded_library = models.ForeignKey(
        LoadedLibrary,
        on_delete=models.CASCADE,
        related_name='frameworks'
    )
    
    name = models.CharField(
        max_length=255,
        help_text='Framework name (e.g., "ISO/IEC 27001:2022")'
    )
    code = models.CharField(
        max_length=100,
        help_text='Framework code/abbreviation (e.g., "ISO27001")'
    )
    description = models.TextField(blank=True)
    
    # Framework metadata
    official_name = models.CharField(max_length=500, blank=True)
    issuing_organization = models.CharField(
        max_length=255,
        blank=True,
        help_text='e.g., ISO, NIST, AICPA'
    )
    
    # Categorization
    category = models.CharField(
        max_length=100,
        choices=[
            ('security', 'Information Security'),
            ('privacy', 'Data Privacy'),
            ('quality', 'Quality Management'),
            ('financial', 'Financial Controls'),
            ('healthcare', 'Healthcare Compliance'),
            ('industry', 'Industry-Specific'),
        ],
        default='security'
    )
    
    # Framework scope
    scope = models.TextField(
        blank=True,
        help_text='What this framework covers'
    )
    applicability = models.TextField(
        blank=True,
        help_text='When/where this framework applies'
    )
    
    # Reference information
    official_url = models.URLField(blank=True)
    documentation_url = models.URLField(blank=True)
    
    # Status
    is_published = models.BooleanField(
        default=True,
        help_text='Whether this framework is visible to companies'
    )
    
    class Meta:
        db_table = 'frameworks'
        unique_together = [['loaded_library', 'code']]
        ordering = ['name']
        indexes = [
            models.Index(fields=['loaded_library', 'code']),
            models.Index(fields=['category', 'is_published']),
            models.Index(fields=['code']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.code})"
    
    def get_requirement_count(self):
        """Count requirements in this framework"""
        return self.requirements.filter(is_deleted=False).count()
    
    def get_requirement_tree(self):
        """Get hierarchical requirement structure"""
        # Get root requirements (no parent)
        roots = self.requirements.filter(parent__isnull=True, is_deleted=False)
        
        def build_tree(requirement):
            children = requirement.children.filter(is_deleted=False)
            return {
                'id': requirement.id,
                'code': requirement.code,
                'title': requirement.title,
                'children': [build_tree(child) for child in children]
            }
        
        return [build_tree(root) for root in roots]


class Requirement(TimeStampedModel, SoftDeleteModel):
    """
    Individual requirement/control within a Framework
    Supports hierarchical structure (e.g., A.5 → A.5.1 → A.5.1.1)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    framework = models.ForeignKey(
        Framework,
        on_delete=models.CASCADE,
        related_name='requirements'
    )
    
    # Hierarchical structure
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='children'
    )
    
    # Requirement identification
    code = models.CharField(
        max_length=100,
        help_text='Requirement code (e.g., "A.5.1", "CC6.1")'
    )
    title = models.CharField(max_length=500)
    description = models.TextField(
        help_text='Full requirement description'
    )
    
    # Additional requirement details
    objective = models.TextField(
        blank=True,
        help_text='What this requirement aims to achieve'
    )
    implementation_guidance = models.TextField(
        blank=True,
        help_text='How to implement this requirement'
    )
    
    # Requirement metadata
    requirement_type = models.CharField(
        max_length=50,
        choices=[
            ('control', 'Control'),
            ('section', 'Section/Category'),
            ('policy', 'Policy'),
            ('procedure', 'Procedure'),
            ('objective', 'Objective'),
        ],
        default='control'
    )
    
    priority = models.CharField(
        max_length=20,
        choices=[
            ('critical', 'Critical'),
            ('high', 'High'),
            ('medium', 'Medium'),
            ('low', 'Low'),
        ],
        default='medium'
    )
    
    # Ordering within framework
    sort_order = models.IntegerField(
        default=0,
        help_text='Display order within parent'
    )
    
    # Requirement status
    is_mandatory = models.BooleanField(
        default=True,
        help_text='Whether this requirement is mandatory for compliance'
    )
    
    class Meta:
        db_table = 'requirements'
        unique_together = [['framework', 'code']]
        ordering = ['sort_order', 'code']
        indexes = [
            models.Index(fields=['framework', 'parent']),
            models.Index(fields=['framework', 'code']),
            models.Index(fields=['requirement_type', 'is_mandatory']),
        ]
    
    def __str__(self):
        return f"{self.code}: {self.title}"
    
    def clean(self):
        """Validate requirement"""
        # Prevent circular references
        if self.parent:
            if self.parent == self:
                raise ValidationError({'parent': 'Requirement cannot be its own parent'})
            
            # Check if parent belongs to same framework
            if self.parent.framework != self.framework:
                raise ValidationError({'parent': 'Parent must belong to same framework'})
            
            # Prevent circular references
            current = self.parent
            visited = {self.id}
            while current:
                if current.id in visited:
                    raise ValidationError({
                        'parent': 'Circular reference detected in requirement hierarchy'
                    })
                visited.add(current.id)
                current = current.parent
    
    def get_full_code(self):
        """Get full hierarchical code (e.g., A.5.1.2)"""
        if not self.parent:
            return self.code
        
        ancestors = []
        current = self.parent
        while current:
            ancestors.append(current.code)
            current = current.parent
        
        ancestors.reverse()
        return '.'.join(ancestors + [self.code])
    
    def get_ancestors(self):
        """Get all ancestor requirements"""
        ancestors = []
        current = self.parent
        while current:
            ancestors.append(current)
            current = current.parent
        return ancestors
    
    def get_descendants(self):
        """Get all descendant requirements"""
        descendants = []
        
        def collect_children(req):
            for child in req.children.filter(is_deleted=False):
                descendants.append(child)
                collect_children(child)
        
        collect_children(self)
        return descendants
    
    def get_depth(self):
        """Get depth in hierarchy (0 = root)"""
        depth = 0
        current = self.parent
        while current:
            depth += 1
            current = current.parent
        return depth