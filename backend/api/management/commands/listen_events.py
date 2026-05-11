import logging
from django.core.management.base import BaseCommand
from api.services.event_listener import run_listener

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)


class Command(BaseCommand):
    help = "Listen to smart contract events and sync to DB"

    def add_arguments(self, parser):
        parser.add_argument(
            "--interval",
            type=int,
            default=2,
            help="Poll interval in seconds (default: 2)",
        )

    def handle(self, *args, **options):
        interval = options["interval"]
        self.stdout.write(
            self.style.SUCCESS(
                f"Starting event listener (poll every {interval}s)… Ctrl+C to stop"
            )
        )
        try:
            run_listener(poll_interval=interval)
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("\nListener stopped."))
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f"Fatal: {exc}"))
            raise