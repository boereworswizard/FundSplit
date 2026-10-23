# Changelog

## 0.2.0
- Fixed: deleting an entry failed with "expected str at 'id'" (the websocket field clashed with the message id; it is now `item_id`).
- Removed the Rent and Utilities categories; added Cannabis. Existing entries keep their old category text.

## 0.1.x
- Receipt scanning via Home Assistant AI Task.
- Initial release: ledger, sensors, services, sidebar panel.
