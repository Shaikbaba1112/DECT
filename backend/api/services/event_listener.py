import os
import time
import logging
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

logger           = logging.getLogger(__name__)
w3               = Web3(Web3.HTTPProvider(os.getenv("WEB3_PROVIDER_URL", "http://127.0.0.1:8545")))
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "")

FULL_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True,  "name": "id",               "type": "uint256"},
            {"indexed": True,  "name": "seller",           "type": "address"},
            {"indexed": False, "name": "energyAmount",     "type": "uint256"},
            {"indexed": False, "name": "basePricePerUnit", "type": "uint256"},
            {"indexed": False, "name": "deviceType",       "type": "string"},
        ],
        "name": "ListingCreated",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True,  "name": "listingId",     "type": "uint256"},
            {"indexed": True,  "name": "buyer",         "type": "address"},
            {"indexed": True,  "name": "seller",        "type": "address"},
            {"indexed": False, "name": "energyAmount",  "type": "uint256"},
            {"indexed": False, "name": "totalCost",     "type": "uint256"},
            {"indexed": False, "name": "multiplierUsed","type": "uint256"},
        ],
        "name": "EnergyPurchased",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True,  "name": "bidId",      "type": "uint256"},
            {"indexed": True,  "name": "listingId",  "type": "uint256"},
            {"indexed": True,  "name": "buyer",      "type": "address"},
            {"indexed": False, "name": "seller",     "type": "address"},
            {"indexed": False, "name": "totalCost",  "type": "uint256"},
        ],
        "name": "BidAccepted",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "id", "type": "uint256"},
        ],
        "name": "ListingCancelled",
        "type": "event",
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True,  "name": "id",    "type": "uint256"},
            {"indexed": False, "name": "amount","type": "uint256"},
        ],
        "name": "Withdrawn",
        "type": "event",
    },
]


def get_contract():
    return w3.eth.contract(
        address=Web3.to_checksum_address(CONTRACT_ADDRESS),
        abi=FULL_ABI,
    )


def handle_listing_created(event):
    from api.models import EnergyListing, User
    args = event["args"]
    listing, created = EnergyListing.objects.update_or_create(
        listing_id=args["id"],
        defaults={
            "base_price_per_unit": str(args["basePricePerUnit"]),
            "price_per_unit":      str(args["basePricePerUnit"]),
            "energy_amount":       args["energyAmount"],
            "device_type":         args.get("deviceType", "solar"),
            "active":              True,
            "status":              "active",
        },
    )
    # Link producer
    if not listing.producer:
        try:
            user = User.objects.get(wallet_address__iexact=args["seller"])
            listing.producer = user
            listing.save()
        except User.DoesNotExist:
            pass
    action = "Created" if created else "Updated"
    logger.info(f"[ListingCreated] {action} listing #{args['id']}")


def handle_energy_purchased(event):
    from api.models import EnergyListing, Transaction, User
    from api.services.wallet_service import credit_wallet
    from api.services.fraud_service import auto_flag_if_suspicious

    args    = event["args"]
    tx_hash = event["transactionHash"].hex()

    EnergyListing.objects.filter(listing_id=args["listingId"]).update(
        active=False, status="sold"
    )

    listing = EnergyListing.objects.filter(
        listing_id=args["listingId"]
    ).first()

    buyer_user  = None
    seller_user = None
    try:
        buyer_user = User.objects.get(wallet_address__iexact=args["buyer"])
    except User.DoesNotExist:
        pass
    try:
        seller_user = User.objects.get(wallet_address__iexact=args["seller"])
    except User.DoesNotExist:
        pass

    txn, created = Transaction.objects.get_or_create(
        tx_hash=tx_hash,
        defaults={
            "listing":         listing,
            "buyer":           buyer_user,
            "seller":          seller_user,
            "buyer_address":   args["buyer"],
            "seller_address":  args["seller"],
            "energy_amount":   args["energyAmount"],
            "total_cost":      str(args["totalCost"]),
            "block_number":    event["blockNumber"],
            "multiplier_used": args.get("multiplierUsed", 100),
        },
    )

    if created:
        # Credit seller wallet
        if seller_user:
            amount_tkn = int(args["totalCost"]) / 1e18
            credit_wallet(seller_user, amount_tkn, "earn", txn)

        auto_flag_if_suspicious(txn)
        logger.info(f"[EnergyPurchased] Tx {tx_hash[:12]}… listing #{args['listingId']}")


def handle_bid_accepted(event):
    from api.models import EnergyListing, Bid, Transaction, User
    from api.services.wallet_service import credit_wallet

    args    = event["args"]
    tx_hash = event["transactionHash"].hex()

    EnergyListing.objects.filter(
        listing_id=args["listingId"]
    ).update(active=False, status="sold")

    Bid.objects.filter(
        on_chain_bid_id=args["bidId"]
    ).update(status="accepted")

    listing = EnergyListing.objects.filter(
        listing_id=args["listingId"]
    ).first()

    seller_user = None
    try:
        seller_user = User.objects.get(
            wallet_address__iexact=args["seller"]
        )
    except User.DoesNotExist:
        pass

    txn, created = Transaction.objects.get_or_create(
        tx_hash=tx_hash,
        defaults={
            "listing":        listing,
            "seller":         seller_user,
            "seller_address": args["seller"],
            "buyer_address":  args["buyer"],
            "energy_amount":  listing.energy_amount if listing else 0,
            "total_cost":     str(args["totalCost"]),
            "block_number":   event["blockNumber"],
        },
    )

    if created and seller_user:
        amount_tkn = int(args["totalCost"]) / 1e18
        credit_wallet(seller_user, amount_tkn, "earn", txn)

    logger.info(f"[BidAccepted] Bid #{args['bidId']} listing #{args['listingId']}")


def handle_listing_cancelled(event):
    from api.models import EnergyListing
    args = event["args"]
    EnergyListing.objects.filter(listing_id=args["id"]).update(
        active=False, status="cancelled"
    )
    logger.info(f"[ListingCancelled] #{args['id']}")


def run_listener(poll_interval: int = 2):
    if not CONTRACT_ADDRESS:
        raise ValueError("CONTRACT_ADDRESS not set in .env")
    if not w3.is_connected():
        raise ConnectionError("Cannot connect to blockchain node.")

    contract   = get_contract()
    from_block = w3.eth.block_number

    logger.info(f"Listener started from block {from_block}")
    logger.info(f"Contract : {CONTRACT_ADDRESS}")

    while True:
        try:
            current = w3.eth.block_number
            if current >= from_block:
                for event in contract.events.ListingCreated.get_logs(
                    from_block=from_block, to_block=current
                ):
                    handle_listing_created(event)

                for event in contract.events.EnergyPurchased.get_logs(
                    from_block=from_block, to_block=current
                ):
                    handle_energy_purchased(event)

                for event in contract.events.BidAccepted.get_logs(
                    from_block=from_block, to_block=current
                ):
                    handle_bid_accepted(event)

                for event in contract.events.ListingCancelled.get_logs(
                    from_block=from_block, to_block=current
                ):
                    handle_listing_cancelled(event)

                from_block = current + 1

        except Exception as exc:
            logger.error(f"Listener error: {exc}", exc_info=True)
            time.sleep(poll_interval * 3)
            continue

        time.sleep(poll_interval)