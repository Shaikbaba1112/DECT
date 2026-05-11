from decimal import Decimal
from ..models import DynamicPrice, PricingConfig, EnergyListing, Transaction
from django.utils import timezone
from datetime import timedelta


def get_current_price() -> Decimal:
    """
    Calculate dynamic price based on supply and demand.
    """
    config, _ = PricingConfig.objects.get_or_create(pk=1)

    supply = EnergyListing.objects.filter(active=True).count()
    demand = Transaction.objects.filter(
        timestamp__gte=timezone.now() - timedelta(hours=1)
    ).count()

    base_price = (config.min_price_floor + config.max_price_ceiling) / 2

    if supply == 0:
        return Decimal(str(config.max_price_ceiling))

    ratio = Decimal(str(demand + 1)) / Decimal(str(supply + 1))
    price = base_price * (
        Decimal(str(config.demand_weight)) * ratio +
        Decimal(str(config.supply_weight)) / ratio
    )

    # Clamp
    price = max(config.min_price_floor, min(price, config.max_price_ceiling))
    return price


def record_price_snapshot():
    """Save a DynamicPrice record every 30 seconds."""
    config, _ = PricingConfig.objects.get_or_create(pk=1)

    supply = EnergyListing.objects.filter(active=True).count()
    demand = Transaction.objects.filter(
        timestamp__gte=timezone.now() - timedelta(hours=1)
    ).count()
    price  = get_current_price()
    ratio  = Decimal(str(demand + 1)) / Decimal(str(supply + 1))

    DynamicPrice.objects.create(
        price_per_kwh=price,
        supply_kwh=Decimal(str(supply)),
        demand_kwh=Decimal(str(demand)),
        supply_demand_ratio=ratio,
    )