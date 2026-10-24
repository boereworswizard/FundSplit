"""WebSocket API used by the FundSplit sidebar panel."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import CONF_AI_TASK_ENTITY, DOMAIN
from .ledger import SPLIT_MODES, LedgerError
from .manager import FundSplitManager
from .receipt import async_scan_receipt


def _manager(hass: HomeAssistant) -> FundSplitManager | None:
    managers = hass.data.get(DOMAIN, {})
    return next(iter(managers.values()), None)


def _wrap(handler):
    """Turn LedgerError / missing setup into websocket errors."""

    async def wrapper(hass: HomeAssistant, connection, msg: dict[str, Any]) -> None:
        manager = _manager(hass)
        if manager is None:
            connection.send_error(msg["id"], "not_ready", "FundSplit is not set up")
            return
        try:
            actor = await manager.async_actor_name(connection.user.id)
            result = await handler(manager, {**msg, "_actor": actor})
        except LedgerError as err:
            connection.send_error(msg["id"], "invalid", str(err))
            return
        connection.send_result(msg["id"], result)

    return wrapper


@callback
def async_register_websocket(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_state)
    websocket_api.async_register_command(hass, ws_add_expense)
    websocket_api.async_register_command(hass, ws_settle)
    websocket_api.async_register_command(hass, ws_delete)
    websocket_api.async_register_command(hass, ws_scan_receipt)
    websocket_api.async_register_command(hass, ws_update_expense)
    websocket_api.async_register_command(hass, ws_update_settlement)


@websocket_api.websocket_command({vol.Required("type"): "fundsplit/state"})
@websocket_api.async_response
@_wrap
async def ws_state(manager: FundSplitManager, msg: dict[str, Any]) -> Any:
    return manager.snapshot()


@websocket_api.websocket_command(
    {
        vol.Required("type"): "fundsplit/add_expense",
        vol.Required("description"): str,
        vol.Required("amount"): vol.Coerce(float),
        vol.Required("paid_by"): str,
        vol.Optional("split_mode", default="equal"): vol.In(SPLIT_MODES),
        vol.Optional("split_values"): dict,
        vol.Optional("date"): str,
        vol.Optional("category"): vol.Any(str, None),
    }
)
@websocket_api.async_response
@_wrap
async def ws_add_expense(manager: FundSplitManager, msg: dict[str, Any]) -> Any:
    await manager.async_add_expense(
        created_by=msg["_actor"],
        description=msg["description"],
        amount=msg["amount"],
        paid_by=msg["paid_by"],
        mode=msg["split_mode"],
        values=msg.get("split_values"),
        date=msg.get("date"),
        category=msg.get("category"),
    )
    return manager.snapshot()


@websocket_api.websocket_command(
    {
        vol.Required("type"): "fundsplit/settle",
        vol.Optional("from"): str,
        vol.Optional("to"): str,
        vol.Optional("amount"): vol.Coerce(float),
        vol.Optional("date"): str,
    }
)
@websocket_api.async_response
@_wrap
async def ws_settle(manager: FundSplitManager, msg: dict[str, Any]) -> Any:
    if "amount" in msg and "from" in msg and "to" in msg:
        await manager.async_add_settlement(
            from_member=msg["from"],
            to_member=msg["to"],
            amount=msg["amount"],
            date=msg.get("date"),
            created_by=msg["_actor"],
        )
    else:
        await manager.async_settle_all(created_by=msg["_actor"])
    return manager.snapshot()


@websocket_api.websocket_command(
    {vol.Required("type"): "fundsplit/delete", vol.Required("item_id"): str}
)
@websocket_api.async_response
@_wrap
async def ws_delete(manager: FundSplitManager, msg: dict[str, Any]) -> Any:
    await manager.async_delete(msg["item_id"])
    return manager.snapshot()


@websocket_api.websocket_command(
    {
        vol.Required("type"): "fundsplit/scan_receipt",
        vol.Required("image"): str,
        vol.Required("mime_type"): str,
    }
)
@websocket_api.async_response
@_wrap
async def ws_scan_receipt(manager: FundSplitManager, msg: dict[str, Any]) -> Any:
    entry = manager.hass.config_entries.async_get_entry(manager.entry_id)
    entity_id = entry.options.get(CONF_AI_TASK_ENTITY) if entry else None
    return await async_scan_receipt(
        manager.hass, msg["image"], msg["mime_type"], entity_id
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "fundsplit/update_expense",
        vol.Required("item_id"): str,
        vol.Required("description"): str,
        vol.Required("amount"): vol.Coerce(float),
        vol.Required("paid_by"): str,
        vol.Optional("split_mode", default="equal"): vol.In(SPLIT_MODES),
        vol.Optional("split_values"): dict,
        vol.Optional("date"): str,
        vol.Optional("category"): vol.Any(str, None),
    }
)
@websocket_api.async_response
@_wrap
async def ws_update_expense(manager: FundSplitManager, msg: dict[str, Any]) -> Any:
    await manager.async_update_expense(
        item_id=msg["item_id"],
        description=msg["description"],
        amount=msg["amount"],
        paid_by=msg["paid_by"],
        mode=msg["split_mode"],
        values=msg.get("split_values"),
        date=msg.get("date"),
        category=msg.get("category"),
    )
    return manager.snapshot()


@websocket_api.websocket_command(
    {
        vol.Required("type"): "fundsplit/update_settlement",
        vol.Required("item_id"): str,
        vol.Required("from"): str,
        vol.Required("to"): str,
        vol.Required("amount"): vol.Coerce(float),
        vol.Optional("date"): str,
    }
)
@websocket_api.async_response
@_wrap
async def ws_update_settlement(manager: FundSplitManager, msg: dict[str, Any]) -> Any:
    await manager.async_update_settlement(
        item_id=msg["item_id"],
        from_member=msg["from"],
        to_member=msg["to"],
        amount=msg["amount"],
        date=msg.get("date"),
    )
    return manager.snapshot()
