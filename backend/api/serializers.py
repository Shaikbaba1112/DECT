from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.hashers import make_password
from .models import (
    User, EnergyDevice, EnergyListing, Bid,
    Transaction, CreditWallet, CreditTransaction,
    AutoTradeSettings, PriceAlert, FraudFlag,
    AuditLog, Broadcast, PriceHistory,
    DynamicPrice, PricingConfig,
)


# ─────────────────────────────────────────────────────────────────────────────
#  Auth Serializers
# ─────────────────────────────────────────────────────────────────────────────

class UserRegisterSerializer(serializers.ModelSerializer):
    password         = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model  = User
        fields = [
            "id", "username", "email",
            "password", "password_confirm",
            "role",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        if attrs.get("role") == "admin":
            raise serializers.ValidationError({"role": "Cannot self-register as admin."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user     = User(**validated_data)
        user.set_password(password)
        user.save()

        # Auto-create wallet
        CreditWallet.objects.create(user=user)
        # Auto-create auto-trade settings
        AutoTradeSettings.objects.create(user=user)
        return user


class UserLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class UserProfileSerializer(serializers.ModelSerializer):
    wallet_balance = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = [
            "id", "username", "email", "role",
            "wallet_address", "is_verified",
            "profile_avatar", "created_at",
            "wallet_balance",
        ]
        read_only_fields = ["id", "role", "is_verified", "created_at"]

    def get_wallet_balance(self, obj):
        try:
            return str(obj.wallet.balance)
        except CreditWallet.DoesNotExist:
            return "0"


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ["username", "email", "profile_avatar"]


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"new_password": "Passwords do not match."})
        return attrs


class WalletConnectSerializer(serializers.Serializer):
    wallet_address = serializers.CharField(max_length=42)

    def validate_wallet_address(self, value):
        if not value.startswith("0x"):
            raise serializers.ValidationError("Wallet address must start with 0x.")
        if len(value) != 42:
            raise serializers.ValidationError("Wallet address must be 42 characters.")
        # Check not already used by another user
        request = self.context.get("request")
        qs = User.objects.filter(wallet_address__iexact=value)
        if request:
            qs = qs.exclude(pk=request.user.pk)
        if qs.exists():
            raise serializers.ValidationError("Wallet already linked to another account.")
        return value.lower()


# ─────────────────────────────────────────────────────────────────────────────
#  Device Serializers
# ─────────────────────────────────────────────────────────────────────────────

class EnergyDeviceSerializer(serializers.ModelSerializer):
    owner_username = serializers.ReadOnlyField(source="owner.username")

    class Meta:
        model  = EnergyDevice
        fields = [
            "id", "owner", "owner_username",
            "name", "device_type", "capacity_kw",
            "current_output", "status",
            "smart_meter_id", "last_sync", "created_at",
        ]
        read_only_fields = ["id", "owner", "created_at"]


# ─────────────────────────────────────────────────────────────────────────────
#  Listing Serializers
# ─────────────────────────────────────────────────────────────────────────────

class EnergyListingSerializer(serializers.ModelSerializer):
    producer_username = serializers.ReadOnlyField(source="producer.username")
    device_name       = serializers.ReadOnlyField(source="device.name")
    total_value_wei   = serializers.SerializerMethodField()

    class Meta:
        model  = EnergyListing
        fields = [
            "id", "listing_id",
            "producer", "producer_username",
            "device", "device_name",
            "energy_amount",
            "base_price_per_unit", "price_per_unit",
            "price_type", "min_price_per_unit",
            "status", "device_type", "active",
            "expires_at", "created_at", "updated_at",
            "total_value_wei",
        ]
        read_only_fields = [
            "id", "producer", "active",
            "created_at", "updated_at",
        ]

    def get_total_value_wei(self, obj):
        try:
            return str(int(obj.price_per_unit) * obj.energy_amount)
        except (ValueError, TypeError):
            return "0"


class EnergyListingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EnergyListing
        fields = [
            "listing_id", "device", "energy_amount",
            "base_price_per_unit", "price_per_unit",
            "price_type", "min_price_per_unit",
            "device_type", "expires_at",
        ]

    def validate_energy_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Energy amount must be greater than 0.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        device  = attrs.get("device")
        if device and device.owner != request.user:
            raise serializers.ValidationError({"device": "Device does not belong to you."})
        return attrs


# ─────────────────────────────────────────────────────────────────────────────
#  Bid Serializers
# ─────────────────────────────────────────────────────────────────────────────

class BidCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Bid
        fields = [
            "listing", "offered_price_per_unit",
            "energy_amount", "on_chain_bid_id",
        ]

    def validate(self, attrs):
        listing = attrs["listing"]
        if not listing.active:
            raise serializers.ValidationError({"listing": "Listing is not active."})

        request = self.context.get("request")
        if listing.producer == request.user:
            raise serializers.ValidationError({"listing": "Cannot bid on your own listing."})

        energy = attrs["energy_amount"]
        if energy <= 0 or energy > listing.energy_amount:
            raise serializers.ValidationError({
                "energy_amount": f"Must be between 1 and {listing.energy_amount} Wh."
            })

        price = int(attrs["offered_price_per_unit"])
        if price <= 0:
            raise serializers.ValidationError({
                "offered_price_per_unit": "Price must be greater than 0."
            })
        return attrs


class BidDetailSerializer(serializers.ModelSerializer):
    buyer_username   = serializers.ReadOnlyField(source="buyer.username")
    listing_id_field = serializers.ReadOnlyField(source="listing.listing_id")
    total_offered    = serializers.SerializerMethodField()

    class Meta:
        model  = Bid
        fields = [
            "id", "listing", "listing_id_field",
            "buyer", "buyer_username",
            "offered_price_per_unit", "energy_amount",
            "status", "counter_price",
            "on_chain_bid_id",
            "created_at", "updated_at",
            "total_offered",
        ]
        read_only_fields = [
            "id", "buyer", "status",
            "created_at", "updated_at",
        ]

    def get_total_offered(self, obj):
        try:
            return str(int(obj.offered_price_per_unit) * obj.energy_amount)
        except (ValueError, TypeError):
            return "0"


class BidResponseSerializer(serializers.Serializer):
    action        = serializers.ChoiceField(choices=["accept", "reject", "counter"])
    counter_price = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["action"] == "counter" and not attrs.get("counter_price"):
            raise serializers.ValidationError({
                "counter_price": "Counter price required when action is counter."
            })
        return attrs


# ─────────────────────────────────────────────────────────────────────────────
#  Transaction Serializer
# ─────────────────────────────────────────────────────────────────────────────

class TransactionSerializer(serializers.ModelSerializer):
    buyer_username  = serializers.ReadOnlyField(source="buyer.username")
    seller_username = serializers.ReadOnlyField(source="seller.username")
    listing_id_field = serializers.ReadOnlyField(source="listing.listing_id")

    class Meta:
        model  = Transaction
        fields = [
            "id",
            "listing", "listing_id_field",
            "bid",
            "buyer", "buyer_username", "buyer_address",
            "seller", "seller_username", "seller_address",
            "energy_amount", "total_cost",
            "multiplier_used", "tx_hash",
            "block_number", "timestamp",
        ]
        read_only_fields = fields


# ─────────────────────────────────────────────────────────────────────────────
#  Wallet Serializers
# ─────────────────────────────────────────────────────────────────────────────

class CreditWalletSerializer(serializers.ModelSerializer):
    username = serializers.ReadOnlyField(source="user.username")

    class Meta:
        model  = CreditWallet
        fields = [
            "id", "user", "username",
            "balance", "total_earned",
            "total_withdrawn", "created_at",
        ]
        read_only_fields = fields


class CreditTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CreditTransaction
        fields = [
            "id", "wallet", "type",
            "amount", "balance_after",
            "description", "trade", "created_at",
        ]
        read_only_fields = fields


class WithdrawSerializer(serializers.Serializer):
    amount             = serializers.DecimalField(max_digits=18, decimal_places=6)
    destination_wallet = serializers.CharField(max_length=42)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than 0.")
        if value < 10:
            raise serializers.ValidationError("Minimum withdrawal is 10 TKN.")
        return value

    def validate_destination_wallet(self, value):
        if not value.startswith("0x") or len(value) != 42:
            raise serializers.ValidationError("Invalid wallet address.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        try:
            wallet = request.user.wallet
        except CreditWallet.DoesNotExist:
            raise serializers.ValidationError("No wallet found.")
        if attrs["amount"] > wallet.balance:
            raise serializers.ValidationError({"amount": "Insufficient balance."})
        return attrs


# ─────────────────────────────────────────────────────────────────────────────
#  Auto Trade + Alert Serializers
# ─────────────────────────────────────────────────────────────────────────────

class AutoTradeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AutoTradeSettings
        fields = [
            "id",
            "max_price_per_kwh", "max_kwh_per_trade",
            "min_price_per_kwh", "sell_when_battery_pct",
            "active_start_time", "active_end_time",
            "is_active", "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]

    def validate_sell_when_battery_pct(self, value):
        if value is not None and not (0 <= value <= 100):
            raise serializers.ValidationError("Battery percentage must be 0–100.")
        return value

    def validate(self, attrs):
        start = attrs.get("active_start_time")
        end   = attrs.get("active_end_time")
        if start and end and start >= end:
            raise serializers.ValidationError({
                "active_start_time": "Start time must be before end time."
            })
        return attrs


class PriceAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PriceAlert
        fields = [
            "id", "alert_above", "alert_below",
            "is_active", "last_triggered_at", "created_at",
        ]
        read_only_fields = ["id", "last_triggered_at", "created_at"]

    def validate(self, attrs):
        if not attrs.get("alert_above") and not attrs.get("alert_below"):
            raise serializers.ValidationError(
                "At least one of alert_above or alert_below is required."
            )
        return attrs


# ─────────────────────────────────────────────────────────────────────────────
#  Admin Serializers
# ─────────────────────────────────────────────────────────────────────────────

class AdminUserSerializer(serializers.ModelSerializer):
    wallet_balance = serializers.SerializerMethodField()
    trade_count    = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = [
            "id", "username", "email", "role",
            "wallet_address", "is_verified",
            "is_active", "is_staff",
            "wallet_balance", "trade_count",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_wallet_balance(self, obj):
        try:
            return str(obj.wallet.balance)
        except CreditWallet.DoesNotExist:
            return "0"

    def get_trade_count(self, obj):
        return obj.purchases.count() + obj.sales.count()


class FraudFlagSerializer(serializers.ModelSerializer):
    reviewed_by_username = serializers.ReadOnlyField(source="reviewed_by.username")

    class Meta:
        model  = FraudFlag
        fields = [
            "id", "transaction", "wallet_address",
            "risk_score", "reason", "status",
            "flagged_by", "reviewed_by",
            "reviewed_by_username",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "created_at", "updated_at",
            "reviewed_by_username",
        ]


class AuditLogSerializer(serializers.ModelSerializer):
    admin_username = serializers.ReadOnlyField(source="admin.username")

    class Meta:
        model  = AuditLog
        fields = [
            "id", "admin", "admin_username",
            "action", "target_model", "target_id",
            "details", "ip_address", "created_at",
        ]
        read_only_fields = fields


class BroadcastSerializer(serializers.ModelSerializer):
    sent_by_username = serializers.ReadOnlyField(source="sent_by.username")

    class Meta:
        model  = Broadcast
        fields = [
            "id", "sent_by", "sent_by_username",
            "alert_type", "recipients",
            "message", "sent_at",
        ]
        read_only_fields = ["id", "sent_by", "sent_at", "sent_by_username"]

    def validate_message(self, value):
        if len(value.strip()) < 5:
            raise serializers.ValidationError("Message too short.")
        return value


class PricingConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PricingConfig
        fields = [
            "id",
            "supply_weight", "demand_weight",
            "min_price_floor", "max_price_ceiling",
            "update_frequency_secs", "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]

    def validate(self, attrs):
        sw = attrs.get("supply_weight")
        dw = attrs.get("demand_weight")
        if sw and dw:
            total = float(sw) + float(dw)
            if abs(total - 1.0) > 0.001:
                raise serializers.ValidationError(
                    "supply_weight + demand_weight must equal 1.0"
                )
        floor   = attrs.get("min_price_floor")
        ceiling = attrs.get("max_price_ceiling")
        if floor and ceiling and floor >= ceiling:
            raise serializers.ValidationError(
                "min_price_floor must be less than max_price_ceiling."
            )
        return attrs