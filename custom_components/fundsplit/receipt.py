"""Scan a receipt photo with Home Assistant's AI Task integration."""

from __future__ import annotations

import base64
import binascii
from pathlib import Path
import uuid

import voluptuous as vol

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import selector

from .const import MAX_RECEIPT_BYTES, RECEIPT_DIR
from .ledger import CATEGORIES, LedgerError
from .receipt_parse import RECEIPT_INSTRUCTIONS, parse_receipt_result

_EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def _structure() -> vol.Schema:
    return vol.Schema(
        {
            vol.Required("total", description="Final total paid, in ZAR"): (
                selector.NumberSelector(
                    selector.NumberSelectorConfig(mode=selector.NumberSelectorMode.BOX, step="any")
                )
            ),
            vol.Optional("merchant", description="Name of the shop or restaurant"): (
                selector.TextSelector()
            ),
            vol.Optional("date", description="Purchase date, YYYY-MM-DD"): (
                selector.TextSelector()
            ),
            vol.Optional("category", description="Best-fitting expense category"): (
                selector.SelectSelector(
                    selector.SelectSelectorConfig(options=list(CATEGORIES))
                )
            ),
        }
    )


def _write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


async def async_scan_receipt(
    hass: HomeAssistant, image_b64: str, mime_type: str, entity_id: str | None
) -> dict:
    """Return a validated draft expense ({amount, description?, date?, category?})."""
    if "ai_task" not in hass.config.components:
        raise LedgerError(
            "The AI Task integration isn't set up. Add an AI provider "
            "(Settings → Devices & services) that supports AI Task."
        )
    ext = _EXTENSIONS.get(mime_type)
    if ext is None:
        raise LedgerError("Unsupported image type (use JPEG, PNG or WebP)")
    try:
        content = base64.b64decode(image_b64, validate=True)
    except (binascii.Error, ValueError) as err:
        raise LedgerError("The photo could not be decoded") from err
    if not content or len(content) > MAX_RECEIPT_BYTES:
        raise LedgerError("The photo is empty or too large")

    media_dirs = hass.config.media_dirs
    source_id = "local" if "local" in media_dirs else next(iter(media_dirs), None)
    if source_id is None:
        raise LedgerError("Home Assistant has no media folder configured")

    filename = f"{uuid.uuid4().hex}.{ext}"
    path = Path(media_dirs[source_id]) / RECEIPT_DIR / filename
    await hass.async_add_executor_job(_write, path, content)

    from homeassistant.components import ai_task  # noqa: PLC0415 (optional dependency)

    try:
        result = await ai_task.async_generate_data(
            hass,
            task_name="FundSplit receipt scan",
            entity_id=entity_id or None,
            instructions=RECEIPT_INSTRUCTIONS,
            structure=_structure(),
            attachments=[
                {
                    "media_content_id": (
                        f"media-source://media_source/{source_id}/{RECEIPT_DIR}/{filename}"
                    ),
                    "media_content_type": mime_type,
                }
            ],
        )
    except HomeAssistantError as err:
        raise LedgerError(f"AI scan failed: {err}") from err
    finally:
        # The photo is only needed for the scan; don't leave receipts lying around.
        await hass.async_add_executor_job(lambda: path.unlink(missing_ok=True))

    return parse_receipt_result(result.data)
