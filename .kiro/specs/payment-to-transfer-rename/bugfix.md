# Bugfix Requirements Document

## Introduction

The Payo codebase uses the term "payment" throughout the database layer, TypeScript types, API routes, and supporting libraries — but the product has rebranded this concept to "transfer". The mismatch creates inconsistency between the product language and the code. This spec covers renaming every "payment" identifier to "transfer" across the database schema, migrations, TypeScript source, API routes, and tests, while preserving all runtime behaviour.

Scope of the rename (discovered by audit):

| Layer | Current name | Target name |
|---|---|---|
| DB table | `payment_links` | `transfer_links` |
| DB constraint | `payment_links_link_id_unique` | `transfer_links_link_id_unique` |
| DB foreign key | `link_events_link_id_payment_links_link_id_fk` | `link_events_link_id_transfer_links_link_id_fk` |
| Schema export | `paymentLinks` | `transferLinks` |
| TS type | `PaymentLinkData` | `TransferLinkData` |
| TS type | `PaymentLinkSchema` | `TransferLinkSchema` |
| TS type | `ValidatedPaymentLink` | `ValidatedTransferLink` |
| TS type | `PaymentCompletedData` | `TransferCompletedData` |
| Webhook event string | `payment_completed` | `transfer_completed` |
| Function | `encodePaymentLink` | `encodeTransferLink` |
| Function | `decodePaymentLink` | `decodeTransferLink` |
| Function | `signPaymentLink` | `signTransferLink` |
| Function | `verifyPaymentLink` | `verifyTransferLink` |
| Function | `validatePaymentLink` | `validateTransferLink` |
| Function | `buildPaymentCompletedPayload` | `buildTransferCompletedPayload` |
| Constant | `DEMO_PAYMENT_DATA` | `DEMO_TRANSFER_DATA` |
| File name | `payment-qr.png` (download filename) | `transfer-qr.png` |

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the database schema is inspected THEN the system exposes a table named `payment_links` instead of `transfer_links`

1.2 WHEN the `link_events` foreign key constraint is inspected THEN the system references `payment_links` in the constraint name `link_events_link_id_payment_links_link_id_fk`

1.3 WHEN TypeScript source files are read THEN the system uses the export name `paymentLinks` (Drizzle table object) instead of `transferLinks`

1.4 WHEN TypeScript source files are read THEN the system uses the type name `PaymentLinkData` instead of `TransferLinkData`

1.5 WHEN TypeScript source files are read THEN the system uses the type names `PaymentLinkSchema`, `ValidatedPaymentLink`, and `PaymentCompletedData` instead of their `Transfer*` equivalents

1.6 WHEN TypeScript source files are read THEN the system uses function names `encodePaymentLink`, `decodePaymentLink`, `signPaymentLink`, `verifyPaymentLink`, `validatePaymentLink`, and `buildPaymentCompletedPayload` instead of their `Transfer*` equivalents

1.7 WHEN a webhook event fires for a completed transfer THEN the system emits the event string `payment_completed` instead of `transfer_completed`

1.8 WHEN a user downloads a QR code THEN the system saves the file as `payment-qr.png` instead of `transfer-qr.png`

1.9 WHEN Drizzle migration SQL files are read THEN the system contains `CREATE TABLE "payment_links"` and related constraint names using `payment_links`

1.10 WHEN Drizzle meta snapshot JSON files are read THEN the system contains `"public.payment_links"` table keys and `payment_links_link_id_unique` constraint names

### Expected Behavior (Correct)

2.1 WHEN the database schema is inspected THEN the system SHALL expose a table named `transfer_links`

2.2 WHEN the `link_events` foreign key constraint is inspected THEN the system SHALL reference `transfer_links` in the constraint name `link_events_link_id_transfer_links_link_id_fk`

2.3 WHEN TypeScript source files are read THEN the system SHALL use the export name `transferLinks` for the Drizzle table object

2.4 WHEN TypeScript source files are read THEN the system SHALL use the type name `TransferLinkData`

2.5 WHEN TypeScript source files are read THEN the system SHALL use the type names `TransferLinkSchema`, `ValidatedTransferLink`, and `TransferCompletedData`

2.6 WHEN TypeScript source files are read THEN the system SHALL use function names `encodeTransferLink`, `decodeTransferLink`, `signTransferLink`, `verifyTransferLink`, `validateTransferLink`, and `buildTransferCompletedPayload`

2.7 WHEN a webhook event fires for a completed transfer THEN the system SHALL emit the event string `transfer_completed`

2.8 WHEN a user downloads a QR code THEN the system SHALL save the file as `transfer-qr.png`

2.9 WHEN a new Drizzle migration is generated THEN the system SHALL contain `CREATE TABLE "transfer_links"` and constraint names using `transfer_links`

2.10 WHEN Drizzle meta snapshot JSON files are updated THEN the system SHALL contain `"public.transfer_links"` table keys and `transfer_links_link_id_unique` constraint names

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a transfer link is created via `POST /api/links` THEN the system SHALL CONTINUE TO persist the link record and return a valid encoded link ID

3.2 WHEN a transfer link is fetched via `GET /api/links/[id]` THEN the system SHALL CONTINUE TO decode, verify, and return the link data with the same response shape

3.3 WHEN a transfer confirmation is posted via `POST /api/links/[id]` THEN the system SHALL CONTINUE TO increment pay count, deactivate single-use links, fire webhooks, and send push notifications

3.4 WHEN the dashboard API is called via `GET /api/dashboard/[address]` THEN the system SHALL CONTINUE TO return the owner's links and upsert the user row

3.5 WHEN the profile API is called via `GET /api/profile/[slug]` THEN the system SHALL CONTINUE TO return active, non-expired links for the user

3.6 WHEN a link ID is encoded or decoded THEN the system SHALL CONTINUE TO produce the same base64url output for the same input data

3.7 WHEN an HMAC signature is signed or verified THEN the system SHALL CONTINUE TO produce the same signature for the same input data

3.8 WHEN the demo link flow is triggered THEN the system SHALL CONTINUE TO return valid transfer link data for the demo ID

3.9 WHEN the database is not configured THEN the system SHALL CONTINUE TO fall back gracefully without errors

3.10 WHEN existing tests are run THEN the system SHALL CONTINUE TO pass all property-based and unit tests after the rename

---

## Bug Condition (Pseudocode)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X — any identifier (symbol name, string literal, table name, constraint name, file name)
  OUTPUT: boolean

  RETURN X contains "payment" (case-insensitive) AND X is within the database layer,
         TypeScript source, API routes, migrations, or meta snapshots
         AND X is NOT in a legal/disclaimer context (e.g. "NOT a payment processor")
END FUNCTION
```

```pascal
// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  result ← rename(X)
  ASSERT result contains "transfer" in place of "payment"
  ASSERT result does NOT contain the original "payment" spelling
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT behaviour(X) BEFORE rename = behaviour(X) AFTER rename
END FOR
```
