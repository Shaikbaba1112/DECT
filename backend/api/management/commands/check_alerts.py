import time
import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import PriceAlert
from api.services.pricing_service import get_current_price

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Check price alerts and trigger notifications"

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
                f"Alert checker started (every {interval}s)… Ctrl+C to stop"
            )
        )
        while True:
            try:
                self._check_alerts()
            except Exception as exc:
                logger.error(f"Alert check error: {exc}")
            time.sleep(interval)

    def _check_alerts(self):
        price   = get_current_price()
        alerts  = PriceAlert.objects.filter(is_active=True)
        triggered = 0

        for alert in alerts:
            fired = False
            if alert.alert_above and price > alert.alert_above:
                logger.info(
                    f"Alert triggered for {alert.user.username}: "
                    f"price {price} > {alert.alert_above}"
                )
                fired = True
            if alert.alert_below and price < alert.alert_below:
                logger.info(
                    f"Alert triggered for {alert.user.username}: "
                    f"price {price} < {alert.alert_below}"
                )
                fired = True

            if fired:
                alert.last_triggered_at = timezone.now()
                alert.save()
                triggered += 1

        if triggered:
            logger.info(f"{triggered} alert(s) triggered.")
            