"""Constants for FundSplit."""

DOMAIN = "fundsplit"
CURRENCY = "ZAR"

CONF_MEMBERS = "members"
CONF_NAME_1 = "name_1"
CONF_PERSON_1 = "person_1"
CONF_NAME_2 = "name_2"
CONF_PERSON_2 = "person_2"

STORAGE_VERSION = 1

SIGNAL_UPDATED = f"{DOMAIN}_updated"

EVENT_EXPENSE_ADDED = f"{DOMAIN}_expense_added"
EVENT_SETTLEMENT_ADDED = f"{DOMAIN}_settlement_added"
EVENT_ITEM_DELETED = f"{DOMAIN}_item_deleted"

PANEL_URL = "fundsplit"
PANEL_TITLE = "FundSplit"
PANEL_ICON = "mdi:call-split"
PANEL_ELEMENT = "fundsplit-panel"
STATIC_URL = "/fundsplit_static"

CONF_AI_TASK_ENTITY = "ai_task_entity"
MAX_RECEIPT_BYTES = 6 * 1024 * 1024
RECEIPT_DIR = "fundsplit_receipts"
EVENT_ITEM_UPDATED = f"{DOMAIN}_item_updated"
