from rest_framework.permissions import BasePermission, SAFE_METHODS


# ─────────────────────────────────────────────────────────────────────────────
#  Role-Based Permissions
# ─────────────────────────────────────────────────────────────────────────────

class IsConsumer(BasePermission):
    """User must have consumer or both role."""
    message = "Consumer access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in ["consumer", "both"]
        )


class IsProducer(BasePermission):
    """User must have producer or both role."""
    message = "Producer access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in ["producer", "both"]
        )


class IsVerifiedProducer(BasePermission):
    """User must be a producer AND be verified by admin."""
    message = "Verified producer account required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in ["producer", "both"] and
            request.user.is_verified
        )


class IsAdminRole(BasePermission):
    """User must have admin role or be Django staff."""
    message = "Admin access required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            (request.user.role == "admin" or request.user.is_staff)
        )


class IsConsumerOrProducer(BasePermission):
    """Any trading role — not admin."""
    message = "Trading account required."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in ["consumer", "producer", "both"]
        )


# ─────────────────────────────────────────────────────────────────────────────
#  Object-Level Permissions
# ─────────────────────────────────────────────────────────────────────────────

class IsOwnerOrAdmin(BasePermission):
    """Object must belong to request user, or user is admin."""
    message = "You do not have permission to access this resource."

    def has_object_permission(self, request, view, obj):
        if request.user.role == "admin" or request.user.is_staff:
            return True
        # Support user FK named 'user' or 'owner'
        owner = getattr(obj, "user", None) or getattr(obj, "owner", None)
        return owner == request.user


class IsListingOwner(BasePermission):
    """Only the producer who created the listing can modify it."""
    message = "You are not the owner of this listing."

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        if request.user.role == "admin" or request.user.is_staff:
            return True
        return obj.producer == request.user


class IsBidOwnerOrListingOwner(BasePermission):
    """
    Bid owner can view their own bid.
    Listing producer can accept/reject bids on their listings.
    Admins can access all.
    """
    message = "You do not have permission to access this bid."

    def has_object_permission(self, request, view, obj):
        if request.user.role == "admin" or request.user.is_staff:
            return True
        if request.method in SAFE_METHODS:
            return obj.buyer == request.user or obj.listing.producer == request.user
        return obj.listing.producer == request.user


class IsTradeParticipant(BasePermission):
    """Only buyer or seller of a trade can access it."""
    message = "You are not a participant in this trade."

    def has_object_permission(self, request, view, obj):
        if request.user.role == "admin" or request.user.is_staff:
            return True
        return obj.buyer == request.user or obj.seller == request.user


class IsDeviceOwner(BasePermission):
    """Only the producer who registered the device can configure it."""
    message = "You do not own this device."

    def has_object_permission(self, request, view, obj):
        if request.user.role == "admin" or request.user.is_staff:
            return True
        return obj.owner == request.user


# ─────────────────────────────────────────────────────────────────────────────
#  System State Permissions
# ─────────────────────────────────────────────────────────────────────────────

class IsSystemActive(BasePermission):
    """
    Blocks all write operations when system is paused.
    Admins bypass this restriction.
    """
    message = "System is currently paused. No transactions allowed."

    def has_permission(self, request, view):
        # Always allow reads
        if request.method in SAFE_METHODS:
            return True
        # Always allow admins
        if request.user.is_authenticated and (
            request.user.role == "admin" or request.user.is_staff
        ):
            return True
        # Check system pause state from cache or DB
        try:
            from django.core.cache import cache
            is_paused = cache.get("system_paused", False)
            return not is_paused
        except Exception:
            return True


class IsVerifiedOrReadOnly(BasePermission):
    """
    Unverified producers can browse listings.
    Must be verified to create listings or accept bids.
    """
    message = "Your producer account must be verified before you can trade."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        if not request.user.is_authenticated:
            return False
        if request.user.role in ["consumer", "both"]:
            return True
        if request.user.role in ["producer", "both"]:
            return request.user.is_verified
        return False