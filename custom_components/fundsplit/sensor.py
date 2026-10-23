"""Sensors exposing FundSplit balances and spend."""

from __future__ import annotations

from datetime import date
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CURRENCY, DOMAIN, SIGNAL_UPDATED
from .manager import FundSplitManager


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    manager: FundSplitManager = hass.data[DOMAIN][entry.entry_id]
    entities: list[_Base] = [
        BalanceSensor(manager, member["id"]) for member in manager.ledger.members
    ]
    entities += [OutstandingSensor(manager), TotalSpendSensor(manager), MonthSpendSensor(manager)]
    async_add_entities(entities)


class _Base(SensorEntity):
    _attr_should_poll = False
    _attr_has_entity_name = True
    _attr_device_class = SensorDeviceClass.MONETARY
    _attr_native_unit_of_measurement = CURRENCY
    _attr_suggested_display_precision = 2

    def __init__(self, manager: FundSplitManager, key: str) -> None:
        self._manager = manager
        self._attr_unique_id = f"{manager.entry_id}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, manager.entry_id)}, name="FundSplit"
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, f"{SIGNAL_UPDATED}_{self._manager.entry_id}", self._refresh
            )
        )

    @callback
    def _refresh(self) -> None:
        self.async_write_ha_state()

    def _name(self, member_id: str) -> str:
        return self._manager.ledger.member_name(member_id)


class BalanceSensor(_Base):
    """Net balance for one member (positive = owed money, negative = owes)."""

    def __init__(self, manager: FundSplitManager, member_id: str) -> None:
        super().__init__(manager, f"balance_{member_id}")
        self._member_id = member_id
        self._attr_name = f"{self._name(member_id)} balance"

    @property
    def native_value(self) -> float:
        return self._manager.ledger.balances()[self._member_id] / 100

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        mine = self._member_id
        owes = [
            {"to": self._name(p["to"]), "amount": p["amount"] / 100}
            for p in self._manager.ledger.simplify()
            if p["from"] == mine
        ]
        owed = [
            {"from": self._name(p["from"]), "amount": p["amount"] / 100}
            for p in self._manager.ledger.simplify()
            if p["to"] == mine
        ]
        return {"owes": owes, "owed_by": owed}


class OutstandingSensor(_Base):
    """How much is outstanding between the two people, and who pays whom."""

    _attr_name = "Outstanding"

    def __init__(self, manager: FundSplitManager) -> None:
        super().__init__(manager, "outstanding")

    @property
    def native_value(self) -> float:
        return sum(p["amount"] for p in self._manager.ledger.simplify()) / 100

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        payments = self._manager.ledger.simplify()
        if not payments:
            return {"summary": "All settled up", "debtor": None, "creditor": None}
        pay = payments[0]
        debtor, creditor = self._name(pay["from"]), self._name(pay["to"])
        return {
            "summary": f"{debtor} owes {creditor} R{pay['amount'] / 100:,.2f}",
            "debtor": debtor,
            "creditor": creditor,
        }


class TotalSpendSensor(_Base):
    _attr_name = "Total spend"

    def __init__(self, manager: FundSplitManager) -> None:
        super().__init__(manager, "total_spend")

    @property
    def native_value(self) -> float:
        return self._manager.ledger.total_spend() / 100


class MonthSpendSensor(_Base):
    _attr_name = "Spend this month"

    def __init__(self, manager: FundSplitManager) -> None:
        super().__init__(manager, "month_spend")

    @property
    def native_value(self) -> float:
        month = date.today().strftime("%Y-%m")
        return self._manager.ledger.total_spend(month) / 100
