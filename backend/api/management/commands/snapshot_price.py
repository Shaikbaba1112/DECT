import time
import logging
from django.core.management.base import BaseCommand
from api.services.pricing_service import record_price_snapshot

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Record price snapshots every N seconds"

    def add_arguments(self, parser):
        parser.add_argument(
            "--interval",
            type=int,
            default=30,
            help="Snapshot interval in seconds (default: 30)",
        )

    def handle(self, *args, **options):
        interval = options["interval"]
        self.stdout.write(
            self.style.SUCCESS(
                f"Price snapshot started (every {interval}s)… Ctrl+C to stop"
            )
        )
        while True:
            try:
                record_price_snapshot()
                logger.info("Price snapshot recorded.")
            except Exception as exc:
                logger.error(f"Snapshot error: {exc}")
            time.sleep(interval)