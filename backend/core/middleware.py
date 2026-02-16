from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError
from .models import Company, Membership


class TenantMiddleware(MiddlewareMixin):
    """
    Extracts company from JWT token and attaches to request
    """
    
    def process_request(self, request):
        """Extract and validate tenant from request"""
        request.tenant = None
        request.membership = None
        
        # Skip for non-API endpoints
        if not request.path.startswith('/api/'):
            return None
        
        # Extract token from header
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None
        
        token_string = auth_header.split(' ')[1]
        
        try:
            # Decode JWT token
            token = AccessToken(token_string)
            user_id = token.get('user_id')
            company_id = token.get('company_id')  # We'll add this in JWT claims
            
            if not company_id:
                return JsonResponse({
                    'error': 'No company specified in token'
                }, status=400)
            
            # Get company
            try:
                company = Company.objects.get(id=company_id, is_active=True, is_deleted=False)
                request.tenant = company
            except Company.DoesNotExist:
                return JsonResponse({
                    'error': 'Invalid or inactive company'
                }, status=403)
            
            # Get membership for RBAC
            try:
                membership = Membership.objects.get(
                    user_id=user_id,
                    company=company,
                    is_deleted=False
                )
                request.membership = membership
            except Membership.DoesNotExist:
                return JsonResponse({
                    'error': 'User is not a member of this company'
                }, status=403)
                
        except TokenError:
            # Token is invalid, let authentication handle it
            pass
        
        return None


class RequestLoggingMiddleware(MiddlewareMixin):
    """Log API requests for audit trail"""
    
    def process_response(self, request, response):
        """Log request details"""
        if request.path.startswith('/api/'):
            # Log to your logging system
            import logging
            logger = logging.getLogger('api.requests')
            
            logger.info(f"{request.method} {request.path} - {response.status_code}", extra={
                'user': getattr(request.user, 'email', 'anonymous'),
                'company': getattr(request.tenant, 'name', None),
                'ip': request.META.get('REMOTE_ADDR'),
                'user_agent': request.META.get('HTTP_USER_AGENT', ''),
            })
        
        return response