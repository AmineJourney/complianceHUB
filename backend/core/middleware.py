# core/middleware.py - FIXED VERSION
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
        # Initialize defaults
        request.tenant = None
        request.membership = None
        request.user_role = None
        
        # Skip for anonymous users
        if not request.user.is_authenticated:
            print(f"❌ TenantMiddleware: User not authenticated for {request.path}")
            return
        
        # Get company ID from header or session
        company_id = request.META.get('HTTP_X_COMPANY_ID') or request.session.get('company_id')
        print(f"🔍 TenantMiddleware: X-Company-ID = {company_id}")
        print(f"🔍 TenantMiddleware: User = {request.user.email}")
        
        if not company_id:
            print(f"❌ TenantMiddleware: No company ID provided")
            return
        
        try:
            # Verify user has access to this company
            # ⚠️ CRITICAL: Must check is_deleted=False for both!
            membership = Membership.objects.select_related('company').get(
                user=request.user,
                company_id=company_id,
                is_active=True,
                is_deleted=False,  # ← ADDED: Check membership not deleted
                company__is_active=True,
                company__is_deleted=False,  # ← ADDED: Check company not deleted
            )
            
            # Set tenant and membership on request
            request.tenant = membership.company
            request.membership = membership
            request.user_role = membership.role
            
            print(f"✅ TenantMiddleware: Tenant set to {request.tenant.name}")
            print(f"✅ TenantMiddleware: Role = {request.user_role}")
            
        except Membership.DoesNotExist:
            # User doesn't have access to this company
            print(f"❌ TenantMiddleware: No active membership found")
            print(f"   User: {request.user.email}")
            print(f"   Company ID: {company_id}")
            
            # Debug: Check if ANY membership exists (even deleted/inactive)
            all_memberships = Membership.objects.filter(
                user=request.user,
                company_id=company_id
            )
            
            if all_memberships.exists():
                m = all_memberships.first()
                print(f"   ⚠️  Membership exists but:")
                print(f"      is_active: {m.is_active}")
                print(f"      is_deleted: {m.is_deleted}")
                print(f"      company.is_active: {m.company.is_active}")
                print(f"      company.is_deleted: {m.company.is_deleted}")
            else:
                print(f"   ⚠️  No membership exists at all")
                
                # Show user's actual memberships
                user_memberships = Membership.objects.filter(
                    user=request.user,
                    is_deleted=False
                )
                print(f"   User has {user_memberships.count()} memberships:")
                for m in user_memberships[:5]:
                    print(f"      - {m.company.name} ({m.company.id})")


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