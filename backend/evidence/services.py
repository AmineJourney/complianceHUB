"""
Business logic services for evidence management
"""
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from .models import Evidence, AppliedControlEvidence, EvidenceAccessLog


class EvidenceService:
    """Service for evidence operations"""
    
    @staticmethod
    @transaction.atomic
    def create_evidence_with_controls(company, file, name, control_ids=None, **kwargs):
        """
        Create evidence and link to controls in one transaction
        
        Args:
            company: Company instance
            file: Uploaded file
            name: Evidence name
            control_ids: List of AppliedControl IDs to link
            **kwargs: Additional Evidence fields
        
        Returns:
            Evidence instance
        """
        # Create evidence
        evidence = Evidence.objects.create(
            company=company,
            file=file,
            name=name,
            description=kwargs.get('description', ''),
            evidence_type=kwargs.get('evidence_type', 'other'),
            uploaded_by=kwargs.get('uploaded_by'),
            tags=kwargs.get('tags', []),
        )
        
        # Link to controls
        if control_ids:
            from controls.models import AppliedControl
            
            controls = AppliedControl.objects.filter(
                id__in=control_ids,
                company=company,
                is_deleted=False
            )
            
            for control in controls:
                AppliedControlEvidence.objects.create(
                    company=company,
                    applied_control=control,
                    evidence=evidence,
                    linked_by=kwargs.get('uploaded_by'),
                    link_type=kwargs.get('link_type', 'implementation')
                )
        
        return evidence
    
    @staticmethod
    def check_storage_quota(company):
        """
        Check if company has available storage quota
        
        Args:
            company: Company instance
        
        Returns:
            dict with quota information
        """
        # Get total storage used
        evidence_files = Evidence.objects.filter(
            company=company,
            is_deleted=False
        )
        
        total_size = sum(
            e.file_size or 0 for e in evidence_files
        )
        
        # Convert to MB
        total_mb = total_size / (1024 * 1024)
        quota_mb = company.max_storage_mb
        
        return {
            'used_mb': round(total_mb, 2),
            'quota_mb': quota_mb,
            'available_mb': round(quota_mb - total_mb, 2),
            'usage_percentage': round((total_mb / quota_mb * 100) if quota_mb > 0 else 0, 2),
            'is_over_quota': total_mb > quota_mb
        }
    
    @staticmethod
    def log_access(evidence, user, access_type='view', request=None):
        """
        Log evidence access for audit trail
        
        Args:
            evidence: Evidence instance
            user: User instance
            access_type: 'view', 'download', or 'preview'
            request: HTTP request object (optional)
        
        Returns:
            EvidenceAccessLog instance
        """
        ip_address = None
        user_agent = ''
        
        if request:
            ip_address = request.META.get('REMOTE_ADDR')
            user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
        
        return EvidenceAccessLog.objects.create(
            company=evidence.company,
            evidence=evidence,
            accessed_by=user,
            access_type=access_type,
            ip_address=ip_address,
            user_agent=user_agent
        )
    
    @staticmethod
    def get_evidence_analytics(company):
        """
        Get evidence analytics for company
        
        Args:
            company: Company instance
        
        Returns:
            dict with analytics data
        """
        evidence_qs = Evidence.objects.filter(
            company=company,
            is_deleted=False
        )
        
        total_evidence = evidence_qs.count()
        
        # By type
        by_type = evidence_qs.values('evidence_type').annotate(
            count=Count('id')
        )
        
        # By verification status
        by_status = evidence_qs.values('verification_status').annotate(
            count=Count('id')
        )
        
        # Expired evidence
        expired_count = evidence_qs.filter(
            validity_end_date__lt=timezone.now().date(),
            is_valid=True
        ).count()
        
        # Evidence without controls
        unlinked_count = evidence_qs.annotate(
            link_count=Count('control_links', filter=Q(control_links__is_deleted=False))
        ).filter(link_count=0).count()
        
        # Storage usage
        storage = EvidenceService.check_storage_quota(company)
        
        return {
            'total_evidence': total_evidence,
            'by_type': list(by_type),
            'by_status': list(by_status),
            'expired_count': expired_count,
            'unlinked_count': unlinked_count,
            'storage': storage
        }
    
    @staticmethod
    def create_evidence_version(original_evidence, new_file, user, **kwargs):
        """
        Create a new version of existing evidence
        
        Args:
            original_evidence: Original Evidence instance
            new_file: New uploaded file
            user: User creating the version
            **kwargs: Fields to update
        
        Returns:
            New Evidence instance
        """
        # Parse current version and increment
        try:
            major, minor = map(int, original_evidence.version.split('.'))
            if kwargs.get('major_version', False):
                new_version = f"{major + 1}.0"
            else:
                new_version = f"{major}.{minor + 1}"
        except:
            new_version = "1.1"
        
        # Create new evidence
        new_evidence = Evidence.objects.create(
            company=original_evidence.company,
            name=original_evidence.name,
            description=kwargs.get('description', original_evidence.description),
            file=new_file,
            evidence_type=original_evidence.evidence_type,
            uploaded_by=user,
            tags=original_evidence.tags.copy(),
            version=new_version,
            previous_version=original_evidence
        )
        
        # Copy control links
        original_links = AppliedControlEvidence.objects.filter(
            evidence=original_evidence,
            is_deleted=False
        )
        
        for link in original_links:
            AppliedControlEvidence.objects.create(
                company=new_evidence.company,
                applied_control=link.applied_control,
                evidence=new_evidence,
                link_type=link.link_type,
                linked_by=user,
                notes=f"Linked from version {original_evidence.version}"
            )
        
        return new_evidence


class EvidenceValidationService:
    """Service for evidence validation"""
    
    @staticmethod
    def validate_file(file, max_size_mb=100):
        """
        Validate uploaded file
        
        Args:
            file: Uploaded file
            max_size_mb: Maximum file size in MB
        
        Returns:
            tuple: (is_valid, error_message)
        """
        # Check file size
        max_size_bytes = max_size_mb * 1024 * 1024
        if file.size > max_size_bytes:
            return False, f"File size exceeds {max_size_mb}MB limit"
        
        # Check file extension
        allowed_extensions = [
            'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
            'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg',
            'zip', '7z', 'tar', 'gz',
            'json', 'xml', 'yaml', 'log', 'md'
        ]
        
        import os
        ext = os.path.splitext(file.name)[1].lower().lstrip('.')
        
        if ext not in allowed_extensions:
            return False, f"File type .{ext} is not allowed"
        
        return True, None
    
    @staticmethod
    @transaction.atomic
    def approve_evidence(evidence, approver, notes=''):
        """
        Approve evidence
        
        Args:
            evidence: Evidence instance
            approver: User instance
            notes: Approval notes
        """
        evidence.verification_status = 'approved'
        evidence.verified_by = approver
        evidence.verified_at = timezone.now()
        evidence.verification_notes = notes
        evidence.is_valid = True
        evidence.save()
    
    @staticmethod
    @transaction.atomic
    def reject_evidence(evidence, approver, reason):
        """
        Reject evidence
        
        Args:
            evidence: Evidence instance
            approver: User instance
            reason: Rejection reason
        """
        evidence.verification_status = 'rejected'
        evidence.verified_by = approver
        evidence.verified_at = timezone.now()
        evidence.verification_notes = reason
        evidence.is_valid = False
        evidence.save()