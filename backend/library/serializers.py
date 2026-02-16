from rest_framework import serializers
from .models import StoredLibrary, LoadedLibrary, Framework, Requirement


class StoredLibrarySerializer(serializers.ModelSerializer):
    """Stored library serializer"""
    
    active_version = serializers.SerializerMethodField()
    total_versions = serializers.SerializerMethodField()
    
    class Meta:
        model = StoredLibrary
        fields = [
            'id', 'name', 'description', 'content_format', 'library_type',
            'source_url', 'source_organization', 'active_version', 'total_versions',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_active_version(self, obj):
        active = obj.get_active_version()
        if active:
            return {
                'id': active.id,
                'version': active.version,
                'release_date': active.release_date
            }
        return None
    
    def get_total_versions(self, obj):
        return obj.loaded_versions.filter(is_deleted=False).count()


class StoredLibraryDetailSerializer(StoredLibrarySerializer):
    """Detailed stored library with raw content"""
    
    class Meta(StoredLibrarySerializer.Meta):
        fields = StoredLibrarySerializer.Meta.fields + ['raw_content']


class LoadedLibrarySerializer(serializers.ModelSerializer):
    """Loaded library version serializer"""
    
    stored_library_name = serializers.CharField(source='stored_library.name', read_only=True)
    framework_count = serializers.SerializerMethodField()
    
    class Meta:
        model = LoadedLibrary
        fields = [
            'id', 'stored_library', 'stored_library_name', 'version', 'is_active',
            'release_date', 'deprecation_date', 'processing_status', 'processing_notes',
            'changelog', 'framework_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'framework_count']
    
    def get_framework_count(self, obj):
        return obj.get_framework_count()
    
    def validate(self, attrs):
        """Validate loaded library"""
        # Check if activating
        if attrs.get('is_active', False):
            stored_lib = attrs.get('stored_library')
            
            # Check if another version is already active
            if self.instance:
                # Update case
                existing_active = LoadedLibrary.objects.filter(
                    stored_library=stored_lib or self.instance.stored_library,
                    is_active=True,
                    is_deleted=False
                ).exclude(pk=self.instance.pk).exists()
            else:
                # Create case
                existing_active = LoadedLibrary.objects.filter(
                    stored_library=stored_lib,
                    is_active=True,
                    is_deleted=False
                ).exists()
            
            if existing_active:
                raise serializers.ValidationError({
                    'is_active': 'Another version is already active. Deactivate it first.'
                })
        
        return attrs


class RequirementListSerializer(serializers.ModelSerializer):
    """Lightweight requirement serializer for lists"""
    
    parent_code = serializers.CharField(source='parent.code', read_only=True)
    full_code = serializers.CharField(source='get_full_code', read_only=True)
    
    class Meta:
        model = Requirement
        fields = [
            'id', 'code', 'full_code', 'title', 'requirement_type',
            'priority', 'is_mandatory', 'parent', 'parent_code'
        ]


class RequirementDetailSerializer(serializers.ModelSerializer):
    """Detailed requirement serializer"""
    
    parent_code = serializers.CharField(source='parent.code', read_only=True)
    full_code = serializers.CharField(source='get_full_code', read_only=True)
    depth = serializers.IntegerField(source='get_depth', read_only=True)
    children_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Requirement
        fields = [
            'id', 'framework', 'parent', 'parent_code', 'code', 'full_code',
            'title', 'description', 'objective', 'implementation_guidance',
            'requirement_type', 'priority', 'sort_order', 'is_mandatory',
            'depth', 'children_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_children_count(self, obj):
        return obj.children.filter(is_deleted=False).count()
    
    def validate(self, attrs):
        """Validate requirement"""
        parent = attrs.get('parent')
        framework = attrs.get('framework', getattr(self.instance, 'framework', None))
        
        # Validate parent belongs to same framework
        if parent and parent.framework != framework:
            raise serializers.ValidationError({
                'parent': 'Parent requirement must belong to the same framework'
            })
        
        return attrs


class RequirementTreeSerializer(serializers.ModelSerializer):
    """Hierarchical requirement tree serializer"""
    
    children = serializers.SerializerMethodField()
    
    class Meta:
        model = Requirement
        fields = [
            'id', 'code', 'title', 'requirement_type', 'priority',
            'is_mandatory', 'children'
        ]
    
    def get_children(self, obj):
        children = obj.children.filter(is_deleted=False).order_by('sort_order', 'code')
        return RequirementTreeSerializer(children, many=True).data


class FrameworkSerializer(serializers.ModelSerializer):
    """Framework serializer"""
    
    loaded_library_version = serializers.CharField(
        source='loaded_library.version', 
        read_only=True
    )
    requirement_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Framework
        fields = [
            'id', 'loaded_library', 'loaded_library_version', 'name', 'code',
            'description', 'official_name', 'issuing_organization', 'category',
            'scope', 'applicability', 'official_url', 'documentation_url',
            'is_published', 'requirement_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_requirement_count(self, obj):
        return obj.get_requirement_count()


class FrameworkDetailSerializer(FrameworkSerializer):
    """Detailed framework with requirements tree"""
    
    requirements_tree = serializers.SerializerMethodField()
    
    class Meta(FrameworkSerializer.Meta):
        fields = FrameworkSerializer.Meta.fields + ['requirements_tree']
    
    def get_requirements_tree(self, obj):
        # Get root requirements
        roots = obj.requirements.filter(
            parent__isnull=True, 
            is_deleted=False
        ).order_by('sort_order', 'code')
        return RequirementTreeSerializer(roots, many=True).data