# core/middleware.py
"""
FIX #2 — TenantMiddleware has been removed.

Tenant context (request.tenant / request.membership / request.user_role)
is now set by core.authentication.TenantJWTAuthentication during the
normal DRF authentication pass, eliminating the previous double-JWT
validation that happened in middleware before DRF ran.

RequestLoggingMiddleware is kept unchanged.
"""
import logging
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger('api.requests')


class RequestLoggingMiddleware(MiddlewareMixin):
    """Log every API request + response status for observability."""

    def process_request(self, request):
        if request.path.startswith('/api/'):
            user_info = 'anonymous'
            if request.user and request.user.is_authenticated:
                user_info = request.user.email

            company_info = ''
            if hasattr(request, 'tenant') and request.tenant:
                company_info = f' | Company: {request.tenant.name}'

            logger.info('%s %s | User: %s%s', request.method, request.path, user_info, company_info)

    def process_response(self, request, response):
        if request.path.startswith('/api/'):
            logger.info('%s %s | Status: %s', request.method, request.path, response.status_code)
        return response