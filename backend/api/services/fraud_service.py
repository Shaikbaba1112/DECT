from ..models import FraudFlag, Transaction


def calculate_risk_score(transaction) -> int:
    """
    Calculate fraud risk score 0-100.
    Higher = more suspicious.
    """
    score = 0

    # Same buyer and seller address
    if transaction.buyer_address.lower() == transaction.seller_address.lower():
        score += 80

    # Unusually large transaction (> 10 ETH)
    try:
        if int(transaction.total_cost) > 10 * 10**18:
            score += 30
    except (ValueError, TypeError):
        pass

    # Buyer has made 5+ transactions in last hour
    from django.utils import timezone
    from datetime import timedelta

    recent_count = Transaction.objects.filter(
        buyer_address__iexact=transaction.buyer_address,
        timestamp__gte=timezone.now() - timedelta(hours=1),
    ).count()

    if recent_count > 5:
        score += 20
    if recent_count > 10:
        score += 20

    return min(score, 100)


def auto_flag_if_suspicious(transaction):
    """Auto-create a FraudFlag if risk score is high enough."""
    score = calculate_risk_score(transaction)

    if score >= 50:
        reason = []
        if transaction.buyer_address.lower() == transaction.seller_address.lower():
            reason.append("Self-purchase detected")
        if score >= 80:
            reason.append("Unusually high risk score")

        FraudFlag.objects.get_or_create(
            transaction=transaction,
            defaults={
                "wallet_address": transaction.buyer_address,
                "risk_score":     score,
                "reason":         " | ".join(reason) or "Auto-flagged by system",
                "flagged_by":     "system",
                "status":         "open",
            },
        )