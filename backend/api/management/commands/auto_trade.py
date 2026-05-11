import time
import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import AutoTradeSettings, EnergyListing, User
from api.services.pricing_service import get_current_price

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Execute auto-trading rules for all users"

    def add_arguments(self, parser):
        parser.add_argument(
            "--interval",
            type=int,
            default=30,
            help="Check interval in seconds (default: 30)",
        )

    def handle(self, *args, **options):
        interval = options["interval"]
        self.stdout.write(
            self.style.SUCCESS(
                f"Auto-trade engine started (every {interval}s)… Ctrl+C to stop"
            )
        )
        while True:
            try:
                self._run_auto_trades()
            except Exception as exc:
                logger.error(f"Auto-trade error: {exc}")
            time.sleep(interval)

    def _run_auto_trades(self):
        settings = AutoTradeSettings.objects.filter(is_active=True)
        price    = get_current_price()
        now      = timezone.now().time()

        for s in settings:
            # Check active hours
            if s.active_start_time and s.active_end_time:
                if not (s.active_start_time <= now <= s.active_end_time):
                    continue

            user = s.user

            # Consumer auto-buy
            if user.is_consumer and s.max_price_per_kwh:
                if price <= s.max_price_per_kwh:
                    listings = EnergyListing.objects.filter(
                        active=True,
                        base_price_per_unit__lte=str(
                            int(s.max_price_per_kwh * 10**18)
                        ),
                    )
                    if listings.exists():
                        logger.info(
                            f"[AutoBuy] {user.username} — "
                            f"eligible listing found at price {price}"
                        )
                        # Actual on-chain tx handled by frontend
                        # This is a notification trigger only

            # Producer auto-sell
            if user.is_producer and s.min_price_per_kwh:
                if price >= s.min_price_per_kwh:
                    logger.info(
                        f"[AutoSell] {user.username} — "
                        f"price {price} meets minimum {s.min_price_per_kwh}"
                    )