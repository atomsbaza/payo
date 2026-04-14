# Payment-to-Transfer Rename Bugfix Design

## Overview

The codebase uses "payment" throughout the database layer, TypeScript types, functions, API routes, webhook events, and migration files — but the product has rebranded this concept to "transfer". This is a pure rename: no logic changes, no schema shape changes, no API contract changes. The fix replaces every in-scope "payment" identifier with its "transfer" equivalent while preserving all runtime behaviour identically.

The rename touches five layers:
1. **Database** — table name, constraint names, foreign key name
2. **Drizzle schema** — the `paymentLinks` export in `src/lib/schema.ts`
3. **TypeScript types & functions** — `encode.ts`, `validate.ts`, `hmac.ts`, `webhookPayload.ts`
4. **Runtime string literals** — webhook event string `payment_completed`, download filename `payment-qr.png`
5. **Migration artefacts** — SQL files and meta snapshot JSON files in `drizzle/`

---

## Glossary

- **Bug_Condition (C)**: An identifier (symbol name, string literal, table name, constraint name, or filename) that contains the word "payment" in a context that should use "transfer" instead.
- **Property (P)**: After the rename, every in-scope identifier contains "transfer" where "payment" previously appeared, and all runtime behaviour is identical.
- **Preservation**: All API response shapes, encoding/decoding logic, HMAC signatures, and test outcomes remain unchanged after the rename.
- **`paymentLinks`**: The Drizzle table object exported from `src/lib/schema.ts`, mapped to the `payment_links` DB table.
- **`PaymentLinkData`**: The TypeScript type in `src/lib/encode.ts` describing the data encoded into a link ID.
- **`PaymentLinkSchema`**: The Zod schema in `src/lib/validate.ts` used to validate link data.
- **`ValidatedPaymentLink`**: The inferred type from `PaymentLinkSchema` in `src/lib/validate.ts`.
- **`PaymentCompletedData`**: The webhook payload data type in `src/lib/webhookPayload.ts`.
- **`signPaymentLink` / `verifyPaymentLink`**: HMAC functions in `src/lib/hmac.ts`.
- **`encodePaymentLink` / `decodePaymentLink`**: Base64url encode/decode functions in `src/lib/encode.ts`.
- **`validatePaymentLink`**: Validation function in `src/lib/validate.ts`.
- **`buildPaymentCompletedPayload`**: Webhook payload builder in `src/lib/webhookPayload.ts`.
- **`DEMO_PAYMENT_DATA`**: Demo link constant in `src/lib/encode.ts`.

---

## Bug Details

### Bug Condition

The bug manifests whenever any identifier in the database layer, TypeScript source, API routes, migration SQL, or meta snapshot JSON contains the word "payment" in a context that should use "transfer". The affected files are `src/lib/schema.ts`, `src/lib/encode.ts`, `src/lib/validate.ts`, `src/lib/hmac.ts`, `src/lib/webhookPayload.ts`, `src/app/api/links/[id]/route.ts`, `src/app/api/dashboard/[address]/route.ts`, all `drizzle/*.sql` files that reference `payment_links`, and all `drizzle/meta/*.json` snapshot files.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X — any identifier, string literal, table name, constraint name, or filename
  OUTPUT: boolean

  RETURN X contains "payment" (case-insensitive)
         AND X is within one of:
               { database layer, TypeScript source, API routes,
                 migration SQL files, meta snapshot JSON files }
         AND X is NOT in a legal/disclaimer context
             (e.g. "NOT a payment processor" in marketing copy)
END FUNCTION
```

### Examples

- `paymentLinks` (Drizzle export in `schema.ts`) → should be `transferLinks`
- `"payment_links"` (SQL table name in `0000_left_johnny_blaze.sql`) → should be `"transfer_links"`
- `payment_links_link_id_unique` (SQL constraint) → should be `transfer_links_link_id_unique`
- `link_events_link_id_payment_links_link_id_fk` (FK constraint) → should be `link_events_link_id_transfer_links_link_id_fk`
- `PaymentLinkData` (type in `encode.ts`) → should be `TransferLinkData`
- `encodePaymentLink` (function in `encode.ts`) → should be `encodeTransferLink`
- `signPaymentLink` (function in `hmac.ts`) → should be `signTransferLink`
- `'payment_completed'` (webhook event string in `webhookPayload.ts`) → should be `'transfer_completed'`
- `'payment-qr.png'` (download filename, wherever set) → should be `'transfer-qr.png'`
- `DEMO_PAYMENT_DATA` (constant in `encode.ts`) → should be `DEMO_TRANSFER_DATA`

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `POST /api/links` MUST continue to persist link records and return a valid encoded link ID with the same response shape.
- `GET /api/links/[id]` MUST continue to decode, verify, and return link data with the same JSON response shape.
- `POST /api/links/[id]` MUST continue to increment pay count, deactivate single-use links, fire webhooks, and send push notifications.
- `GET /api/dashboard/[address]` MUST continue to return the owner's links and upsert the user row.
- `GET /api/profile/[slug]` MUST continue to return active, non-expired links.
- Base64url encoding/decoding MUST produce identical output for identical input data.
- HMAC signing/verification MUST produce identical signatures for identical input data.
- The demo link flow MUST continue to return valid transfer link data for the `demo` ID.
- Graceful DB-less degradation MUST continue to work without errors.
- All existing property-based and unit tests MUST continue to pass.

**Scope:**
All inputs that do NOT involve an in-scope "payment" identifier are completely unaffected. This includes:
- All API request/response payloads (shapes are unchanged)
- All encoding/decoding logic (algorithm is unchanged)
- All HMAC signing logic (algorithm and secret are unchanged)
- All non-renamed identifiers (`linkEvents`, `users`, `transactions`, etc.)

---

## Hypothesized Root Cause

This is not a logic bug — it is a naming inconsistency introduced when the product rebranded "payment" to "transfer" without a corresponding code rename. The root causes are:

1. **Schema not updated**: `src/lib/schema.ts` still exports `paymentLinks` and maps to the `payment_links` DB table. All downstream imports use the old name.

2. **Type definitions not updated**: `PaymentLinkData`, `PaymentLinkSchema`, `ValidatedPaymentLink`, and `PaymentCompletedData` in `encode.ts`, `validate.ts`, and `webhookPayload.ts` retain the old naming.

3. **Function names not updated**: `encodePaymentLink`, `decodePaymentLink`, `signPaymentLink`, `verifyPaymentLink`, `validatePaymentLink`, and `buildPaymentCompletedPayload` retain the old naming across `encode.ts`, `hmac.ts`, `validate.ts`, and `webhookPayload.ts`.

4. **Runtime string literals not updated**: The webhook event type `'payment_completed'` in `webhookPayload.ts` and the download filename `'payment-qr.png'` are hardcoded strings that were never updated.

5. **Migration artefacts not updated**: The SQL files and meta snapshot JSON files in `drizzle/` still reference `payment_links`, `payment_links_link_id_unique`, and the FK constraint name. These must be updated to keep the migration history consistent with the renamed schema.

---

## Correctness Properties

Property 1: Bug Condition — All "payment" Identifiers Are Renamed to "transfer"

_For any_ identifier X where isBugCondition(X) returns true, the renamed codebase SHALL contain the "transfer" equivalent of X in place of X, and SHALL NOT contain the original "payment" spelling of X anywhere in the in-scope files.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**

Property 2: Preservation — Runtime Behaviour Is Unchanged

_For any_ input where isBugCondition does NOT hold (i.e. all API calls, encoding operations, HMAC operations, and DB queries), the renamed codebase SHALL produce exactly the same runtime result as the original codebase, preserving all response shapes, encoded outputs, signatures, and test outcomes.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

---

## Fix Implementation

### Changes Required

Assuming the root cause analysis is correct, the following targeted changes are needed:

**File: `payo/src/lib/schema.ts`**
- Rename export `paymentLinks` → `transferLinks`
- Change `pgTable('payment_links', ...)` → `pgTable('transfer_links', ...)`
- All downstream imports of `paymentLinks` will be updated via semantic rename

**File: `payo/src/lib/encode.ts`**
- Rename type `PaymentLinkData` → `TransferLinkData`
- Rename function `encodePaymentLink` → `encodeTransferLink`
- Rename function `decodePaymentLink` → `decodeTransferLink`
- Rename constant `DEMO_PAYMENT_DATA` → `DEMO_TRANSFER_DATA`

**File: `payo/src/lib/hmac.ts`**
- Update import: `PaymentLinkData` → `TransferLinkData`
- Rename function `signPaymentLink` → `signTransferLink`
- Rename function `verifyPaymentLink` → `verifyTransferLink`

**File: `payo/src/lib/validate.ts`**
- Rename schema `PaymentLinkSchema` → `TransferLinkSchema`
- Rename type `ValidatedPaymentLink` → `ValidatedTransferLink`
- Rename function `validatePaymentLink` → `validateTransferLink`
- Update comment referencing `payment_links.chain_id` → `transfer_links.chain_id`

**File: `payo/src/lib/webhookPayload.ts`**
- Rename type `WebhookEventType` union member `'payment_completed'` → `'transfer_completed'`
- Rename type `PaymentCompletedData` → `TransferCompletedData`
- Rename function `buildPaymentCompletedPayload` → `buildTransferCompletedPayload`
- Update `event: 'payment_completed'` literal → `event: 'transfer_completed'`

**File: `payo/src/app/api/links/[id]/route.ts`**
- Update all imports: `paymentLinks`, `decodePaymentLink`, `DEMO_PAYMENT_DATA`, `validatePaymentLink`, `verifyPaymentLink`, `buildPaymentCompletedPayload` → their `Transfer*` equivalents
- Update all usages of the above throughout the file

**File: `payo/src/app/api/dashboard/[address]/route.ts`**
- Update import: `paymentLinks` → `transferLinks`
- Update all usages

**Other API routes and source files** — audit with grep for any remaining `paymentLinks`, `PaymentLink*`, `payment_completed`, `payment-qr` references and update accordingly.

**Migration SQL files (`drizzle/0000_left_johnny_blaze.sql` and any others referencing `payment_links`)**
- Replace `"payment_links"` → `"transfer_links"`
- Replace `payment_links_link_id_unique` → `transfer_links_link_id_unique`
- Replace `link_events_link_id_payment_links_link_id_fk` → `link_events_link_id_transfer_links_link_id_fk`

**Meta snapshot JSON files (`drizzle/meta/*.json`)**
- Replace all `"public.payment_links"` keys → `"public.transfer_links"`
- Replace all `payment_links_link_id_unique` values → `transfer_links_link_id_unique`
- Replace all FK constraint name references accordingly

**Download filename** — locate the `'payment-qr.png'` string literal (likely in a QR download component) and replace with `'transfer-qr.png'`.

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that confirm the naming inconsistency exists in the current code, then verify the rename is complete and all behaviour is preserved.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the scope of the rename by finding every in-scope "payment" occurrence.

**Test Plan**: Write a static analysis test (or use grep assertions) that scans all in-scope files for the string "payment" (case-insensitive) and asserts zero matches. Run on the UNFIXED code to observe failures and enumerate every location that needs changing.

**Test Cases**:
1. **Schema export check**: Assert `src/lib/schema.ts` does not export `paymentLinks` (will fail on unfixed code)
2. **DB table name check**: Assert `src/lib/schema.ts` does not contain `'payment_links'` as a table name string (will fail on unfixed code)
3. **Type name check**: Assert `src/lib/encode.ts` does not define `PaymentLinkData` (will fail on unfixed code)
4. **Webhook event string check**: Assert `src/lib/webhookPayload.ts` does not contain `'payment_completed'` (will fail on unfixed code)
5. **Migration SQL check**: Assert `drizzle/0000_left_johnny_blaze.sql` does not contain `payment_links` (will fail on unfixed code)

**Expected Counterexamples**:
- `paymentLinks` export found in `schema.ts`
- `payment_links` table name found in `schema.ts` and migration SQL files
- `PaymentLinkData`, `PaymentLinkSchema`, `ValidatedPaymentLink`, `PaymentCompletedData` found in source files
- `payment_completed` event string found in `webhookPayload.ts`
- `payment_links_link_id_unique` and FK constraint names found in migration SQL and meta JSON

### Fix Checking

**Goal**: Verify that for all identifiers where the bug condition holds, the renamed codebase contains the correct "transfer" equivalent.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := rename(X)
  ASSERT result contains "transfer" in place of "payment"
  ASSERT result does NOT contain the original "payment" spelling
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the renamed codebase produces the same runtime result as the original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT behaviour_original(input) = behaviour_renamed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that encoding, HMAC, and validation behaviour is unchanged

**Test Plan**: Observe behaviour on UNFIXED code first for encoding, HMAC, and validation, then write property-based tests capturing that behaviour.

**Test Cases**:
1. **Encode/decode round-trip preservation**: Verify `encodeTransferLink(decodeTransferLink(id)) ≡ id` for all valid link IDs — same as before the rename
2. **HMAC signature preservation**: Verify `signTransferLink(data)` produces the same hex output as `signPaymentLink(data)` for identical input data
3. **Validation preservation**: Verify `validateTransferLink(data)` returns the same valid/invalid result as `validatePaymentLink(data)` for all inputs
4. **API response shape preservation**: Verify `GET /api/links/[id]` returns the same JSON shape after the rename

### Unit Tests

- Assert every renamed symbol is importable under its new name from the correct module
- Assert `encodeTransferLink` / `decodeTransferLink` produce identical output to the old functions for the same inputs
- Assert `signTransferLink` / `verifyTransferLink` produce identical HMAC results for the same inputs
- Assert `validateTransferLink` accepts and rejects the same inputs as before
- Assert `buildTransferCompletedPayload` emits `event: 'transfer_completed'` (not `'payment_completed'`)

### Property-Based Tests

- Generate random `TransferLinkData` objects and verify encode→decode round-trip is lossless (fast-check)
- Generate random valid link data and verify HMAC sign→verify always returns `true` (fast-check)
- Generate random invalid link data and verify `validateTransferLink` rejects it consistently (fast-check)
- Generate random non-"payment" identifiers and verify they are unaffected by the rename (fast-check)

### Integration Tests

- Test full link creation → fetch → confirmation flow end-to-end with renamed symbols
- Test dashboard API returns links from the renamed `transfer_links` table
- Test webhook dispatch emits `transfer_completed` event type
- Test that existing property-based test files (`*.property.test.ts`) all pass without modification after the rename
