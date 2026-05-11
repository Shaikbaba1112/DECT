import os
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

w3               = Web3(Web3.HTTPProvider(os.getenv("WEB3_PROVIDER_URL", "http://127.0.0.1:8545")))
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "")
CREDIT_ADDRESS   = os.getenv("DECT_CREDIT_ADDRESS", "")

MARKET_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "_energyAmount",     "type": "uint256"},
            {"internalType": "uint256", "name": "_basePricePerUnit", "type": "uint256"},
            {"internalType": "string",  "name": "_deviceType",       "type": "string"},
        ],
        "name": "createListing",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "_listingId", "type": "uint256"}],
        "name": "getListing",
        "outputs": [
            {
                "components": [
                    {"internalType": "uint256", "name": "id",               "type": "uint256"},
                    {"internalType": "address", "name": "seller",           "type": "address"},
                    {"internalType": "uint256", "name": "energyAmount",     "type": "uint256"},
                    {"internalType": "uint256", "name": "basePricePerUnit", "type": "uint256"},
                    {"internalType": "bool",    "name": "active",           "type": "bool"},
                    {"internalType": "uint256", "name": "createdAt",        "type": "uint256"},
                    {"internalType": "string",  "name": "deviceType",       "type": "string"},
                ],
                "internalType": "struct EnergyMarket.EnergyListing",
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "_listingId", "type": "uint256"}],
        "name": "getDynamicPrice",
        "outputs": [
            {"internalType": "uint256", "name": "dynamicPricePerUnit", "type": "uint256"},
            {"internalType": "uint256", "name": "totalCost",           "type": "uint256"},
            {"internalType": "uint256", "name": "multiplier",          "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "getMarketStats",
        "outputs": [
            {"internalType": "uint256", "name": "supply",        "type": "uint256"},
            {"internalType": "uint256", "name": "demand",        "type": "uint256"},
            {"internalType": "uint256", "name": "multiplier",    "type": "uint256"},
            {"internalType": "uint256", "name": "totalListings", "type": "uint256"},
            {"internalType": "uint256", "name": "allPurchases",  "type": "uint256"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "nextListingId",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "ethBalances",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

CREDIT_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "_account", "type": "address"}],
        "name": "getBalance",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


def get_contract():
    if not CONTRACT_ADDRESS:
        raise ValueError("CONTRACT_ADDRESS not set in .env")
    return w3.eth.contract(
        address=Web3.to_checksum_address(CONTRACT_ADDRESS),
        abi=MARKET_ABI,
    )


def get_credit_contract():
    if not CREDIT_ADDRESS:
        raise ValueError("DECT_CREDIT_ADDRESS not set in .env")
    return w3.eth.contract(
        address=Web3.to_checksum_address(CREDIT_ADDRESS),
        abi=CREDIT_ABI,
    )


def is_connected():
    return w3.is_connected()


def get_listing_from_chain(listing_id: int) -> dict:
    contract = get_contract()
    result   = contract.functions.getListing(listing_id).call()
    return {
        "id":                 result[0],
        "seller":             result[1],
        "energy_amount":      result[2],
        "base_price_per_unit": str(result[3]),
        "active":             result[4],
        "device_type":        result[6] if len(result) > 6 else "solar",
    }


def get_dynamic_price(listing_id: int) -> dict:
    contract = get_contract()
    result   = contract.functions.getDynamicPrice(listing_id).call()
    return {
        "dynamic_price_per_unit": str(result[0]),
        "total_cost":             str(result[1]),
        "multiplier":             result[2],
    }


def get_market_stats() -> dict:
    contract = get_contract()
    result   = contract.functions.getMarketStats().call()
    return {
        "supply":         result[0],
        "demand":         result[1],
        "multiplier":     result[2],
        "total_listings": result[3],
        "all_purchases":  result[4],
    }


def get_tkn_balance(address: str) -> int:
    contract = get_credit_contract()
    return contract.functions.getBalance(
        Web3.to_checksum_address(address)
    ).call()


def get_eth_balance(address: str) -> int:
    contract = get_contract()
    return contract.functions.ethBalances(
        Web3.to_checksum_address(address)
    ).call()