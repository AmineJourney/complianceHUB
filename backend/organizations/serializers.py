from rest_framework import serializers
from .models import Department


class DepartmentSerializer(serializers.ModelSerializer):
    """Department serializer with hierarchy support"""
    
    parent_name = serializers.CharField(source='parent.name', read_only=True)
    full_path = serializers.CharField(source='get_full_path', read_only=True)
    children_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Department
        fields = [
            'id', 'name', 'description', 'code', 'parent', 'parent_name',
            'manager', 'full_path', 'children_count', 'company',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at']
    
    def get_children_count(self, obj):
        return obj.children.filter(is_deleted=False).count()
    
    def validate(self, attrs):
        """Validate department data"""
        request = self.context.get('request')
        
        # Set company from request
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        
        # Validate parent belongs to same company
        parent = attrs.get('parent')
        if parent and parent.company != attrs['company']:
            raise serializers.ValidationError({
                'parent': 'Parent department must belong to the same company'
            })
        
        return attrs


class DepartmentTreeSerializer(serializers.ModelSerializer):
    """Hierarchical department tree serializer"""
    
    children = serializers.SerializerMethodField()
    
    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'code', 'manager', 'children']
    
    def get_children(self, obj):
        children = obj.children.filter(is_deleted=False)
        return DepartmentTreeSerializer(children, many=True).data