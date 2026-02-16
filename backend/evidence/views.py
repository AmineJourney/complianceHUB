from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.http import FileResponse, Http404
from django.utils import timezone
from core.permissions import IsTenantMember, TenantObjectPermission, RolePermission
from .models import Evidence, AppliedControlEvidence, EvidenceAccessLog, EvidenceComment
from .serializers import (
    EvidenceSerializer, EvidenceListSerializer,
    AppliedControlEvidenceSerializer, EvidenceAccessLogSerializer,
    EvidenceCommentSerializer, EvidenceAnalyticsSerializer
)
from .services import EvidenceService, EvidenceValidationService


class EvidenceViewSet(viewsets.ModelViewSet):
    """Evidence file management"""
    
    serializer_class = EvidenceSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission, RolePermission]
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = [
        'evidence_type', 'verification_status', 'is_valid',
        'uploaded_by', 'is_confidential'
    ]
    search_fields = ['name', 'description', 'tags']
    ordering_fields = ['name', 'created_at', 'file_size', 'validity_end_date']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Get evidence for current company"""
        if hasattr(self.request, 'tenant'):
            qs = Evidence.objects.for_company(
                self.request.tenant
            ).select_related('uploaded_by', 'verified_by')
            
            # Filter confidential evidence based on role
            if hasattr(self.request, 'membership'):
                role = self.request.membership.role
                if role not in ['owner', 'admin', 'auditor']:
                    # Non-privileged users can only see non-confidential evidence
                    qs = qs.filter(is_confidential=False)
            
            return qs
        return Evidence.objects.none()
    
    def get_serializer_class(self):
        if self.action == 'list':
            return EvidenceListSerializer
        return EvidenceSerializer
    
    def perform_create(self, serializer):
        """Set company and uploaded_by"""
        serializer.save(
            company=self.request.tenant,
            uploaded_by=self.request.user
        )
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download evidence file"""
        evidence = self.get_object()
        
        # Log access
        EvidenceService.log_access(
            evidence=evidence,
            user=request.user,
            access_type='download',
            request=request
        )
        
        # Serve file
        if not evidence.file:
            raise Http404("File not found")
        
        return FileResponse(
            evidence.file.open('rb'),
            as_attachment=True,
            filename=evidence.file.name.split('/')[-1]
        )
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve evidence"""
        evidence = self.get_object()
        notes = request.data.get('notes', '')
        
        EvidenceValidationService.approve_evidence(
            evidence=evidence,
            approver=request.user,
            notes=notes
        )
        
        serializer = self.get_serializer(evidence)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject evidence"""
        evidence = self.get_object()
        reason = request.data.get('reason', '')
        
        if not reason:
            return Response(
                {'error': 'Rejection reason is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        EvidenceValidationService.reject_evidence(
            evidence=evidence,
            approver=request.user,
            reason=reason
        )
        
        serializer = self.get_serializer(evidence)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def create_version(self, request, pk=None):
        """Create a new version of evidence"""
        original_evidence = self.get_object()
        
        new_file = request.FILES.get('file')
        if not new_file:
            return Response(
                {'error': 'File is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate file
        is_valid, error = EvidenceValidationService.validate_file(new_file)
        if not is_valid:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create new version
        new_evidence = EvidenceService.create_evidence_version(
            original_evidence=original_evidence,
            new_file=new_file,
            user=request.user,
            description=request.data.get('description'),
            major_version=request.data.get('major_version', False)
        )
        
        serializer = self.get_serializer(new_evidence)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def versions(self, request, pk=None):
        """Get all versions of evidence"""
        evidence = self.get_object()
        
        # Get all related versions
        versions = []
        
        # Get previous versions
        current = evidence.previous_version
        while current:
            versions.append(current)
            current = current.previous_version
        
        # Get newer versions
        newer = Evidence.objects.filter(
            previous_version=evidence,
            is_deleted=False
        )
        versions.extend(newer)
        
        serializer = EvidenceListSerializer(versions, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def access_logs(self, request, pk=None):
        """Get access logs for evidence"""
        evidence = self.get_object()
        logs = evidence.access_logs.all().order_by('-created_at')[:50]
        serializer = EvidenceAccessLogSerializer(logs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Get evidence analytics"""
        analytics = EvidenceService.get_evidence_analytics(request.tenant)
        serializer = EvidenceAnalyticsSerializer(analytics)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def storage_quota(self, request):
        """Get storage quota information"""
        quota = EvidenceService.check_storage_quota(request.tenant)
        return Response(quota)
    
    @action(detail=False, methods=['get'])
    def expired(self, request):
        """Get expired evidence"""
        expired = self.get_queryset().filter(
            validity_end_date__lt=timezone.now().date(),
            is_valid=True
        )
        serializer = EvidenceListSerializer(expired, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def pending_approval(self, request):
        """Get evidence pending approval"""
        pending = self.get_queryset().filter(
            verification_status='pending'
        )
        serializer = EvidenceListSerializer(pending, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def unlinked(self, request):
        """Get evidence not linked to any controls"""
        from django.db.models import Count, Q
        
        unlinked = self.get_queryset().annotate(
            link_count=Count('control_links', filter=Q(control_links__is_deleted=False))
        ).filter(link_count=0)
        
        serializer = EvidenceListSerializer(unlinked, many=True)
        return Response(serializer.data)


class AppliedControlEvidenceViewSet(viewsets.ModelViewSet):
    """Evidence-control link management"""
    
    serializer_class = AppliedControlEvidenceSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['applied_control', 'evidence', 'link_type']
    ordering_fields = ['created_at', 'relevance_score']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Get evidence links for current company"""
        if hasattr(self.request, 'tenant'):
            return AppliedControlEvidence.objects.for_company(
                self.request.tenant
            ).select_related(
                'applied_control', 'applied_control__reference_control',
                'evidence', 'linked_by'
            )
        return AppliedControlEvidence.objects.none()
    
    def perform_create(self, serializer):
        """Set company and linked_by"""
        serializer.save(
            company=self.request.tenant,
            linked_by=self.request.user
        )
    
    @action(detail=False, methods=['post'])
    def bulk_link(self, request):
        """Link multiple evidence items to multiple controls"""
        evidence_ids = request.data.get('evidence_ids', [])
        control_ids = request.data.get('control_ids', [])
        link_type = request.data.get('link_type', 'implementation')
        
        if not evidence_ids or not control_ids:
            return Response(
                {'error': 'evidence_ids and control_ids are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate evidence belongs to company
        evidence_items = Evidence.objects.filter(
            id__in=evidence_ids,
            company=request.tenant,
            is_deleted=False
        )
        
        # Validate controls belong to company
        from controls.models import AppliedControl
        controls = AppliedControl.objects.filter(
            id__in=control_ids,
            company=request.tenant,
            is_deleted=False
        )
        
        # Create links
        created_links = []
        for evidence in evidence_items:
            for control in controls:
                # Skip if link already exists
                existing = AppliedControlEvidence.objects.filter(
                    applied_control=control,
                    evidence=evidence,
                    is_deleted=False
                ).exists()
                
                if not existing:
                    link = AppliedControlEvidence.objects.create(
                        company=request.tenant,
                        applied_control=control,
                        evidence=evidence,
                        link_type=link_type,
                        linked_by=request.user
                    )
                    created_links.append(link)
        
        return Response({
            'message': f'Created {len(created_links)} evidence links',
            'created_count': len(created_links)
        }, status=status.HTTP_201_CREATED)


class EvidenceCommentViewSet(viewsets.ModelViewSet):
    """Evidence comment management"""
    
    serializer_class = EvidenceCommentSerializer
    permission_classes = [IsAuthenticated, IsTenantMember, TenantObjectPermission]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['evidence', 'author', 'parent']
    ordering = ['created_at']
    
    def get_queryset(self):
        """Get comments for current company"""
        if hasattr(self.request, 'tenant'):
            return EvidenceComment.objects.for_company(
                self.request.tenant
            ).select_related('evidence', 'author', 'parent')
        return EvidenceComment.objects.none()
    
    def perform_create(self, serializer):
        """Set company and author"""
        serializer.save(
            company=self.request.tenant,
            author=self.request.user
        )