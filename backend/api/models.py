import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


# ─────────────────────────────────────────────────────────────────────────────
#  User
# ─────────────────────────────────────────────────────────────────────────────

class User(AbstractUser):
    ROLE_CHOICES = [
        ("consumer", "Consumer"),
        ("producer", "Producer"),
        ("both",     "Both"),
        ("admin",    "Admin"),
    ]

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role           = models.CharField(max_length=20, choices=ROLE_CHOICES, default="consumer")
    wallet_address = models.CharField(max_length=42, blank=True, null=True, unique=True)
    is_verified    = models.BooleanField(default=False)
    profile_avatar = models.ImageField(upload_to="avatars/", blank=True, null=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.username} ({self.role})"

    @property
    def is_consumer(self):
        return self.role in ["consumer", "both"]

    @property
    def is_producer(self):
        return self.role in ["producer", "both"]

    @property
    def is_admin_role(self):
        return self.role == "admin" or self.is_staff


# ─────────────────────────────────────────────────────────────────────────────
#  Energy Device
# ─────────────────────────────────────────────────────────────────────────────

class EnergyDevice(models.Model):
    DEVICE_TYPE_CHOICES = [
        ("solar",   "Solar Panel"),
        ("wind",    "Wind Turbine"),
        ("battery", "Battery Storage"),
    ]

    STATUS_CHOICES = [
        ("active",       "Active"),
        ("offline",      "Offline"),
        ("charging",     "Charging"),
        ("maintenance",  "Maintenance"),
    ]

    owner          = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="devices"
    )
    name           = models.CharField(max_length=100)
    device_type    = models.CharField(max_length=20, choices=DEVICE_TYPE_CHOICES)
    capacity_kw    = models.DecimalField(max_digits=8, decimal_places=2)
    current_output = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    smart_meter_id = models.CharField(max_length=50, blank=True, null=True, unique=True)
    last_sync      = models.DateTimeField(null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.device_type}) — {self.owner.username}"


# ─────────────────────────────────────────────────────────────────────────────
#  Energy Listing
# ─────────────────────────────────────────────────────────────────────────────
class EnergyListing(models.Model):
    STATUS_CHOICES = [
        ("pending",   "Pending Approval"),   # ← ADD THIS
        ("active",    "Active"),
        ("sold",      "Sold"),
        ("expired",   "Expired"),
        ("cancelled", "Cancelled"),
        ("paused",    "Paused"),
        ("rejected",  "Rejected"),           # ← ADD THIS
    ]

    listing_id          = models.PositiveIntegerField(unique=True)
    producer            = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, related_name="listings"
    )
    device              = models.ForeignKey(
        EnergyDevice, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="listings"
    )
    energy_amount       = models.PositiveBigIntegerField()
    base_price_per_unit = models.CharField(max_length=78)
    price_per_unit      = models.CharField(max_length=78)
    price_type          = models.CharField(max_length=10, default="dynamic")
    min_price_per_unit  = models.CharField(max_length=78, blank=True, null=True)
    status              = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending"  # ← default pending
    )
    device_type         = models.CharField(max_length=20, default="solar")
    is_admin_verified   = models.BooleanField(default=False)       # ← NEW
    admin_reviewed_by   = models.ForeignKey(                        # ← NEW
        User, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="reviewed_listings"
    )
    rejection_reason    = models.CharField(                         # ← NEW
        max_length=255, blank=True, null=True
    )
    expires_at          = models.DateTimeField(null=True, blank=True)
    active              = models.BooleanField(default=False)        # ← default False
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        seller = self.producer.username if self.producer else "Unknown"
        return f"Listing #{self.listing_id} [{self.status}] — {seller}"
# ─────────────────────────────────────────────────────────────────────────────
#  Bid
# ─────────────────────────────────────────────────────────────────────────────

class Bid(models.Model):
    STATUS_CHOICES = [
        ("pending",   "Pending"),
        ("accepted",  "Accepted"),
        ("rejected",  "Rejected"),
        ("countered", "Countered"),
    ]

    listing              = models.ForeignKey(
        EnergyListing, on_delete=models.CASCADE, related_name="bids"
    )
    buyer                = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="bids"
    )
    offered_price_per_unit = models.CharField(max_length=78)
    energy_amount        = models.PositiveBigIntegerField()
    status               = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pending"
    )
    counter_price        = models.CharField(max_length=78, blank=True, null=True)
    on_chain_bid_id      = models.PositiveIntegerField(null=True, blank=True)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Bid #{self.id} — {self.buyer.username} on Listing #{self.listing.listing_id}"


# ─────────────────────────────────────────────────────────────────────────────
#  Transaction
# ─────────────────────────────────────────────────────────────────────────────

class Transaction(models.Model):
    listing        = models.ForeignKey(
        EnergyListing, on_delete=models.SET_NULL,
        null=True, related_name="transactions"
    )
    bid            = models.ForeignKey(
        Bid, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="transaction"
    )
    buyer          = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, related_name="purchases"
    )
    seller         = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, related_name="sales"
    )
    buyer_address  = models.CharField(max_length=42)
    seller_address = models.CharField(max_length=42)
    energy_amount  = models.PositiveBigIntegerField()
    total_cost     = models.CharField(max_length=78)
    multiplier_used = models.PositiveIntegerField(default=100)
    tx_hash        = models.CharField(max_length=66, unique=True)
    block_number   = models.PositiveBigIntegerField(null=True, blank=True)
    timestamp      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"Tx {self.tx_hash[:12]}…"


# ─────────────────────────────────────────────────────────────────────────────
#  Credit Wallet
# ─────────────────────────────────────────────────────────────────────────────

class CreditWallet(models.Model):
    user             = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="wallet"
    )
    balance          = models.DecimalField(max_digits=18, decimal_places=6, default=0)
    total_earned     = models.DecimalField(max_digits=18, decimal_places=6, default=0)
    total_withdrawn  = models.DecimalField(max_digits=18, decimal_places=6, default=0)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Wallet — {self.user.username} ({self.balance} TKN)"


class CreditTransaction(models.Model):
    TYPE_CHOICES = [
        ("earn",     "Earn"),
        ("spend",    "Spend"),
        ("withdraw", "Withdraw"),
        ("topup",    "Top Up"),
        ("reward",   "Reward"),
    ]

    wallet       = models.ForeignKey(
        CreditWallet, on_delete=models.CASCADE, related_name="credit_transactions"
    )
    type         = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount       = models.DecimalField(max_digits=18, decimal_places=6)
    balance_after = models.DecimalField(max_digits=18, decimal_places=6)
    description  = models.CharField(max_length=255, blank=True)
    trade        = models.ForeignKey(
        Transaction, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="credit_records"
    )
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type} {self.amount} TKN — {self.wallet.user.username}"


# ─────────────────────────────────────────────────────────────────────────────
#  Auto Trade Settings
# ─────────────────────────────────────────────────────────────────────────────

class AutoTradeSettings(models.Model):
    user                  = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="auto_trade"
    )
    # Consumer
    max_price_per_kwh     = models.DecimalField(
        max_digits=10, decimal_places=6, null=True, blank=True
    )
    max_kwh_per_trade     = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    # Producer
    min_price_per_kwh     = models.DecimalField(
        max_digits=10, decimal_places=6, null=True, blank=True
    )
    sell_when_battery_pct = models.PositiveIntegerField(null=True, blank=True)
    active_start_time     = models.TimeField(null=True, blank=True)
    active_end_time       = models.TimeField(null=True, blank=True)
    is_active             = models.BooleanField(default=False)
    updated_at            = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"AutoTrade — {self.user.username}"


# ─────────────────────────────────────────────────────────────────────────────
#  Price Alert
# ─────────────────────────────────────────────────────────────────────────────

class PriceAlert(models.Model):
    user              = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="price_alerts"
    )
    alert_above       = models.DecimalField(
        max_digits=10, decimal_places=6, null=True, blank=True
    )
    alert_below       = models.DecimalField(
        max_digits=10, decimal_places=6, null=True, blank=True
    )
    is_active         = models.BooleanField(default=True)
    last_triggered_at = models.DateTimeField(null=True, blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Alert — {self.user.username}"


# ─────────────────────────────────────────────────────────────────────────────
#  Fraud Flag
# ─────────────────────────────────────────────────────────────────────────────

class FraudFlag(models.Model):
    STATUS_CHOICES = [
        ("open",      "Open"),
        ("reviewed",  "Reviewed"),
        ("safe",      "Safe"),
        ("confirmed", "Confirmed Fraud"),
    ]

    transaction    = models.ForeignKey(
        Transaction, on_delete=models.CASCADE, related_name="fraud_flags"
    )
    wallet_address = models.CharField(max_length=42)
    risk_score     = models.PositiveIntegerField(default=0)
    reason         = models.CharField(max_length=255)
    status         = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="open"
    )
    flagged_by     = models.CharField(max_length=50, default="system")
    reviewed_by    = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="fraud_reviews"
    )
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-risk_score", "-created_at"]

    def __str__(self):
        return f"Flag #{self.id} — score {self.risk_score} — {self.status}"


# ─────────────────────────────────────────────────────────────────────────────
#  Audit Log
# ─────────────────────────────────────────────────────────────────────────────

class AuditLog(models.Model):
    admin        = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, related_name="audit_logs"
    )
    action       = models.CharField(max_length=100)
    target_model = models.CharField(max_length=50, blank=True)
    target_id    = models.CharField(max_length=100, blank=True)
    details      = models.JSONField(default=dict)
    ip_address   = models.GenericIPAddressField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering  = ["-created_at"]

    def __str__(self):
        admin_name = self.admin.username if self.admin else "Unknown"
        return f"[{self.created_at}] {admin_name} — {self.action}"

    def save(self, *args, **kwargs):
        # Immutable — never allow updates
        if self.pk:
            raise PermissionError("AuditLog records are immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("AuditLog records cannot be deleted.")


# ─────────────────────────────────────────────────────────────────────────────
#  Broadcast
# ─────────────────────────────────────────────────────────────────────────────

class Broadcast(models.Model):
    ALERT_TYPE_CHOICES = [
        ("info",        "Info"),
        ("warning",     "Warning"),
        ("critical",    "Critical"),
        ("maintenance", "Maintenance"),
    ]

    RECIPIENT_CHOICES = [
        ("all",       "All Users"),
        ("consumers", "Consumers Only"),
        ("producers", "Producers Only"),
    ]

    sent_by    = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, related_name="broadcasts"
    )
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPE_CHOICES, default="info")
    recipients = models.CharField(max_length=20, choices=RECIPIENT_CHOICES, default="all")
    message    = models.TextField()
    sent_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-sent_at"]

    def __str__(self):
        return f"[{self.alert_type.upper()}] {self.message[:50]}"


# ─────────────────────────────────────────────────────────────────────────────
#  Price History
# ─────────────────────────────────────────────────────────────────────────────

class PriceHistory(models.Model):
    multiplier   = models.PositiveIntegerField()
    supply       = models.PositiveIntegerField()
    demand       = models.PositiveIntegerField()
    recorded_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-recorded_at"]

    def __str__(self):
        return f"Price snapshot {self.multiplier} @ {self.recorded_at}"


class DynamicPrice(models.Model):
    price_per_kwh       = models.DecimalField(max_digits=10, decimal_places=6)
    supply_kwh          = models.DecimalField(max_digits=12, decimal_places=2)
    demand_kwh          = models.DecimalField(max_digits=12, decimal_places=2)
    supply_demand_ratio = models.DecimalField(max_digits=6,  decimal_places=4)
    recorded_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-recorded_at"]

    def __str__(self):
        return f"${self.price_per_kwh}/kWh @ {self.recorded_at}"


class PricingConfig(models.Model):
    supply_weight          = models.DecimalField(max_digits=4, decimal_places=2, default=0.60)
    demand_weight          = models.DecimalField(max_digits=4, decimal_places=2, default=0.40)
    min_price_floor        = models.DecimalField(max_digits=10, decimal_places=6, default=0.07)
    max_price_ceiling      = models.DecimalField(max_digits=10, decimal_places=6, default=0.12)
    update_frequency_secs  = models.PositiveIntegerField(default=30)
    updated_at             = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Pricing Config"

    def __str__(self):
        return f"PricingConfig (floor={self.min_price_floor}, ceiling={self.max_price_ceiling})"