from django.urls import path
from .views import (
    HealthCheckView,
    # Devices
    DeviceListView,
    DeviceRegisterView,
    DeviceDetailView,
    # Listings
    MarketListingsView,
    ProducerListingsView,
    ListingCreateView,
    ListingDetailView,
    ListingCancelView,
    ListingPauseAllView,
    ListingSyncView,
    # Bids
    PlaceBidView,
    ConsumerBidsView,
    ProducerBidsView,
    BidRespondView,
    # Transactions
    TradeListView,
    TradeDetailView,
    TransactionSyncView,
    # Wallet
    WalletView,
    WalletTransactionsView,
    WalletWithdrawView,
    WalletTopUpView,
    WalletClaimRewardsView,
    # Auto-trade + Alerts
    AutoTradeView,
    PriceAlertListView,
    PriceAlertDetailView,
    # Market
    MarketStatsView,
    MarketPriceView,
    MarketHistoryView,
    ListenerStatusView,
    # Stats
    ProducerStatsView,
    ConsumerStatsView,
)
from .admin_views import (

    AdminOverviewView,
    AdminUsersView,
    AdminUserDetailView,
    AdminUserSuspendView,
    AdminApproveProducerView,
    AdminPendingApprovalsView,
    AdminAllListingsView,
    AdminAllTransactionsView,
    AdminParticipantsView,
    AdminFraudListView,
    AdminFraudReviewView,
    AdminFraudBanView,
    AdminSystemPauseView,
    AdminSystemResumeView,
    AdminSystemStatusView,
    AdminAuditLogView,
    AdminBroadcastView,
    ActiveBroadcastView,
    AdminPricingConfigView,
    AdminListingApprovalsView,
    AdminListingReviewView,
    AdminListingStatsView,
    
)

urlpatterns = [

    # ── Health ────────────────────────────────────────────────────────────
    path("health/", HealthCheckView.as_view(), name="health"),

    # ── Devices ───────────────────────────────────────────────────────────
    path("producer/devices/",              DeviceListView.as_view(),     name="device-list"),
    path("producer/devices/register/",     DeviceRegisterView.as_view(), name="device-register"),
    path("producer/devices/<int:pk>/",     DeviceDetailView.as_view(),   name="device-detail"),

    # ── Listings ──────────────────────────────────────────────────────────
    path("market/listings/",               MarketListingsView.as_view(),   name="market-listings"),
    path("producer/listings/",             ProducerListingsView.as_view(), name="producer-listings"),
    path("producer/listings/create/",      ListingCreateView.as_view(),    name="listing-create"),
    path("producer/listings/pause-all/",   ListingPauseAllView.as_view(),  name="listing-pause-all"),
    path("producer/listings/<int:pk>/",    ListingDetailView.as_view(),    name="listing-detail"),
    path("producer/listings/<int:pk>/cancel/", ListingCancelView.as_view(), name="listing-cancel"),
    path("listings/sync/",                 ListingSyncView.as_view(),      name="listing-sync"),

    # ── Bids ──────────────────────────────────────────────────────────────
    path("market/bid/",                    PlaceBidView.as_view(),      name="bid-place"),
    path("consumer/bids/",                 ConsumerBidsView.as_view(),  name="consumer-bids"),
    path("producer/bids/",                 ProducerBidsView.as_view(),  name="producer-bids"),
    path("producer/bids/<int:pk>/respond/",BidRespondView.as_view(),    name="bid-respond"),

    # ── Transactions ──────────────────────────────────────────────────────
    path("trades/",                        TradeListView.as_view(),      name="trade-list"),
    path("trades/<int:pk>/",               TradeDetailView.as_view(),    name="trade-detail"),
    path("trades/sync/",                   TransactionSyncView.as_view(),name="transaction-sync"),

    # ── Wallet ────────────────────────────────────────────────────────────
    path("wallet/",                        WalletView.as_view(),              name="wallet"),
    path("wallet/transactions/",           WalletTransactionsView.as_view(),  name="wallet-transactions"),
    path("wallet/withdraw/",               WalletWithdrawView.as_view(),      name="wallet-withdraw"),
    path("wallet/topup/",                  WalletTopUpView.as_view(),         name="wallet-topup"),
    path("wallet/claim-rewards/",          WalletClaimRewardsView.as_view(),  name="wallet-claim"),

    # ── Settings ──────────────────────────────────────────────────────────
    path("settings/auto-trade/",           AutoTradeView.as_view(),        name="auto-trade"),
    path("settings/alerts/",               PriceAlertListView.as_view(),   name="price-alerts"),
    path("settings/alerts/<int:pk>/",      PriceAlertDetailView.as_view(), name="price-alert-detail"),

    # ── Market ────────────────────────────────────────────────────────────
    path("market/stats/",                  MarketStatsView.as_view(),     name="market-stats"),
    path("market/price/",                  MarketPriceView.as_view(),     name="market-price"),
    path("market/history/",                MarketHistoryView.as_view(),   name="market-history"),
    path("listener/status/",               ListenerStatusView.as_view(),  name="listener-status"),

    # ── Producer Stats ────────────────────────────────────────────────────
    path("producer/stats/",                ProducerStatsView.as_view(),   name="producer-stats"),
    path("consumer/stats/",                ConsumerStatsView.as_view(),   name="consumer-stats"),

    # ── Broadcasts (public for dashboards) ────────────────────────────────
    path("broadcasts/active/",             ActiveBroadcastView.as_view(), name="broadcasts-active"),

    # ── Admin ─────────────────────────────────────────────────────────────
    path("admin-api/overview/",            AdminOverviewView.as_view(),         name="admin-overview"),
    path("admin-api/users/",               AdminUsersView.as_view(),            name="admin-users"),
    path("admin-api/users/<str:pk>/",      AdminUserDetailView.as_view(),       name="admin-user-detail"),
    path("admin-api/users/<str:pk>/suspend/",AdminUserSuspendView.as_view(),    name="admin-user-suspend"),
    path("admin-api/users/<str:pk>/approve/",AdminApproveProducerView.as_view(),name="admin-user-approve"),
    path("admin-api/approvals/",           AdminPendingApprovalsView.as_view(), name="admin-approvals"),
    path("admin-api/listings/",            AdminAllListingsView.as_view(),      name="admin-listings"),
    path("admin-api/transactions/",        AdminAllTransactionsView.as_view(),  name="admin-transactions"),
    path("admin-api/participants/",        AdminParticipantsView.as_view(),     name="admin-participants"),
    path("admin-api/fraud/",               AdminFraudListView.as_view(),        name="admin-fraud"),
    path("admin-api/fraud/<int:pk>/review/",AdminFraudReviewView.as_view(),     name="admin-fraud-review"),
    path("admin-api/fraud/<int:pk>/ban/",  AdminFraudBanView.as_view(),         name="admin-fraud-ban"),
    path("admin-api/system/pause/",        AdminSystemPauseView.as_view(),      name="admin-pause"),
    path("admin-api/system/resume/",       AdminSystemResumeView.as_view(),     name="admin-resume"),
    path("admin-api/system/status/",       AdminSystemStatusView.as_view(),     name="admin-status"),
    path("admin-api/audit-logs/",          AdminAuditLogView.as_view(),         name="admin-audit"),
    path("admin-api/broadcast/",           AdminBroadcastView.as_view(),        name="admin-broadcast"),
    path("admin-api/pricing-config/",      AdminPricingConfigView.as_view(),    name="admin-pricing"),


    path("admin-api/listing-approvals/",AdminListingApprovalsView.as_view(),name="admin-listing-approvals"),
    path("admin-api/listing-approvals/<int:pk>/review/",AdminListingReviewView.as_view(), name="admin-listing-review"),
    path("admin-api/listing-stats/",AdminListingStatsView.as_view(), name="admin-listing-stats"),

]