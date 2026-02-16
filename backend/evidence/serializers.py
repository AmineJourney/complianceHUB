from rest_framework import serializers
from .models import Evidence, AppliedControlEvidence, EvidenceAccessLog, EvidenceComment
from .services import EvidenceValidationService, EvidenceService


class EvidenceSerializer(serializers.ModelSerializer):
    """Evidence serializer"""
    
    uploaded_by_email = serializers.CharField(
        source='uploaded_by.email',
        read_only=True
    )
    verified_by_email = serializers.CharField(
        source='verified_by.email',
        read_only=True
    )
    file_size_display = serializers.CharField(
        source='get_file_size_display',
        read_only=True
    )
    file_extension = serializers.CharField(
        source='get_file_extension',
        read_only=True
    )
    linked_controls_count = serializers.IntegerField(
        source='get_linked_controls_count',
        read_only=True
    )
    is_expired = serializers.BooleanField(read_only=True)
    file_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Evidence
        fields = [
            'id', 'company', 'name', 'description', 'file', 'file_url',
            'file_size', 'file_size_display', 'file_type', 'file_extension',
            'file_hash', 'evidence_type', 'is_valid', 'validity_start_date',
            'validity_end_date', 'uploaded_by', 'uploaded_by_email',
            'verification_status', 'verified_by', 'verified_by_email',
            'verified_at', 'verification_notes', 'is_confidential',
            'tags', 'version', 'previous_version', 'linked_controls_count',
            'is_expired', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'company', 'file_size', 'file_type', 'file_hash',
            'verified_at', 'created_at', 'updated_at'
        ]
    
    def get_file_url(self, obj):
        """Get file URL"""
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None
    
    def validate_file(self, file):
        """Validate uploaded file"""
        is_valid, error = EvidenceValidationService.validate_file(file, max_size_mb=100)
        
        if not is_valid:
            raise serializers.ValidationError(error)
        
        return file
    
    def validate(self, attrs):
        """Validate evidence"""
        request = self.context.get('request')
        
        # Set company from request
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
            
            # Check storage quota
            if not self.instance:  # Only on create
                quota = EvidenceService.check_storage_quota(request.tenant)
                if quota['is_over_quota']:
                    raise serializers.ValidationError(
                        'Storage quota exceeded. Please upgrade your plan or delete old files.'
                    )
        
        # Set uploaded_by
        if not self.instance and request:
            attrs['uploaded_by'] = request.user
        
        return attrs


class EvidenceListSerializer(serializers.ModelSerializer):
    """Lightweight evidence serializer for lists"""
    
    uploaded_by_email = serializers.CharField(source='uploaded_by.email')
    file_size_display = serializers.CharField(source='get_file_size_display')
    file_extension = serializers.CharField(source='get_file_extension')
    
    class Meta:
        model = Evidence
        fields = [
            'id', 'name', 'evidence_type', 'file_extension', 'file_size_display',
            'verification_status', 'uploaded_by_email', 'is_valid',
            'validity_end_date', 'created_at'
        ]


class AppliedControlEvidenceSerializer(serializers.ModelSerializer):
    """Applied control-evidence link serializer"""
    
    control_code = serializers.CharField(
        source='applied_control.reference_control.code',
        read_only=True
    )
    control_name = serializers.CharField(
        source='applied_control.reference_control.name',
        read_only=True
    )
    evidence_name = serializers.CharField(
        source='evidence.name',
        read_only=True
    )
    linked_by_email = serializers.CharField(
        source='linked_by.email',
        read_only=True
    )
    
    class Meta:
        model = AppliedControlEvidence
        fields = [
            'id', 'company', 'applied_control', 'control_code', 'control_name',
            'evidence', 'evidence_name', 'link_type', 'notes', 'linked_by',
            'linked_by_email', 'relevance_score', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at']
    
    def validate(self, attrs):
        """Validate evidence link"""
        request = self.context.get('request')
        
        # Set company from request
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        
        # Validate control and evidence belong to same company
        applied_control = attrs.get('applied_control')
        evidence = attrs.get('evidence')
        
        if applied_control and evidence:
            if applied_control.company != evidence.company:
                raise serializers.ValidationError(
                    'Control and evidence must belong to the same company'
                )
            
            if applied_control.company != attrs['company']:
                raise serializers.ValidationError(
                    'Control must belong to your company'
                )
        
        # Set linked_by
        if not self.instance and request:
            attrs['linked_by'] = request.user
        
        return attrs


class EvidenceAccessLogSerializer(serializers.ModelSerializer):
    """Evidence access log serializer"""
    
    accessed_by_email = serializers.CharField(source='accessed_by.email', read_only=True)
    evidence_name = serializers.CharField(source='evidence.name', read_only=True)
    
    class Meta:
        model = EvidenceAccessLog
        fields = [
            'id', 'evidence', 'evidence_name', 'accessed_by', 'accessed_by_email',
            'access_type', 'ip_address', 'user_agent', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class EvidenceCommentSerializer(serializers.ModelSerializer):
    """Evidence comment serializer"""
    
    author_email = serializers.CharField(source='author.email', read_only=True)
    author_name = serializers.SerializerMethodField()
    replies = serializers.SerializerMethodField()
    
    class Meta:
        model = EvidenceComment
        fields = [
            'id', 'evidence', 'author', 'author_email', 'author_name',
            'comment', 'parent', 'replies', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'company', 'created_at', 'updated_at']
    
    def get_author_name(self, obj):
        if obj.author:
            return f"{obj.author.first_name} {obj.author.last_name}".strip() or obj.author.email
        return "Unknown"
    
    def get_replies(self, obj):
        if obj.parent is None:  # Only get replies for top-level comments
            replies = obj.replies.filter(is_deleted=False).order_by('created_at')
            return EvidenceCommentSerializer(replies, many=True, context=self.context).data
        return []
    
    def validate(self, attrs):
        """Validate comment"""
        request = self.context.get('request')
        
        # Set company from request
        if hasattr(request, 'tenant'):
            attrs['company'] = request.tenant
        
        # Validate evidence belongs to company
        evidence = attrs.get('evidence')
        if evidence and evidence.company != attrs['company']:
            raise serializers.ValidationError({
                'evidence': 'Evidence must belong to your company'
            })
        
        # Set author
        if not self.instance and request:
            attrs['author'] = request.user
        
        return attrs


class EvidenceAnalyticsSerializer(serializers.Serializer):
    """Serializer for evidence analytics"""
    
    total_evidence = serializers.IntegerField()
    by_type = serializers.ListField()
    by_status = serializers.ListField()
    expired_count = serializers.IntegerField()
    unlinked_count = serializers.IntegerField()
    storage = serializers.DictField()