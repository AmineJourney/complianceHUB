# core/permissions.py
"""
FIX #3 — RolePermission.has_object_permission previously fell through to
`return True` when an object had no `created_by` field, silently granting
write access to any authenticated tenant member.

The fix: default is now DENY (return False) for unsafe methods.
Safe methods (GET/HEAD/OPTIONS) remain allowed for all tenant members.
Owners and admins bypass object-level checks entirely (tenant isolation
is already enforced at the queryset level).
"""
from rest_framework import permissions
from .models import ROLE_PERMISSIONS


class IsTenantMember(permissions.BasePermission):
    """Ensure the request carries a valid tenant (X-Company-ID) context."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and hasattr(request, 'tenant')
            and request.tenant is not None
        )


class TenantObjectPermission(permissions.BasePermission):
    """Ensure the requested object belongs to the current tenant."""

    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'company'):
            return obj.company == request.tenant
        return True


class IsOwnerOrAdmin(permissions.BasePermission):
    """Only owners and admins of the current tenant may proceed."""

    def has_permission(self, request, view):
        return bool(
            hasattr(request, 'membership')
            and request.membership is not None
            and request.membership.role in ('owner', 'admin')
        )


class RolePermission(permissions.BasePermission):
    """
    View-level RBAC using ROLE_PERMISSIONS matrix.
    Object-level: DENY by default for unsafe methods unless the user
    created the object or is owner/admin.
    """

    _VIEW_TO_PERM = {
        'list':           'view_any',
        'retrieve':       'view_any',
        'create':         'create_any',
        'update':         'update_any',
        'partial_update': 'update_any',
        'destroy':        'delete_any',
    }

    def has_permission(self, request, view):
        if not hasattr(request, 'membership') or request.membership is None:
            return False

        role = request.membership.role
        if role == 'owner':
            return True

        action = getattr(view, 'action', None)
        required_perm = self._VIEW_TO_PERM.get(action)
        if required_perm is None:
            # Custom action — allow; individual views guard with their own logic
            return True

        role_perms = ROLE_PERMISSIONS.get(role, [])
        return '*' in role_perms or required_perm in role_perms

    def has_object_permission(self, request, view, obj):
        if not hasattr(request, 'membership') or request.membership is None:
            return False

        role = request.membership.role

        # Owners and admins always pass object-level checks
        if role in ('owner', 'admin'):
            return True

        # Safe methods are allowed for all authenticated tenant members
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write access: only the object's creator may mutate it.
        # FIX #3: if there is no created_by field we DENY (was True before).
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user

        # No created_by field → cannot determine ownership → DENY
        return False


class ReadOnlyPermission(permissions.BasePermission):
    """Allow read-only access to anyone who passes authentication."""

    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS