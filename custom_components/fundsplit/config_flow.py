"""Config flow for FundSplit."""

from __future__ import annotations

from typing import Any
import uuid

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_AI_TASK_ENTITY,
    CONF_MEMBERS,
    CONF_NAME_1,
    CONF_NAME_2,
    CONF_PERSON_1,
    CONF_PERSON_2,
    DOMAIN,
)

_PERSON = selector.EntitySelector(selector.EntitySelectorConfig(domain="person"))

SCHEMA = vol.Schema(
    {
        vol.Required(CONF_NAME_1): str,
        vol.Optional(CONF_PERSON_1): _PERSON,
        vol.Required(CONF_NAME_2): str,
        vol.Optional(CONF_PERSON_2): _PERSON,
    }
)


class FundSplitConfigFlow(ConfigFlow, domain=DOMAIN):
    """Set up the two people who share expenses."""

    VERSION = 1

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return FundSplitOptionsFlow()

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        errors: dict[str, str] = {}
        if user_input is not None:
            name_1 = user_input[CONF_NAME_1].strip()
            name_2 = user_input[CONF_NAME_2].strip()
            if not name_1 or not name_2:
                errors["base"] = "name_required"
            elif name_1.casefold() == name_2.casefold():
                errors["base"] = "same_name"
            else:
                members = [
                    {
                        "id": uuid.uuid4().hex[:8],
                        "name": name_1,
                        "person": user_input.get(CONF_PERSON_1),
                    },
                    {
                        "id": uuid.uuid4().hex[:8],
                        "name": name_2,
                        "person": user_input.get(CONF_PERSON_2),
                    },
                ]
                return self.async_create_entry(
                    title="FundSplit", data={CONF_MEMBERS: members}
                )

        return self.async_show_form(
            step_id="user",
            data_schema=self.add_suggested_values_to_schema(SCHEMA, user_input),
            errors=errors,
        )


class FundSplitOptionsFlow(OptionsFlow):
    """Choose which AI Task entity scans receipts."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data=user_input)
        schema = vol.Schema(
            {
                vol.Optional(CONF_AI_TASK_ENTITY): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="ai_task")
                )
            }
        )
        return self.async_show_form(
            step_id="init",
            data_schema=self.add_suggested_values_to_schema(
                schema, self.config_entry.options
            ),
        )
