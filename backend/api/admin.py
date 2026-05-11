from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, EnergyDevice, EnergyListing, Bid,
    Transaction, CreditWallet, CreditTransaction,
    AutoTradeSettings, PriceAlert, FraudFlag,
    AuditLog, Broadcast, PriceHistory, DynamicPrice, PricingConfig,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ["username", "email", "role", "is_verified", "is_active", "created_at"]
    list_filter   = ["role", "is_verified", "is_active"]
    search_fields = ["username", "email", "wallet_address"]
    fieldsets     = BaseUserAdmin.fieldsets + (
        ("DECT", {"fields": ("role", "wallet_address", "is_verified", "profile_avatar")}),
    )


@admin.register(EnergyDevice)
class DeviceAdmin(admin.ModelAdmin):
    list_display  = ["name", "owner", "device_type", "capacity_kw", "status"]
    list_filter   = ["device_type", "status"]
    search_fields = ["name", "owner__username", "smart_meter_id"]


@admin.register(EnergyListing)
class ListingAdmin(admin.ModelAdmin):
    list_display  = ["listing_id", "producer", "energy_amount", "status", "active", "created_at"]
    list_filter   = ["status", "active", "device_type"]
    search_fields = ["listing_id", "producer__username"]


@admin.register(Bid)
class BidAdmin(admin.ModelAdmin):
    list_display  = ["id", "listing", "buyer", "status", "created_at"]
    list_filter   = ["status"]
    search_fields = ["buyer__username"]


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display  = ["tx_hash", "buyer", "seller", "energy_amount", "total_cost", "timestamp"]
    search_fields = ["tx_hash", "buyer_address", "seller_address"]


@admin.register(CreditWallet)
class WalletAdmin(admin.ModelAdmin):
    list_display  = ["user", "balance", "total_earned", "total_withdrawn"]
    search_fields = ["user__username"]


@admin.register(CreditTransaction)
class CreditTxAdmin(admin.ModelAdmin):
    list_display  = ["wallet", "type", "amount", "balance_after", "created_at"]
    list_filter   = ["type"]


@admin.register(FraudFlag)
class FraudAdmin(admin.ModelAdmin):
    list_display  = ["id", "wallet_address", "risk_score", "status", "flagged_by"]
    list_filter   = ["status"]


@admin.register(AuditLog)
class AuditAdmin(admin.ModelAdmin):
    list_display  = ["admin", "action", "target_model", "created_at"]
    list_filter   = ["action"]
    readonly_fields = [f.name for f in AuditLog._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Broadcast)
class BroadcastAdmin(admin.ModelAdmin):
    list_display = ["alert_type", "recipients", "sent_by", "sent_at"]


@admin.register(PricingConfig)
class PricingAdmin(admin.ModelAdmin):
    list_display = ["supply_weight", "demand_weight", "min_price_floor", "max_price_ceiling"]