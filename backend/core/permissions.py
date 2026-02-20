# core/permissions.py
from rest_framework import permissions
from .models import ROLE_PERMISSIONS


class IsTenantMember(permissions.BasePermission):
    """Ensure user is a member of the current company/tenant."""

    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            hasattr(request, 'tenant') and
            request.tenant is not None
        )


class TenantObjectPermission(permissions.BasePermission):
    """Validate that the object belongs to the user's tenant."""

    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'company'):
            return obj.company == request.tenant
        return True


class IsOwnerOrAdmin(permissions.BasePermission):
    """Only owners and admins of the current tenant can proceed."""

    def has_permission(self, request, view):
        return (
            hasattr(request, 'membership') and
            request.membership is not None and
            request.membership.role in ('owner', 'admin')
        )


class RolePermission(permissions.BasePermission):
    """Role-based access control using the ROLE_PERMISSIONS matrix."""

    permission_map = {
        'list': 'view_any',
        'retrieve': 'view_any',
        'create': 'create_any',
        'update': 'update_any',
        'partial_update': 'update_any',
        'destroy': 'delete_any',
    }

    def has_permission(self, request, view):
        if not hasattr(request, 'membership'):
            return False

        role = request.membership.role
        if role == 'owner':
            return True

        action = getattr(view, 'action', None)
        required_perm = self.permission_map.get(action)
        if not required_perm:
            return True

        role_perms = ROLE_PERMISSIONS.get(role, [])
        return required_perm in role_perms or '*' in role_perms

    def has_object_permission(self, request, view, obj):
        if not hasattr(request, 'membership'):
            return False
        role = request.membership.role
        if role in ['owner', 'admin']:
            return True
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        return True


class ReadOnlyPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS