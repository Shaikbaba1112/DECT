from decimal import Decimal
from ..models import CreditWallet, CreditTransaction


def credit_wallet(user, amount, txn_type, trade=None, description=""):
    """Add TKN to user wallet and record the transaction."""
    wallet, _ = CreditWallet.objects.get_or_create(user=user)
    amount     = Decimal(str(amount))

    wallet.balance     += amount
    wallet.total_earned += amount
    wallet.save()

    CreditTransaction.objects.create(
        wallet=wallet,
        type=txn_type,
        amount=amount,
        balance_after=wallet.balance,
        description=description or f"{txn_type.capitalize()} {amount} TKN",
        trade=trade,
    )
    return wallet


def debit_wallet(user, amount, txn_type, trade=None, description=""):
    """Remove TKN from user wallet and record the transaction."""
    wallet, _ = CreditWallet.objects.get_or_create(user=user)
    amount     = Decimal(str(amount))

    if wallet.balance < amount:
        raise ValueError("Insufficient wallet balance.")

    wallet.balance         -= amount
    wallet.total_withdrawn += amount
    wallet.save()

    CreditTransaction.objects.create(
        wallet=wallet,
        type=txn_type,
        amount=-amount,
        balance_after=wallet.balance,
        description=description or f"{txn_type.capitalize()} {amount} TKN",
        trade=trade,
    )
    return wallet