import time
import math
import random
import logging
from datetime import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import EnergyDevice, EnergyListing, User

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [IOT] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Realistic energy curve helpers ───────────────────────────────────────────

def solar_output(hour: float, capacity_kw: float) -> float:
    """
    Simulates solar panel output based on time of day.
    Peak at solar noon (~13:00), zero at night.
    """
    if hour < 6 or hour > 20:
        return 0.0
    # Bell curve centered at 13:00
    peak  = capacity_kw * 0.95
    sigma = 3.5
    value = peak * math.exp(-((hour - 13) ** 2) / (2 * sigma ** 2))
    # Add weather noise ±15%
    noise = random.uniform(0.85, 1.15)
    return round(max(0.0, value * noise), 3)


def wind_output(capacity_kw: float) -> float:
    """
    Simulates wind turbine output.
    Wind is more random — uniform with occasional gusts.
    """
    base  = random.uniform(0.2, 0.8) * capacity_kw
    gust  = random.random() < 0.1   # 10% chance of gust
    if gust:
        base = min(capacity_kw, base * random.uniform(1.2, 1.5))
    return round(base, 3)


def battery_output(capacity_kw: float, hour: float) -> float:
    """
    Battery discharges during peak hours (morning + evening),
    charges midday when solar is high.
    """
    morning_peak = 7 <= hour <= 9
    evening_peak = 18 <= hour <= 22
    solar_peak   = 10 <= hour <= 15

    if solar_peak:
        # Charging — negative output
        return round(-random.uniform(0.3, 0.7) * capacity_kw, 3)
    elif morning_peak or evening_peak:
        return round(random.uniform(0.4, 0.9) * capacity_kw, 3)
    else:
        return round(random.uniform(0.0, 0.2) * capacity_kw, 3)


def household_consumption(hour: float) -> float:
    """
    Simulates household energy consumption curve.
    Peaks morning (7-9) and evening (18-22).
    """
    morning = 7 <= hour <= 9
    evening = 18 <= hour <= 22
    night   = hour < 6 or hour > 23

    if morning:
        base = random.uniform(1.2, 2.5)
    elif evening:
        base = random.uniform(1.8, 3.2)
    elif night:
        base = random.uniform(0.1, 0.4)
    else:
        base = random.uniform(0.5, 1.2)

    return round(base + random.uniform(-0.1, 0.1), 3)


def get_device_output(device) -> dict:
    """Generate realistic output for a device based on type and time."""
    now  = datetime.now()
    hour = now.hour + now.minute / 60.0

    if device.device_type == "solar":
        output = solar_output(hour, float(device.capacity_kw))
    elif device.device_type == "wind":
        output = wind_output(float(device.capacity_kw))
    elif device.device_type == "battery":
        output = battery_output(float(device.capacity_kw), hour)
    else:
        output = round(random.uniform(0, float(device.capacity_kw)) * 0.6, 3)

    # Surplus = output minus simulated consumption
    consumption = household_consumption(hour)
    surplus_kw  = round(max(0.0, output - consumption), 3)
    surplus_wh  = int(surplus_kw * 1000)   # convert to Wh

    return {
        "output_kw":     output,
        "consumption_kw": consumption,
        "surplus_kw":    surplus_kw,
        "surplus_wh":    surplus_wh,
        "hour":          round(hour, 2),
    }


# ── Auto-listing logic ────────────────────────────────────────────────────────

def maybe_create_listing(device, readings: dict, threshold_wh: int = 50):
    """
    If surplus exceeds threshold, automatically create a pending listing.
    Listing status is 'pending' — needs admin approval.
    """
    if readings["surplus_wh"] < threshold_wh:
        return None

    # Check if device already has an active/pending listing
    existing = EnergyListing.objects.filter(
        device=device,
        status__in=["active", "pending"],
    ).first()

    if existing:
        return None

    # Base price in wei: 0.001 ETH per Wh = 1_000_000_000_000 wei
    base_price = 1_000_000_000_000 + random.randint(-200_000_000_000, 200_000_000_000)

    listing = EnergyListing.objects.create(
        listing_id       = EnergyListing.objects.count() + 1000,
        producer         = device.owner,
        device           = device,
        energy_amount    = readings["surplus_wh"],
        base_price_per_unit = str(base_price),
        price_per_unit   = str(base_price),
        device_type      = device.device_type,
        status           = "pending",    # ← needs admin approval
        active           = False,        # ← not live until approved
        price_type       = "dynamic",
    )

    logger.info(
        f"AUTO-LISTED: {device.name} surplus "
        f"{readings['surplus_wh']} Wh → Listing #{listing.listing_id} [PENDING APPROVAL]"
    )
    return listing


class Command(BaseCommand):
    help = "Simulate IoT energy meter readings for all registered devices"

    def add_arguments(self, parser):
        parser.add_argument(
            "--interval",
            type=int,
            default=30,
            help="Reading interval in seconds (default: 30)",
        )
        parser.add_argument(
            "--auto-list",
            action="store_true",
            default=False,
            help="Auto-create listings when surplus detected",
        )
        parser.add_argument(
            "--threshold",
            type=int,
            default=50,
            help="Min surplus Wh to trigger auto-listing (default: 50)",
        )

    def handle(self, *args, **options):
        interval   = options["interval"]
        auto_list  = options["auto_list"]
        threshold  = options["threshold"]

        self.stdout.write(self.style.SUCCESS(
            f"⚡ IoT Simulator started "
            f"(interval={interval}s, auto_list={auto_list}, threshold={threshold}Wh)"
        ))
        self.stdout.write("Press Ctrl+C to stop\n")

        cycle = 0
        while True:
            cycle += 1
            devices = EnergyDevice.objects.filter(status="active")

            if not devices.exists():
                logger.warning("No active devices found. Waiting...")
                time.sleep(interval)
                continue

            self.stdout.write(
                f"\n── Cycle {cycle} | "
                f"{datetime.now().strftime('%H:%M:%S')} ──"
            )

            for device in devices:
                readings = get_device_output(device)

                # Update device current output
                device.current_output = readings["output_kw"]
                device.last_sync      = timezone.now()
                device.save(update_fields=["current_output", "last_sync"])

                # Log reading
                hour_str = f"{int(readings['hour']):02d}:{int((readings['hour']%1)*60):02d}"
                self.stdout.write(
                    f"  [{device.device_type.upper():<8}] {device.name:<20} "
                    f"Output: {readings['output_kw']:>6.3f} kW  "
                    f"Consumption: {readings['consumption_kw']:>5.3f} kW  "
                    f"Surplus: {readings['surplus_kw']:>6.3f} kW "
                    f"({readings['surplus_wh']} Wh)"
                )

                # Auto-listing
                if auto_list and readings["surplus_wh"] >= threshold:
                    listing = maybe_create_listing(device, readings, threshold)
                    if listing:
                        self.stdout.write(
                            self.style.WARNING(
                                f"    → Auto-listed {readings['surplus_wh']} Wh "
                                f"[PENDING ADMIN APPROVAL]"
                            )
                        )

            time.sleep(interval)