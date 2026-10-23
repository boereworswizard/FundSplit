# FundSplit

Splitwise-style shared expenses for two people, running natively inside Home Assistant.
Amounts are in **South African rand (ZAR)**.

## Install

1. Copy `custom_components/fundsplit` into your HA `config/custom_components/` (or add this repo to HACS as a custom repository).
2. Restart Home Assistant.
3. **Settings → Devices & services → Add integration → FundSplit**, then enter the two people (optionally linking each to an HA `person`).
4. A **FundSplit** item appears in the sidebar.

## Using it

The sidebar panel shows who owes whom, lets you add expenses (split equally, "the other person owes all",
by percentage, or exact amounts), settle up, and delete entries. If your HA user is linked to a person that
you mapped to a member, "Paid by" defaults to you.

## Scan a receipt

Tap **📷 Scan receipt** in the panel, take a photo (or pick one), and FundSplit sends it to your Home Assistant
AI agent via the `ai_task` integration. The total, merchant, date and category are filled into the add-expense
form so you can check them and tap **Save** (the AI can misread, so nothing is added without your confirmation).

Requirements:
* An AI provider that supports **AI Task with attachments** (e.g. Google Generative AI, OpenAI, Anthropic, Ollama with a vision model) is set up in HA.
* A default AI task entity is chosen under **Settings → System → AI tasks**, or pick one under **FundSplit → Configure**.
* HA has a media folder (the default `/media` or `config/media`). The photo is saved there only for the scan and deleted straight after.
* The panel must be opened over HTTPS (e.g. Nabu Casa) or in the HA companion app for the phone camera to work.

## Entities

| Entity | Meaning |
| --- | --- |
| `sensor.fundsplit_<name>_balance` | Net balance. Positive = owed money, negative = owes money. |
| `sensor.fundsplit_outstanding` | Amount outstanding; `summary` attribute reads e.g. "Sam owes Alex R142.50". |
| `sensor.fundsplit_total_spend` / `_spend_this_month` | Spend totals. |

## Services

* `fundsplit.add_expense` - `description`, `amount`, `paid_by`; optional `split_mode` (`equal`, `shares`, `percent`, `exact`), `split_values`, `date`, `category`. `paid_by` accepts a name or person entity id.
* `fundsplit.settle_up` - no arguments settles the full outstanding balance; or give `from`, `to` and `amount`.
* `fundsplit.update_expense` - same fields as `add_expense` plus the `id` of the expense to replace.
* `fundsplit.delete_item` - soft-deletes an expense or settlement by `id`.

Example automation: split the electricity bill 60/40 when a sensor changes:

```yaml
action: fundsplit.add_expense
data:
  description: Electricity
  amount: "{{ states('sensor.electricity_bill') }}"
  paid_by: person.alex
  split_mode: percent
  split_values: { Alex: 60, Sam: 40 }
```

## Events

`fundsplit_expense_added`, `fundsplit_settlement_added`, `fundsplit_item_updated`, `fundsplit_item_deleted` - use them for notifications.

## Development

The ledger (`custom_components/fundsplit/ledger.py`) is pure Python with no HA dependency:

```
pip install pytest && pytest
```
