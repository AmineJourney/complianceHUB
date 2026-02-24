# core/middleware.py
import logging
from django.utils.deprecation import MiddlewareMixin
from .models import Membership

logger = logging.getLogger('api.requests')

# Paths that never need a tenant context
SKIP_PATHS = (
    '/api/auth/',
    '/api/companies/',
    '/api/memberships/',
    '/api/invitations/',
    '/api/library/',
    '/admin/',
    '/static/',
    '/media/',
    '/api/docs/',
    '/api/schema/',
)


def _get_user_from_jwt(request):
    """
    Authenticate the request using DRF's JWTAuthentication.
    Returns the User instance or None.

    Django middleware runs before DRF authentication, so request.user is
    always AnonymousUser at this point. We must authenticate manually.
    """
    from rest_framework_simplejwt.authentication import JWTAuthentication
    from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if not auth_header.startswith('Bearer '):
        return None

    try:
        jwt_auth = JWTAuthentication()
        # validate_token returns the token object
        raw_token = auth_header.split(' ')[1].encode()
        validated_token = jwt_auth.get_validated_token(raw_token)
        user = jwt_auth.get_user(validated_token)
        return user
    except (InvalidToken, TokenError, Exception):
        return None


class TenantMiddleware(MiddlewareMixin):
    """
    Sets request.tenant, request.membership, and request.user_role
    by reading the X-Company-ID header and validating the JWT token.

    Must come AFTER SecurityMiddleware but can be anywhere relative to
    Django's AuthenticationMiddleware since we do our own JWT auth here.
    """

    def process_request(self, request):
        request.tenant = None
        request.membership = None
        request.user_role = None

        # Skip paths that don't need tenant context
        if any(request.path.startswith(p) for p in SKIP_PATHS):
            return

        company_id = (
            request.META.get('HTTP_X_COMPANY_ID') or
            request.session.get('company_id')
        )

        if not company_id:
            return

        # Authenticate the JWT ourselves since DRF hasn't run yet
        user = _get_user_from_jwt(request)
        if user is None:
            return

        try:
            membership = Membership.objects.select_related('company').get(
                user=user,
                company_id=company_id,
                is_active=True,
                is_deleted=False,
                company__is_active=True,
                company__is_deleted=False,
            )
            request.tenant = membership.company
            request.membership = membership
            request.user_role = membership.role

        except Membership.DoesNotExist:
            # Let DRF's IsTenantMember permission handle the 403
            pass


class RequestLoggingMiddleware(MiddlewareMixin):
    """Log API requests for audit purposes."""

    def process_request(self, request):
        if request.path.startswith('/api/'):
            user_info = 'anonymous'
            if request.user and request.user.is_authenticated:
                user_info = f"{request.user.email}"

            company_info = ''
            if hasattr(request, 'tenant') and request.tenant:
                company_info = f" | Company: {request.tenant.name}"

            logger.info(f"{request.method} {request.path} | User: {user_info}{company_info}")

    def process_response(self, request, response):
        if request.path.startswith('/api/'):
            logger.info(f"{request.method} {request.path} | Status: {response.status_code}")
        return response