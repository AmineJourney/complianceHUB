"""
AuditMiddleware — stores the current request in thread-local storage
so that signals can access actor/IP without receiving the request object.
"""
import threading

_thread_locals = threading.local()


def get_current_user():
    return getattr(_thread_locals, 'user', None)


def get_current_request():
    return getattr(_thread_locals, 'request', None)


def get_current_company():
    return getattr(_thread_locals, 'company', None)


class AuditMiddleware:
    """
    Must be placed AFTER TenantMiddleware in MIDDLEWARE settings so that
    request.user and request.tenant are already populated.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _thread_locals.request = request
        _thread_locals.user = getattr(request, 'user', None)
        _thread_locals.company = getattr(request, 'tenant', None)
        try:
            response = self.get_response(request)
        finally:
            # Always clear to avoid leaking between requests in the same thread
            _thread_locals.request = None
            _thread_locals.user = None
            _thread_locals.company = None
        return response
