from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.core.cache import cache

from .models import (
    User, EnergyDevice, EnergyListing, Bid,
    Transaction, CreditWallet, CreditTransaction,
    AutoTradeSettings, PriceAlert, PriceHistory,
    FraudFlag, AuditLog, Broadcast, PricingConfig,
)
from .serializers import (
    EnergyDeviceSerializer,
    EnergyListingSerializer,
    EnergyListingCreateSerializer,
    BidCreateSerializer,
    BidDetailSerializer,
    BidResponseSerializer,
    TransactionSerializer,
    CreditWalletSerializer,
    CreditTransactionSerializer,
    WithdrawSerializer,
    AutoTradeSerializer,
    PriceAlertSerializer,
    FraudFlagSerializer,
    AuditLogSerializer,
    BroadcastSerializer,
    PricingConfigSerializer,
    AdminUserSerializer,
)
from .permissions import (
    IsConsumer,
    IsProducer,
    IsVerifiedProducer,
    IsAdminRole,
    IsOwnerOrAdmin,
    IsListingOwner,
    IsBidOwnerOrListingOwner,
    IsTradeParticipant,
    IsDeviceOwner,
    IsSystemActive,
    IsConsumerOrProducer,
)
from .services.blockchain import (
    get_dynamic_price,
    get_market_stats,
    get_tkn_balance,
    is_connected,
    CONTRACT_ADDRESS,
    w3,
)
from .services.fraud_service import calculate_risk_score, auto_flag_if_suspicious
from .services.wallet_service import credit_wallet, debit_wallet


def get_client_ip(request):
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


# ─────────────────────────────────────────────────────────────────────────────
#  Health
# ─────────────────────────────────────────────────────────────────────────────

class HealthCheckView(APIView):
    permission_classes = []

    def get(self, request):
        return Response({
            "django":     "ok",
            "blockchain": "connected" if is_connected() else "disconnected",
        })


# ─────────────────────────────────────────────────────────────────────────────
#  Device Views
# ─────────────────────────────────────────────────────────────────────────────

class DeviceListView(APIView):
    permission_classes = [IsAuthenticated, IsProducer]

    def get(self, request):
        devices    = EnergyDevice.objects.filter(owner=request.user)
        serializer = EnergyDeviceSerializer(devices, many=True)
        return Response(serializer.data)


class DeviceRegisterView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedProducer]

    def post(self, request):
        serializer = EnergyDeviceSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(owner=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DeviceDetailView(APIView):
    permission_classes = [IsAuthenticated, IsProducer]

    def get_object(self, pk, user):
        try:
            return EnergyDevice.objects.get(pk=pk, owner=user)
        except EnergyDevice.DoesNotExist:
            return None

    def get(self, request, pk):
        device = self.get_object(pk, request.user)
        if not device:
            return Response(
                {"error": "Device not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(EnergyDeviceSerializer(device).data)

    def patch(self, request, pk):
        device = self.get_object(pk, request.user)
        if not device:
            return Response(
                {"error": "Device not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = EnergyDeviceSerializer(
            device, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save(last_sync=timezone.now())
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        device = self.get_object(pk, request.user)
        if not device:
            return Response(
                {"error": "Device not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        device.delete()
        return Response(
            {"message": "Device removed."},
            status=status.HTTP_204_NO_CONTENT,
        )


# ─────────────────────────────────────────────────────────────────────────────
#  Listing Views
# ─────────────────────────────────────────────────────────────────────────────

class MarketListingsView(APIView):
    """Public listing of all active listings."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = EnergyListing.objects.filter(active=True, status="active")

        # Filters
        device_type = request.query_params.get("device_type")
        min_price   = request.query_params.get("min_price")
        max_price   = request.query_params.get("max_price")

        if device_type:
            qs = qs.filter(device_type=device_type)
        if min_price:
            qs = qs.filter(base_price_per_unit__gte=min_price)
        if max_price:
            qs = qs.filter(base_price_per_unit__lte=max_price)

        serializer = EnergyListingSerializer(qs, many=True)
        return Response(serializer.data)


class ProducerListingsView(APIView):
    permission_classes = [IsAuthenticated, IsProducer]

    def get(self, request):
        qs     = EnergyListing.objects.filter(producer=request.user)
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        serializer = EnergyListingSerializer(qs, many=True)
        return Response(serializer.data)


class ListingCreateView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedProducer, IsSystemActive]

    def post(self, request):
        serializer = EnergyListingCreateSerializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            listing = serializer.save(
                producer=request.user,
                status="active",
                active=True,
            )
            return Response(
                EnergyListingSerializer(listing).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ListingDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return EnergyListing.objects.get(pk=pk)
        except EnergyListing.DoesNotExist:
            return None

    def get(self, request, pk):
        listing = self.get_object(pk)
        if not listing:
            return Response(
                {"error": "Listing not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(EnergyListingSerializer(listing).data)

    def patch(self, request, pk):
        listing = self.get_object(pk)
        if not listing:
            return Response(
                {"error": "Listing not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if listing.producer != request.user:
            return Response(
                {"error": "Not your listing."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = EnergyListingCreateSerializer(
            listing, data=request.data,
            partial=True, context={"request": request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(EnergyListingSerializer(listing).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ListingCancelView(APIView):
    permission_classes = [IsAuthenticated, IsProducer, IsSystemActive]

    def post(self, request, pk):
        try:
            listing = EnergyListing.objects.get(pk=pk, producer=request.user)
        except EnergyListing.DoesNotExist:
            return Response(
                {"error": "Listing not found or not yours."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not listing.active:
            return Response(
                {"error": "Listing is already inactive."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        listing.active = False
        listing.status = "cancelled"
        listing.save()
        return Response({"message": "Listing cancelled."})


class ListingPauseAllView(APIView):
    permission_classes = [IsAuthenticated, IsProducer]

    def post(self, request):
        updated = EnergyListing.objects.filter(
            producer=request.user, active=True
        ).update(active=False, status="paused")
        return Response({
            "message": f"{updated} listings paused.",
            "paused":  updated,
        })


class ListingSyncView(APIView):
    """Sync a listing from chain into DB (called after on-chain tx)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        listing_id = request.data.get("listing_id")
        if listing_id is None:
            return Response(
                {"error": "listing_id required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            from .services.blockchain import get_listing_from_chain
            chain_data = get_listing_from_chain(int(listing_id))
        except Exception as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        listing, created = EnergyListing.objects.update_or_create(
            listing_id=chain_data["id"],
            defaults={
                "base_price_per_unit": chain_data["base_price_per_unit"],
                "price_per_unit": chain_data["base_price_per_unit"],
                "energy_amount": chain_data["energy_amount"],
                "device_type": chain_data.get("device_type", "solar"),
                "active": chain_data["active"],
                "status": "active" if chain_data["active"] else "sold",
            },
        )

        try:
            user = User.objects.get(
                wallet_address__iexact=chain_data["seller"]
            )
            listing.producer = user
            listing.save()

        except User.DoesNotExist:
            pass

        return Response(
            {"created": created, "listing": EnergyListingSerializer(listing).data},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────────────
#  Bid Views
# ─────────────────────────────────────────────────────────────────────────────

class PlaceBidView(APIView):
    permission_classes = [IsAuthenticated, IsConsumerOrProducer, IsSystemActive]

    def post(self, request):
        serializer = BidCreateSerializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            bid = serializer.save(buyer=request.user)
            return Response(
                BidDetailSerializer(bid).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ConsumerBidsView(APIView):
    permission_classes = [IsAuthenticated, IsConsumerOrProducer]

    def get(self, request):
        bids = Bid.objects.filter(buyer=request.user)
        status_filter = request.query_params.get("status")
        if status_filter:
            bids = bids.filter(status=status_filter)
        serializer = BidDetailSerializer(bids, many=True)
        return Response(serializer.data)


class ProducerBidsView(APIView):
    permission_classes = [IsAuthenticated, IsProducer]

    def get(self, request):
        bids = Bid.objects.filter(
            listing__producer=request.user,
            listing__active=True,
        )
        status_filter = request.query_params.get("status")
        if status_filter:
            bids = bids.filter(status=status_filter)
        serializer = BidDetailSerializer(bids, many=True)
        return Response(serializer.data)


class BidRespondView(APIView):
    permission_classes = [IsAuthenticated, IsVerifiedProducer, IsSystemActive]

    def post(self, request, pk):
        try:
            bid = Bid.objects.get(
                pk=pk,
                listing__producer=request.user,
            )
        except Bid.DoesNotExist:
            return Response(
                {"error": "Bid not found or not on your listing."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if bid.status not in ["pending", "countered"]:
            return Response(
                {"error": f"Bid is already {bid.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = BidResponseSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action = serializer.validated_data["action"]

        if action == "accept":
            bid.status = "accepted"
            bid.listing.active = False
            bid.listing.status = "sold"
            bid.listing.save()
            bid.save()
            return Response({
                "message": "Bid accepted. Complete the transaction on-chain.",
                "bid":     BidDetailSerializer(bid).data,
            })

        elif action == "reject":
            bid.status = "rejected"
            bid.save()
            return Response({
                "message": "Bid rejected.",
                "bid":     BidDetailSerializer(bid).data,
            })

        elif action == "counter":
            bid.status        = "countered"
            bid.counter_price = serializer.validated_data["counter_price"]
            bid.save()
            return Response({
                "message": "Counter offer sent.",
                "bid":     BidDetailSerializer(bid).data,
            })


# ─────────────────────────────────────────────────────────────────────────────
#  Transaction Views
# ─────────────────────────────────────────────────────────────────────────────

class TradeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        txns = Transaction.objects.filter(
            buyer=user
        ) | Transaction.objects.filter(seller=user)

        # Admin sees all
        if user.role == "admin" or user.is_staff:
            txns = Transaction.objects.all()

        txns = txns.order_by("-timestamp")
        serializer = TransactionSerializer(txns, many=True)
        return Response(serializer.data)


class TradeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            txn = Transaction.objects.get(pk=pk)
        except Transaction.DoesNotExist:
            return Response(
                {"error": "Transaction not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Participants only — or admin
        if (request.user != txn.buyer and
                request.user != txn.seller and
                request.user.role != "admin"):
            return Response(
                {"error": "Not a participant in this trade."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(TransactionSerializer(txn).data)


class TransactionSyncView(APIView):
    """Called after on-chain purchase — records the transaction in DB."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        required = [
            "tx_hash", "listing_id", "buyer_address",
            "seller_address", "energy_amount", "total_cost",
        ]
        for field in required:
            if not request.data.get(field):
                return Response(
                    {"error": f"{field} is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Check for duplicate
        if Transaction.objects.filter(
            tx_hash=request.data["tx_hash"]
        ).exists():
            return Response(
                {"error": "Transaction already recorded."},
                status=status.HTTP_409_CONFLICT,
            )

        listing = None
        try:
            listing = EnergyListing.objects.get(
                listing_id=request.data["listing_id"]
            )
        except EnergyListing.DoesNotExist:
            pass

        buyer_user  = None
        seller_user = None
        try:
            buyer_user = User.objects.get(
                wallet_address__iexact=request.data["buyer_address"]
            )
        except User.DoesNotExist:
            pass
        try:
            seller_user = User.objects.get(
                wallet_address__iexact=request.data["seller_address"]
            )
        except User.DoesNotExist:
            pass

        txn = Transaction.objects.create(
            listing       = listing,
            buyer         = buyer_user,
            seller        = seller_user,
            buyer_address = request.data["buyer_address"],
            seller_address= request.data["seller_address"],
            energy_amount = request.data["energy_amount"],
            total_cost    = request.data["total_cost"],
            tx_hash       = request.data["tx_hash"],
            block_number  = request.data.get("block_number"),
            multiplier_used = request.data.get("multiplier_used", 100),
        )

        # Credit seller wallet
        if seller_user:
            amount_tkn = int(request.data["total_cost"]) / 1e18
            credit_wallet(seller_user, amount_tkn, "earn", txn)

        # Auto-flag suspicious
        auto_flag_if_suspicious(txn)

        return Response(
            TransactionSerializer(txn).data,
            status=status.HTTP_201_CREATED,
        )


# ─────────────────────────────────────────────────────────────────────────────
#  Wallet Views
# ─────────────────────────────────────────────────────────────────────────────

class WalletView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        wallet, _ = CreditWallet.objects.get_or_create(user=request.user)

        # Also read on-chain TKN balance
        on_chain_tkn = "0"
        if request.user.wallet_address:
            try:
                on_chain_tkn = str(get_tkn_balance(request.user.wallet_address))
            except Exception:
                pass

        return Response({
            "wallet":        CreditWalletSerializer(wallet).data,
            "on_chain_tkn":  on_chain_tkn,
        })


class WalletTransactionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        wallet, _ = CreditWallet.objects.get_or_create(user=request.user)
        txns      = CreditTransaction.objects.filter(wallet=wallet)
        tx_type   = request.query_params.get("type")
        if tx_type:
            txns = txns.filter(type=tx_type)
        serializer = CreditTransactionSerializer(txns, many=True)
        return Response(serializer.data)


class WalletWithdrawView(APIView):
    permission_classes = [IsAuthenticated, IsSystemActive]

    def post(self, request):
        serializer = WithdrawSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        amount = serializer.validated_data["amount"]
        debit_wallet(request.user, amount, "withdraw")

        return Response({
            "message": f"Withdrawal of {amount} TKN initiated.",
            "amount":  str(amount),
        })


class WalletTopUpView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        amount = request.data.get("amount")
        if not amount or float(amount) <= 0:
            return Response(
                {"error": "Amount must be greater than 0."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        credit_wallet(request.user, float(amount), "topup")
        wallet = CreditWallet.objects.get(user=request.user)
        return Response({
            "message": f"Wallet topped up with {amount} TKN.",
            "balance": str(wallet.balance),
        })


class WalletClaimRewardsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Simple flat reward for demo
        REWARD_AMOUNT = 15
        credit_wallet(request.user, REWARD_AMOUNT, "reward", description="Incentive reward claim")
        wallet = CreditWallet.objects.get(user=request.user)
        return Response({
            "message":   f"Claimed {REWARD_AMOUNT} TKN reward.",
            "balance":   str(wallet.balance),
        })


# ─────────────────────────────────────────────────────────────────────────────
#  Auto Trade + Price Alert Views
# ─────────────────────────────────────────────────────────────────────────────

class AutoTradeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings, _ = AutoTradeSettings.objects.get_or_create(user=request.user)
        return Response(AutoTradeSerializer(settings).data)

    def patch(self, request):
        settings, _ = AutoTradeSettings.objects.get_or_create(user=request.user)
        serializer  = AutoTradeSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PriceAlertListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        alerts     = PriceAlert.objects.filter(user=request.user)
        serializer = PriceAlertSerializer(alerts, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = PriceAlertSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PriceAlertDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            alert = PriceAlert.objects.get(pk=pk, user=request.user)
            alert.delete()
            return Response(
                {"message": "Alert deleted."},
                status=status.HTTP_204_NO_CONTENT,
            )
        except PriceAlert.DoesNotExist:
            return Response(
                {"error": "Alert not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

    def patch(self, request, pk):
        try:
            alert = PriceAlert.objects.get(pk=pk, user=request.user)
        except PriceAlert.DoesNotExist:
            return Response(
                {"error": "Alert not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = PriceAlertSerializer(alert, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────────────────────────────────────
#  Market Stats Views
# ─────────────────────────────────────────────────────────────────────────────

class MarketStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            stats = get_market_stats()
            PriceHistory.objects.create(
                multiplier=stats["multiplier"],
                supply=stats["supply"],
                demand=stats["demand"],
            )
            return Response({
                "supply":             stats["supply"],
                "demand":             stats["demand"],
                "multiplier":         stats["multiplier"],
                "multiplier_display": f"{stats['multiplier'] / 100:.2f}x",
                "total_listings":     stats["total_listings"],
                "all_purchases":      stats["all_purchases"],
            })
        except Exception as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class MarketPriceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        listing_id = request.query_params.get("listing_id")
        if not listing_id:
            return Response(
                {"error": "listing_id required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            data = get_dynamic_price(int(listing_id))
            return Response(data)
        except Exception as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class MarketHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        history = PriceHistory.objects.all()[:50]
        data    = [
            {
                "multiplier":  h.multiplier,
                "supply":      h.supply,
                "demand":      h.demand,
                "recorded_at": h.recorded_at,
            }
            for h in history
        ]
        return Response(data)


class ListenerStatusView(APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        try:
            block = w3.eth.block_number
            return Response({
                "connected":      True,
                "current_block":  block,
                "contract":       CONTRACT_ADDRESS,
                "total_listings": EnergyListing.objects.count(),
                "total_txns":     Transaction.objects.count(),
            })
        except Exception as exc:
            return Response(
                {"connected": False, "error": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


# ─────────────────────────────────────────────────────────────────────────────
#  Producer Stats View
# ─────────────────────────────────────────────────────────────────────────────

class ProducerStatsView(APIView):
    permission_classes = [IsAuthenticated, IsProducer]

    def get(self, request):
        user      = request.user
        listings  = EnergyListing.objects.filter(producer=user)
        sales     = Transaction.objects.filter(seller=user)

        total_volume = sum(int(t.total_cost) for t in sales)
        total_energy = sum(t.energy_amount for t in sales)

        return Response({
            "total_listings":    listings.count(),
            "active_listings":   listings.filter(active=True).count(),
            "sold_listings":     listings.filter(status="sold").count(),
            "total_sales":       sales.count(),
            "total_energy_sold": total_energy,
            "total_volume_wei":  str(total_volume),
            "total_volume_eth":  str(round(total_volume / 10**18, 6)),
        })


# ─────────────────────────────────────────────────────────────────────────────
#  Consumer Stats View
# ─────────────────────────────────────────────────────────────────────────────

class ConsumerStatsView(APIView):
    permission_classes = [IsAuthenticated, IsConsumerOrProducer]

    def get(self, request):
        user      = request.user
        purchases = Transaction.objects.filter(buyer=user)

        total_spent  = sum(int(t.total_cost) for t in purchases)
        total_energy = sum(t.energy_amount for t in purchases)

        return Response({
            "total_purchases":     purchases.count(),
            "total_energy_bought": total_energy,
            "total_spent_wei":     str(total_spent),
            "total_spent_eth":     str(round(total_spent / 10**18, 6)),
            "available_listings":  EnergyListing.objects.filter(active=True).count(),
        })