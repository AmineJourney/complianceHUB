# core/authentication.py
"""
FIX #2 — Replaces TenantMiddleware double-JWT-validation.

TenantJWTAuthentication extends DRF's JWTAuthentication so tenant context
(request.tenant, request.membership, request.user_role) is populated in a
single DRF auth pass instead of being duplicated in middleware first.

Drop-in setup
─────────────
config/settings.py  →  REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']:
    'core.authentication.TenantJWTAuthentication'

MIDDLEWARE  →  remove 'core.middleware.TenantMiddleware' entirely.
"""
import uuid
import logging

from rest_framework_simplejwt.authentication import JWTAuthentication

logger = logging.getLogger(__name__)


class TenantJWTAuthentication(JWTAuthentication):
    """
    After validating the JWT (via super()), reads X-Company-ID and
    populates three request attributes:

        request.tenant      – Company instance  | None
        request.membership  – Membership instance | None
        request.user_role   – role string | None

    If X-Company-ID is absent the request is still authenticated as a user.
    IsTenantMember permission handles the 403 for views that require a tenant.
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None  # No token — anonymous request

        user, validated_token = result

        # Always initialise so downstream code never gets AttributeError
        request.tenant = None
        request.membership = None
        request.user_role = None

        company_id = (
            request.META.get('HTTP_X_COMPANY_ID', '').strip()
            or request.session.get('company_id', '')
        )

        if not company_id:
            return user, validated_token

        # Validate UUID shape before hitting the DB
        try:
            uuid.UUID(company_id)
        except (ValueError, AttributeError):
            logger.debug('TenantJWTAuthentication: invalid X-Company-ID=%s', company_id)
            return user, validated_token

        # Single query — select_related avoids a second hit for company fields
        try:
            from .models import Membership
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
            # Valid JWT + valid user, but no membership for this company.
            # Don't raise here — let IsTenantMember permission issue the 403.
            logger.debug(
                'TenantJWTAuthentication: user=%s has no active membership in company=%s',
                user.email, company_id,
            )

        return user, validated_token