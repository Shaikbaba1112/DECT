from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.core.cache import cache
from django.db.models import Count, Q

from .models import (
    User, EnergyListing, Transaction,
    FraudFlag, AuditLog, Broadcast,
    CreditWallet, PricingConfig,
)
from .serializers import (
    AdminUserSerializer,
    EnergyListingSerializer,
    TransactionSerializer,
    FraudFlagSerializer,
    AuditLogSerializer,
    BroadcastSerializer,
    PricingConfigSerializer,
)
from .permissions import IsAdminRole
from .services.blockchain import (
    is_connected, CONTRACT_ADDRESS, w3
)


def get_client_ip(request):
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_admin_action(admin, action, target_model="", target_id="",
                     details=None, ip=None):
    AuditLog.objects.create(
        admin=admin,
        action=action,
        target_model=target_model,
        target_id=str(target_id),
        details=details or {},
        ip_address=ip,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Overview
# ─────────────────────────────────────────────────────────────────────────────

class AdminOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        listings = EnergyListing.objects.all()
        txns     = Transaction.objects.all()
        users    = User.objects.all()

        total_volume = sum(int(t.total_cost) for t in txns)
        total_energy = sum(t.energy_amount for t in txns)
        sellers      = set(txns.values_list("seller_address", flat=True))
        buyers       = set(txns.values_list("buyer_address",  flat=True))

        return Response({
            "total_users":         users.count(),
            "total_producers":     users.filter(
                role__in=["producer", "both"]
            ).count(),
            "total_consumers":     users.filter(
                role__in=["consumer", "both"]
            ).count(),
            "pending_approvals":   users.filter(
                role__in=["producer", "both"],
                is_verified=False,
            ).count(),
            "total_listings":      listings.count(),
            "active_listings":     listings.filter(active=True).count(),
            "sold_listings":       listings.filter(status="sold").count(),
            "total_transactions":  txns.count(),
            "total_energy_traded": total_energy,
            "total_volume_wei":    str(total_volume),
            "total_volume_eth":    str(round(total_volume / 10**18, 6)),
            "open_fraud_flags":    FraudFlag.objects.filter(status="open").count(),
            "unique_producers":    len(sellers),
            "unique_consumers":    len(buyers),
            "system_paused":       cache.get("system_paused", False),
        })


# ─────────────────────────────────────────────────────────────────────────────
#  User Management
# ─────────────────────────────────────────────────────────────────────────────

class AdminUsersView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        qs = User.objects.all()

        role    = request.query_params.get("role")
        search  = request.query_params.get("search")
        verified = request.query_params.get("is_verified")

        if role:
            qs = qs.filter(role=role)
        if search:
            qs = qs.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search)    |
                Q(wallet_address__icontains=search)
            )
        if verified is not None:
            qs = qs.filter(is_verified=(verified.lower() == "true"))

        serializer = AdminUserSerializer(qs, many=True)
        return Response(serializer.data)


class AdminUserDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get_object(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            return None

    def get(self, request, pk):
        user = self.get_object(pk)
        if not user:
            return Response(
                {"error": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(AdminUserSerializer(user).data)


class AdminUserSuspendView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user == request.user:
            return Response(
                {"error": "Cannot suspend yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        action    = request.data.get("action", "suspend")
        is_active = action == "activate"

        user.is_active = is_active
        user.save()

        log_admin_action(
            admin=request.user,
            action=f"{'activate' if is_active else 'suspend'}_user",
            target_model="User",
            target_id=user.id,
            details={"username": user.username, "action": action},
            ip=get_client_ip(request),
        )

        return Response({
            "message": f"User {'activated' if is_active else 'suspended'}.",
            "user":    AdminUserSerializer(user).data,
        })


class AdminApproveProducerView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.role not in ["producer", "both"]:
            return Response(
                {"error": "User is not a producer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        action  = request.data.get("action", "approve")
        reason  = request.data.get("reason", "")
        approve = action == "approve"

        user.is_verified = approve
        user.save()

        log_admin_action(
            admin=request.user,
            action=f"{'approve' if approve else 'reject'}_producer",
            target_model="User",
            target_id=user.id,
            details={
                "username": user.username,
                "action":   action,
                "reason":   reason,
            },
            ip=get_client_ip(request),
        )

        return Response({
            "message": f"Producer {'approved' if approve else 'rejected'}.",
            "user":    AdminUserSerializer(user).data,
        })


class AdminPendingApprovalsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        pending = User.objects.filter(
            role__in=["producer", "both"],
            is_verified=False,
            is_active=True,
        )
        serializer = AdminUserSerializer(pending, many=True)
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────────────────────────
#  Listings + Transactions (Read-Only for Admin)
# ─────────────────────────────────────────────────────────────────────────────

class AdminAllListingsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        qs = EnergyListing.objects.all()

        status_filter = request.query_params.get("status")
        seller_filter = request.query_params.get("seller")

        if status_filter:
            qs = qs.filter(status=status_filter)
        if seller_filter:
            qs = qs.filter(
                Q(producer__wallet_address__iexact=seller_filter) |
                Q(producer__username__icontains=seller_filter)
            )

        serializer = EnergyListingSerializer(qs, many=True)
        return Response(serializer.data)


class AdminAllTransactionsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        qs = Transaction.objects.all()

        buyer_filter  = request.query_params.get("buyer")
        seller_filter = request.query_params.get("seller")
        search        = request.query_params.get("search")

        if buyer_filter:
            qs = qs.filter(buyer_address__icontains=buyer_filter)
        if seller_filter:
            qs = qs.filter(seller_address__icontains=seller_filter)
        if search:
            qs = qs.filter(
                Q(tx_hash__icontains=search) |
                Q(buyer_address__icontains=search) |
                Q(seller_address__icontains=search)
            )

        serializer = TransactionSerializer(qs, many=True)
        return Response(serializer.data)


class AdminParticipantsView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        producers = (
            EnergyListing.objects
            .values("producer__id", "producer__username",
                    "producer__wallet_address")
            .annotate(total_listings=Count("id"))
            .filter(producer__isnull=False)
        )

        buyers = (
            Transaction.objects
            .values("buyer__id", "buyer__username",
                    "buyer__wallet_address")
            .annotate(total_purchases=Count("id"))
            .filter(buyer__isnull=False)
        )

        producer_map = {
            str(p["producer__id"]): p for p in producers
        }
        buyer_map = {
            str(b["buyer__id"]): b for b in buyers
        }

        all_ids = set(producer_map.keys()) | set(buyer_map.keys())
        result  = []

        for uid in all_ids:
            roles = []
            if uid in producer_map:
                roles.append("Producer")
            if uid in buyer_map:
                roles.append("Consumer")

            p    = producer_map.get(uid, {})
            b    = buyer_map.get(uid, {})
            name = p.get("producer__username") or b.get("buyer__username", "Unknown")
            addr = (
                p.get("producer__wallet_address") or
                b.get("buyer__wallet_address", "")
            )

            result.append({
                "id":              uid,
                "username":        name,
                "wallet_address":  addr,
                "roles":           roles,
                "total_listings":  p.get("total_listings", 0),
                "total_purchases": b.get("total_purchases", 0),
            })

        return Response(sorted(result, key=lambda x: -x["total_listings"]))


# ─────────────────────────────────────────────────────────────────────────────
#  Fraud Management
# ─────────────────────────────────────────────────────────────────────────────

class AdminFraudListView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        qs     = FraudFlag.objects.all()
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        serializer = FraudFlagSerializer(qs, many=True)
        return Response(serializer.data)


class AdminFraudReviewView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, pk):
        try:
            flag = FraudFlag.objects.get(pk=pk)
        except FraudFlag.DoesNotExist:
            return Response(
                {"error": "Flag not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        new_status = request.data.get("status")
        if new_status not in ["reviewed", "safe", "confirmed"]:
            return Response(
                {"error": "status must be reviewed / safe / confirmed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        flag.status      = new_status
        flag.reviewed_by = request.user
        flag.save()

        log_admin_action(
            admin=request.user,
            action=f"fraud_review_{new_status}",
            target_model="FraudFlag",
            target_id=flag.id,
            details={"wallet": flag.wallet_address, "risk_score": flag.risk_score},
            ip=get_client_ip(request),
        )

        return Response({
            "message": f"Flag marked as {new_status}.",
            "flag":    FraudFlagSerializer(flag).data,
        })


class AdminFraudBanView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, pk):
        try:
            flag = FraudFlag.objects.get(pk=pk)
        except FraudFlag.DoesNotExist:
            return Response(
                {"error": "Flag not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        wallet  = flag.wallet_address
        banned  = User.objects.filter(
            wallet_address__iexact=wallet
        ).update(is_active=False)

        flag.status      = "confirmed"
        flag.reviewed_by = request.user
        flag.save()

        log_admin_action(
            admin=request.user,
            action="ban_wallet",
            target_model="FraudFlag",
            target_id=flag.id,
            details={"wallet": wallet, "users_banned": banned},
            ip=get_client_ip(request),
        )

        return Response({
            "message":      f"Wallet {wallet} banned.",
            "users_banned": banned,
        })


# ─────────────────────────────────────────────────────────────────────────────
#  System Control
# ─────────────────────────────────────────────────────────────────────────────

class AdminSystemPauseView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        cache.set("system_paused", True, timeout=None)

        log_admin_action(
            admin=request.user,
            action="system_pause",
            details={"reason": request.data.get("reason", "No reason given")},
            ip=get_client_ip(request),
        )

        return Response({"message": "System paused.", "paused": True})


class AdminSystemResumeView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request):
        cache.delete("system_paused")

        log_admin_action(
            admin=request.user,
            action="system_resume",
            ip=get_client_ip(request),
        )

        return Response({"message": "System resumed.", "paused": False})


class AdminSystemStatusView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        try:
            block   = w3.eth.block_number
            balance = w3.eth.get_balance(
                w3.to_checksum_address(CONTRACT_ADDRESS)
            )
            return Response({
                "connected":             True,
                "contract_address":      CONTRACT_ADDRESS,
                "current_block":         block,
                "contract_balance_wei":  str(balance),
                "contract_balance_eth":  str(round(balance / 10**18, 6)),
                "system_paused":         cache.get("system_paused", False),
                "total_listings":        EnergyListing.objects.count(),
                "total_transactions":    Transaction.objects.count(),
            })
        except Exception as exc:
            return Response(
                {"connected": False, "error": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


# ─────────────────────────────────────────────────────────────────────────────
#  Audit Logs
# ─────────────────────────────────────────────────────────────────────────────

class AdminAuditLogView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        qs = AuditLog.objects.all()

        admin_filter  = request.query_params.get("admin")
        action_filter = request.query_params.get("action")

        if admin_filter:
            qs = qs.filter(admin__username__icontains=admin_filter)
        if action_filter:
            qs = qs.filter(action__icontains=action_filter)

        serializer = AuditLogSerializer(qs[:200], many=True)
        return Response(serializer.data)


# ─────────────────────────────────────────────────────────────────────────────
#  Broadcast
# ─────────────────────────────────────────────────────────────────────────────

class AdminBroadcastView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        broadcasts = Broadcast.objects.all()[:50]
        serializer = BroadcastSerializer(broadcasts, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = BroadcastSerializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            broadcast = serializer.save(sent_by=request.user)

            log_admin_action(
                admin=request.user,
                action="broadcast_sent",
                target_model="Broadcast",
                target_id=broadcast.id,
                details={
                    "type":       broadcast.alert_type,
                    "recipients": broadcast.recipients,
                    "message":    broadcast.message[:100],
                },
                ip=get_client_ip(request),
            )

            return Response(
                BroadcastSerializer(broadcast).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ActiveBroadcastView(APIView):
    """Returns latest broadcast for all dashboards to display."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user       = request.user
        role       = user.role
        broadcasts = Broadcast.objects.all()

        # Filter by recipient
        relevant = []
        for b in broadcasts:
            if b.recipients == "all":
                relevant.append(b)
            elif b.recipients == "consumers" and role in ["consumer", "both"]:
                relevant.append(b)
            elif b.recipients == "producers" and role in ["producer", "both"]:
                relevant.append(b)

        latest = relevant[0] if relevant else None
        if not latest:
            return Response({"broadcast": None})

        return Response({
            "broadcast": BroadcastSerializer(latest).data
        })


# ─────────────────────────────────────────────────────────────────────────────
#  Pricing Config
# ─────────────────────────────────────────────────────────────────────────────

class AdminPricingConfigView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        config, _ = PricingConfig.objects.get_or_create(pk=1)
        return Response(PricingConfigSerializer(config).data)

    def patch(self, request):
        config, _ = PricingConfig.objects.get_or_create(pk=1)
        serializer = PricingConfigSerializer(
            config, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            log_admin_action(
                admin=request.user,
                action="update_pricing_config",
                target_model="PricingConfig",
                target_id=1,
                details=request.data,
                ip=get_client_ip(request),
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
class UnlinkWalletView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.wallet_address = None
        request.user.save()
        return Response({"message": "Wallet unlinked."})



class AdminListingApprovalsView(APIView):
    """
    GET  /api/admin-api/listing-approvals/
    Returns all listings pending admin approval.
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        qs = EnergyListing.objects.filter(status="pending")
        serializer = EnergyListingSerializer(qs, many=True)
        return Response({
            "count":   qs.count(),
            "results": serializer.data,
        })


class AdminListingReviewView(APIView):
    """
    POST /api/admin-api/listing-approvals/<id>/review/
    Body: { "action": "approve" | "reject", "reason": "optional" }
    """
    permission_classes = [IsAuthenticated, IsAdminRole]

    def post(self, request, pk):
        try:
            listing = EnergyListing.objects.get(pk=pk)
        except EnergyListing.DoesNotExist:
            return Response(
                {"error": "Listing not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if listing.status != "pending":
            return Response(
                {"error": f"Listing is already {listing.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        action = request.data.get("action")
        reason = request.data.get("reason", "")

        if action not in ["approve", "reject"]:
            return Response(
                {"error": "action must be approve or reject."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action == "approve":
            listing.status           = "active"
            listing.active           = True
            listing.is_admin_verified = True
            listing.admin_reviewed_by = request.user
            listing.rejection_reason  = None
            listing.save()

            log_admin_action(
                admin=request.user,
                action="approve_listing",
                target_model="EnergyListing",
                target_id=listing.pk,
                details={
                    "listing_id": listing.listing_id,
                    "producer":   listing.producer.username if listing.producer else "Unknown",
                    "energy_wh":  listing.energy_amount,
                },
                ip=get_client_ip(request),
            )

            return Response({
                "message": f"Listing #{listing.listing_id} approved and live.",
                "listing": EnergyListingSerializer(listing).data,
            })

        else:  # reject
            listing.status           = "rejected"
            listing.active           = False
            listing.is_admin_verified = False
            listing.admin_reviewed_by = request.user
            listing.rejection_reason  = reason
            listing.save()

            log_admin_action(
                admin=request.user,
                action="reject_listing",
                target_model="EnergyListing",
                target_id=listing.pk,
                details={
                    "listing_id": listing.listing_id,
                    "reason":     reason,
                },
                ip=get_client_ip(request),
            )

            return Response({
                "message": f"Listing #{listing.listing_id} rejected.",
                "listing": EnergyListingSerializer(listing).data,
            })


class AdminListingStatsView(APIView):
    """GET /api/admin-api/listing-stats/ — pending count for badge."""
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        return Response({
            "pending":  EnergyListing.objects.filter(status="pending").count(),
            "active":   EnergyListing.objects.filter(status="active").count(),
            "rejected": EnergyListing.objects.filter(status="rejected").count(),
        })