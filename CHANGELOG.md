# Changelog

## 0.3.1
- Fixed a stale cached panel script causing "required key not provided at 'item_id'" after updating. The panel URL now includes the version.

## 0.3.0
- Added editing: tap ✎ on any expense or settlement to change it. Balances update straight away.
- New service `fundsplit.update_expense` and event `fundsplit_item_updated`.

## 0.2.0
- Fixed: deleting an entry failed with "expected str at 'id'" (the websocket field clashed with the message id; it is now `item_id`).
- Removed the Rent and Utilities categories; added Cannabis. Existing entries keep their old category text.

## 0.1.x
- Receipt scanning via Home Assistant AI Task.
- Initial release: ledger, sensors, services, sidebar panel.
