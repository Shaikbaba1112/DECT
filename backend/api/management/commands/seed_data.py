from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from api.models import (
    User, EnergyDevice, EnergyListing,
    Bid, Transaction, CreditWallet,
    AutoTradeSettings, FraudFlag,
)
import uuid
import secrets


class Command(BaseCommand):
    help = "Seed dummy data for testing"

    def generate_wallet(self):
        return "0x" + secrets.token_hex(20)

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding dummy data...")

        # ── Users ──────────────────────────────────────────────────────────
        admin, _ = User.objects.get_or_create(
            username="dectadmin",
            defaults={
                "email":       "admin@dect.com",
                "role":        "admin",
                "is_staff":    True,
                "is_verified": True,
            }
        )
        admin.set_password("Admin1234!")
        admin.save()
        CreditWallet.objects.get_or_create(user=admin)
        AutoTradeSettings.objects.get_or_create(user=admin)

        alice, _ = User.objects.get_or_create(
            username="alice",
            defaults={
                "email":          "alice@dect.com",
                "role":           "producer",
                "is_verified":    True,
                "wallet_address": self.generate_wallet(),
            }
        )
        alice.set_password("Alice1234!")
        alice.save()
        alice_wallet, _ = CreditWallet.objects.get_or_create(user=alice)
        alice_wallet.balance       = 142.5
        alice_wallet.total_earned  = 280.0
        alice_wallet.total_withdrawn = 137.5
        alice_wallet.save()
        AutoTradeSettings.objects.get_or_create(user=alice)

        bob, _ = User.objects.get_or_create(
            username="bob",
            defaults={
                "email":          "bob@dect.com",
                "role":           "consumer",
                "is_verified":    True,
                "wallet_address": self.generate_wallet(),
            }
        )
        bob.set_password("Bob12345!")
        bob.save()
        bob_wallet, _ = CreditWallet.objects.get_or_create(user=bob)
        bob_wallet.balance      = 55.2
        bob_wallet.total_earned = 55.2
        bob_wallet.save()
        AutoTradeSettings.objects.get_or_create(user=bob)

        carol, _ = User.objects.get_or_create(
            username="carol",
            defaults={
                "email":          "carol@dect.com",
                "role":           "producer",
                "is_verified":    True,
                "wallet_address": self.generate_wallet(),
            }
        )
        carol.set_password("Carol1234!")
        carol.save()
        CreditWallet.objects.get_or_create(user=carol)
        AutoTradeSettings.objects.get_or_create(user=carol)

        self.stdout.write("✓ Users created")

        # ── Devices ────────────────────────────────────────────────────────
        dev1, _ = EnergyDevice.objects.get_or_create(
            owner=alice, smart_meter_id="SM-001",
            defaults={
                "name":           "Solar Panel A",
                "device_type":    "solar",
                "capacity_kw":    5.0,
                "current_output": 3.8,
                "status":         "active",
            }
        )

        dev2, _ = EnergyDevice.objects.get_or_create(
            owner=alice, smart_meter_id="SM-002",
            defaults={
                "name":           "Battery Bank 1",
                "device_type":    "battery",
                "capacity_kw":    10.0,
                "current_output": 7.2,
                "status":         "charging",
            }
        )

        dev3, _ = EnergyDevice.objects.get_or_create(
            owner=carol, smart_meter_id="SM-003",
            defaults={
                "name":           "Wind Turbine W1",
                "device_type":    "wind",
                "capacity_kw":    8.0,
                "current_output": 5.5,
                "status":         "active",
            }
        )

        self.stdout.write("✓ Devices created")

        # ── Listings ───────────────────────────────────────────────────────
        listings_data = [
            {
                "listing_id": 1000,
                "producer":            alice,
                "device":              dev1,
                "energy_amount":       100,
                "base_price_per_unit": "1000",
                "price_per_unit":      "5000",
                "device_type":         "solar",
                "status":              "active",
                "active":              True,
            },
            {
                "listing_id": 1001,
                "producer":            alice,
                "device":              dev2,
                "energy_amount":       250,
                "base_price_per_unit": "20000",
                "price_per_unit":      "1000",
                "device_type":         "battery",
                "status":              "active",
                "active":              True,
            },
            {
                "listing_id": 1002,
                "producer":            carol,
                "device":              dev3,
                "energy_amount":       500,
                "base_price_per_unit": "15000",
                "price_per_unit":      "75000",
                "device_type":         "wind",
                "status":              "active",
                "active":              True,
            },
            {
                "listing_id": 1003,
                "producer":            alice,
                "device":              dev1,
                "energy_amount":       200,
                "base_price_per_unit": "1000",
                "price_per_unit":      "1000",
                "device_type":         "solar",
                "status":              "sold",
                "active":              False,
            },
            {
                "listing_id": 1004,
                "producer":            alice,
                "device":              dev2,
                "energy_amount":       300,
                "base_price_per_unit": "20000",
                "price_per_unit":      "20000",
                "device_type":         "battery",
                "status":              "cancelled",
                "active":              False,
            },
        ]

        listing_objs = []
        for d in listings_data:
            l = EnergyListing.objects.create(**d)
            
            listing_objs.append(l)

        self.stdout.write("✓ Listings created")

        # ── Transactions ───────────────────────────────────────────────────
        txns_data = [
            {
                "tx_hash":        "0xabc100001",
                "listing":        listing_objs[3],
                "buyer":          bob,
                "seller":         alice,
                "buyer_address":  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
                "seller_address": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
                "energy_amount":  200,
                "total_cost":     "2000000",
                "multiplier_used": 100,
                "block_number":   42,
            },
            {
                "tx_hash":        "0xabc2000002",
                "listing":        listing_objs[3],
                "buyer":          bob,
                "seller":         alice,
                "buyer_address":  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
                "seller_address": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
                "energy_amount":  150,
                "total_cost":     "3000000",
                "multiplier_used": 150,
                "block_number":   55,
            },
        ]

        tx_objs = []
        for d in txns_data:
            t, _ = Transaction.objects.get_or_create(
                tx_hash=d["tx_hash"], defaults=d
            )
            tx_objs.append(t)

        self.stdout.write("✓ Transactions created")

        # ── Bids ───────────────────────────────────────────────────────────
        bids_data = [
            {
                "listing":               listing_objs[0],
                "buyer":                 bob,
                "offered_price_per_unit":"8000",
                "energy_amount":         100,
                "status":                "pending",
                "on_chain_bid_id":       0,
            },
            {
                "listing":               listing_objs[1],
                "buyer":                 bob,
                "offered_price_per_unit":"18000",
                "energy_amount":         250,
                "status":                "countered",
                "counter_price":         "20000",
                "on_chain_bid_id":       1,
            },
            {
                "listing":               listing_objs[2],
                "buyer":                 bob,
                "offered_price_per_unit":"12000",
                "energy_amount":         500,
                "status":                "rejected",
                "on_chain_bid_id":       2,
            },
            {
                "listing":               listing_objs[3],
                "buyer":                 bob,
                "offered_price_per_unit":"1000",
                "energy_amount":         200,
                "status":                "accepted",
                "on_chain_bid_id":       3,
            },
        ]

        for d in bids_data:
            Bid.objects.get_or_create(
                listing=d["listing"],
                buyer=d["buyer"],
                on_chain_bid_id=d.get("on_chain_bid_id"),
                defaults=d,
            )

        self.stdout.write("✓ Bids created")

        # ── Fraud flag ─────────────────────────────────────────────────────
        if tx_objs:
            FraudFlag.objects.get_or_create(
                transaction=tx_objs[0],
                defaults={
                    "wallet_address": "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
                    "risk_score":     72,
                    "reason":         "Unusual volume spike detected",
                    "flagged_by":     "system",
                    "status":         "open",
                }
            )

        self.stdout.write("✓ Fraud flag created")

        self.stdout.write(self.style.SUCCESS("""
✅ Seed complete!

Login credentials:
  Admin:    dectadmin / Admin1234!
  Producer: alice     / Alice1234!
  Consumer: bob       / Bob12345!
  Producer: carol     / Carol1234!
""")) 