from rest_framework import permissions
from .models import ROLE_PERMISSIONS


class IsTenantMember(permissions.BasePermission):
    """
    Ensure user is a member of the company/tenant
    """
    
    def has_permission(self, request, view):
        """Check if user has tenant membership"""
        return (
            request.user and 
            request.user.is_authenticated and 
            hasattr(request, 'tenant') and 
            request.tenant is not None
        )


class TenantObjectPermission(permissions.BasePermission):
    """
    Validate object belongs to user's tenant
    """
    
    def has_object_permission(self, request, view, obj):
        """Ensure object belongs to request's tenant"""
        # Check if object has company FK
        if hasattr(obj, 'company'):
            return obj.company == request.tenant
        return True


class RolePermission(permissions.BasePermission):
    """
    Role-based access control
    """
    
    # Define required permission per action
    permission_map = {
        'list': 'view_any',
        'retrieve': 'view_any',
        'create': 'create_any',
        'update': 'update_any',
        'partial_update': 'update_any',
        'destroy': 'delete_any',
    }
    
    def has_permission(self, request, view):
        """Check if user's role has required permission"""
        if not hasattr(request, 'membership'):
            return False
        
        role = request.membership.role
        
        # Owner has all permissions
        if role == 'owner':
            return True
        
        # Get required permission for action
        action = getattr(view, 'action', None)
        required_perm = self.permission_map.get(action)
        
        if not required_perm:
            return True  # Action not in map, allow
        
        # Check if role has permission
        role_perms = ROLE_PERMISSIONS.get(role, [])
        return required_perm in role_perms or '*' in role_perms
    
    def has_object_permission(self, request, view, obj):
        """Check object-level permissions"""
        if not hasattr(request, 'membership'):
            return False
        
        role = request.membership.role
        
        # Owner and admin can access all objects
        if role in ['owner', 'admin']:
            return True
        
        # Check if user owns the object
        if hasattr(obj, 'created_by'):
            return obj.created_by == request.user
        
        return True


class ReadOnlyPermission(permissions.BasePermission):
    """Allow read-only access"""
    
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS