# core/middleware.py
import logging
from django.utils.deprecation import MiddlewareMixin
from .models import Company, Membership

logger = logging.getLogger('api.requests')


class TenantMiddleware(MiddlewareMixin):
    """
    Middleware to set the current company (tenant) on the request object.
    
    The company is determined from:
    1. X-Company-ID header (for API requests)
    2. Session (for browser requests)
    
    This must be placed AFTER AuthenticationMiddleware in MIDDLEWARE setting.
    """
    
    def process_request(self, request):
        # Skip for anonymous users
        if not request.user.is_authenticated:
            request.tenant = None
            return
        
        # Get company ID from header or session
        company_id = request.META.get('HTTP_X_COMPANY_ID') or request.session.get('company_id')
        
        if not company_id:
            request.tenant = None
            return
        
        try:
            # Verify user has access to this company
            membership = Membership.objects.select_related('company').get(
                user=request.user,
                company_id=company_id,
                is_active=True,
                company__is_active=True
            )
            
            # Set tenant and membership on request
            request.tenant = membership.company
            request.membership = membership
            request.user_role = membership.role
            
        except Membership.DoesNotExist:
            # User doesn't have access to this company
            request.tenant = None
            request.membership = None
            request.user_role = None


class RequestLoggingMiddleware(MiddlewareMixin):
    """
    Middleware to log API requests for audit purposes.
    """
    
    def process_request(self, request):
        # Log API requests (skip admin and static)
        if request.path.startswith('/api/'):
            user_info = 'anonymous'
            if request.user.is_authenticated:
                user_info = f"{request.user.email} (ID: {request.user.id})"
            
            company_info = ''
            if hasattr(request, 'tenant') and request.tenant:
                company_info = f" | Company: {request.tenant.name} (ID: {request.tenant.id})"
            
            logger.info(
                f"{request.method} {request.path} | User: {user_info}{company_info}"
            )
    
    def process_response(self, request, response):
        # Log response status for API requests
        if request.path.startswith('/api/'):
            logger.info(
                f"{request.method} {request.path} | Status: {response.status_code}"
            )
        return response
