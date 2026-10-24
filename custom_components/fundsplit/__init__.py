"""FundSplit: Splitwise-style shared expenses for two people, in ZAR."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ServiceValidationError
import homeassistant.helpers.config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration

from .const import (
    CONF_MEMBERS,
    DOMAIN,
    PANEL_ELEMENT,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL,
    STATIC_URL,
)
from .ledger import SPLIT_MODES, LedgerError
from .manager import FundSplitManager
from .websocket import async_register_websocket

PLATFORMS = ["sensor"]
FRONTEND_DIR = Path(__file__).parent / "frontend"

ADD_EXPENSE_SCHEMA = vol.Schema(
    {
        vol.Required("description"): cv.string,
        vol.Required("amount"): vol.Coerce(float),
        vol.Required("paid_by"): cv.string,
        vol.Optional("split_mode", default="equal"): vol.In(SPLIT_MODES),
        vol.Optional("split_values"): dict,
        vol.Optional("date"): cv.string,
        vol.Optional("category"): cv.string,
    }
)
SETTLE_SCHEMA = vol.Schema(
    {
        vol.Optional("from"): cv.string,
        vol.Optional("to"): cv.string,
        vol.Optional("amount"): vol.Coerce(float),
        vol.Optional("date"): cv.string,
    }
)
DELETE_SCHEMA = vol.Schema({vol.Required("id"): cv.string})
UPDATE_EXPENSE_SCHEMA = ADD_EXPENSE_SCHEMA.extend({vol.Required("id"): cv.string})


def get_manager(hass: HomeAssistant) -> FundSplitManager:
    """Return the (single) active manager."""
    managers = hass.data.get(DOMAIN, {})
    if not managers:
        raise ServiceValidationError("FundSplit is not set up")
    return next(iter(managers.values()))


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register services and the websocket API once per HA run."""
    hass.data.setdefault(DOMAIN, {})
    async_register_websocket(hass)

    async def _run(coro: Any) -> Any:
        try:
            return await coro
        except LedgerError as err:
            raise ServiceValidationError(str(err)) from err

    async def add_expense(call: ServiceCall) -> None:
        d = call.data
        manager = get_manager(hass)
        await _run(
            manager.async_add_expense(
                description=d["description"],
                amount=d["amount"],
                paid_by=d["paid_by"],
                mode=d["split_mode"],
                values=d.get("split_values"),
                date=d.get("date"),
                category=d.get("category"),
                created_by=await manager.async_actor_name(call.context.user_id),
            )
        )

    async def update_expense(call: ServiceCall) -> None:
        d = call.data
        await _run(
            get_manager(hass).async_update_expense(
                item_id=d["id"],
                description=d["description"],
                amount=d["amount"],
                paid_by=d["paid_by"],
                mode=d["split_mode"],
                values=d.get("split_values"),
                date=d.get("date"),
                category=d.get("category"),
            )
        )

    async def settle_up(call: ServiceCall) -> None:
        d = call.data
        manager = get_manager(hass)
        actor = await manager.async_actor_name(call.context.user_id)
        if "amount" not in d:
            await _run(manager.async_settle_all(created_by=actor))
            return
        if "from" not in d or "to" not in d:
            raise ServiceValidationError("'from' and 'to' are required with 'amount'")
        await _run(
            manager.async_add_settlement(
                from_member=d["from"],
                to_member=d["to"],
                amount=d["amount"],
                date=d.get("date"),
                created_by=actor,
            )
        )

    async def delete_item(call: ServiceCall) -> None:
        await _run(get_manager(hass).async_delete(call.data["id"]))

    hass.services.async_register(DOMAIN, "add_expense", add_expense, ADD_EXPENSE_SCHEMA)
    hass.services.async_register(
        DOMAIN, "update_expense", update_expense, UPDATE_EXPENSE_SCHEMA
    )
    hass.services.async_register(DOMAIN, "settle_up", settle_up, SETTLE_SCHEMA)
    hass.services.async_register(DOMAIN, "delete_item", delete_item, DELETE_SCHEMA)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    manager = FundSplitManager(hass, entry.entry_id, entry.data[CONF_MEMBERS])
    await manager.async_load()
    hass.data[DOMAIN][entry.entry_id] = manager

    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_URL, str(FRONTEND_DIR), cache_headers=False)]
    )
    # The version in the URL makes browsers fetch the new script after an update
    # instead of running a cached copy against the new backend.
    version = (await async_get_integration(hass, DOMAIN)).version
    await panel_custom.async_register_panel(
        hass,
        webcomponent_name=PANEL_ELEMENT,
        frontend_url_path=PANEL_URL,
        module_url=f"{STATIC_URL}/fundsplit-panel.js?v={version}",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        require_admin=False,
        config={},
    )

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if not await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        return False
    hass.data[DOMAIN].pop(entry.entry_id, None)
    frontend.async_remove_panel(hass, PANEL_URL)
    return True
