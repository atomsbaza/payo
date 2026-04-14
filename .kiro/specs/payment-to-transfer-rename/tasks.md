# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - "payment" Identifiers Found in In-Scope Files
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that enumerate every in-scope "payment" occurrence
  - **Scoped PBT Approach**: Scope the property to the concrete set of in-scope files; for each file assert zero matches of `/payment/i` in identifiers, table names, constraint names, and string literals
  - Create `payo/src/__tests__/payment-to-transfer-rename.property.test.ts`
  - For each in-scope file, read its content and assert it does NOT contain any of the known buggy identifiers:
    - `src/lib/schema.ts`: assert no `paymentLinks`, no `'payment_links'` table string, no `payment_links_link_id_unique` constraint
    - `src/lib/encode.ts`: assert no `PaymentLinkData`, no `encodePaymentLink`, no `decodePaymentLink`, no `DEMO_PAYMENT_DATA`
    - `src/lib/hmac.ts`: assert no `signPaymentLink`, no `verifyPaymentLink`
    - `src/lib/validate.ts`: assert no `PaymentLinkSchema`, no `ValidatedPaymentLink`, no `validatePaymentLink`
    - `src/lib/webhookPayload.ts`: assert no `PaymentCompletedData`, no `buildPaymentCompletedPayload`, no `'payment_completed'`
    - `src/app/api/links/[id]/route.ts`: assert no `decodePaymentLink`, no `DEMO_PAYMENT_DATA`, no `validatePaymentLink`, no `verifyPaymentLink`, no `buildPaymentCompletedPayload`, no `paymentLinks`
    - `src/app/api/dashboard/[address]/route.ts`: assert no `paymentLinks`
    - `drizzle/0000_left_johnny_blaze.sql`: assert no `payment_links`, no `payment_links_link_id_unique`, no `link_events_link_id_payment_links_link_id_fk`
    - All `drizzle/meta/*.json` snapshot files: assert no `public.payment_links`, no `payment_links_link_id_unique`
  - Use fast-check `fc.assert(fc.property(fc.constant(fileContent), content => !content.includes('payment')))` pattern per file
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g. "`paymentLinks` found in schema.ts line 20", "`payment_completed` found in webhookPayload.ts")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Encode/Decode, HMAC, and Validation Behaviour Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code:
    - `encodePaymentLink({ address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', token: 'ETH', amount: '0.01', memo: 'test', chainId: 84532 })` produces a stable base64url string
    - `decodePaymentLink(encoded)` round-trips back to the original object
    - `signPaymentLink(data)` produces a deterministic 64-char hex string for fixed input
    - `verifyPaymentLink({ ...data, signature })` returns `true` for a correctly signed payload
    - `validatePaymentLink(validData)` returns `{ valid: true }` for valid inputs and `{ valid: false }` for invalid inputs
  - Create `payo/src/__tests__/payment-to-transfer-rename-preservation.property.test.ts`
  - Write property-based tests using fast-check:
    - **Encode/decode round-trip**: `fc.assert(fc.property(fc.record({ address: fc.constant('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'), token: fc.constantFrom('ETH','USDC'), amount: fc.constantFrom('','0.01','1'), memo: fc.string(), chainId: fc.constantFrom(84532, 8453) }), data => decodePaymentLink(encodePaymentLink(data))?.address === data.address))` — for all non-buggy link data objects, encode→decode is lossless
    - **HMAC sign/verify**: `fc.assert(fc.property(validLinkDataArb, data => { const sig = signPaymentLink(data); return verifyPaymentLink({ ...data, signature: sig }) }))` — for all valid link data, sign then verify always returns true
    - **Validation accepts valid data**: `fc.assert(fc.property(validLinkDataArb, data => validatePaymentLink(data).valid === true))`
    - **Validation rejects invalid address**: `fc.assert(fc.property(fc.string(), addr => !addr.match(/^0x[a-fA-F0-9]{40}$/) ? validatePaymentLink({ ...baseData, address: addr }).valid === false : true))`
  - Verify all tests PASS on UNFIXED code before implementing the fix
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behaviour to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [x] 3. Fix: rename all "payment" identifiers to "transfer" across the codebase

  - [x] 3.1 Rename schema export and DB table name in `src/lib/schema.ts`
    - Use semantic rename to change `paymentLinks` → `transferLinks` (updates all downstream imports automatically)
    - Change `pgTable('payment_links', ...)` → `pgTable('transfer_links', ...)`
    - _Bug_Condition: isBugCondition(X) where X = `paymentLinks` or `'payment_links'` in `src/lib/schema.ts`_
    - _Expected_Behavior: `transferLinks` export maps to `'transfer_links'` DB table_
    - _Preservation: All API routes that query `transferLinks` continue to return the same response shapes (Requirements 3.1–3.5)_
    - _Requirements: 1.3, 2.1, 2.2, 2.3_

  - [x] 3.2 Rename types and functions in `src/lib/encode.ts`
    - Rename type `PaymentLinkData` → `TransferLinkData`
    - Rename function `encodePaymentLink` → `encodeTransferLink`
    - Rename function `decodePaymentLink` → `decodeTransferLink`
    - Rename constant `DEMO_PAYMENT_DATA` → `DEMO_TRANSFER_DATA`
    - _Bug_Condition: isBugCondition(X) where X ∈ { `PaymentLinkData`, `encodePaymentLink`, `decodePaymentLink`, `DEMO_PAYMENT_DATA` } in `src/lib/encode.ts`_
    - _Expected_Behavior: All callers use `TransferLinkData`, `encodeTransferLink`, `decodeTransferLink`, `DEMO_TRANSFER_DATA`_
    - _Preservation: Encoding algorithm is unchanged — same base64url output for same input (Requirement 3.6)_
    - _Requirements: 1.4, 1.6, 2.4, 2.6, 2.8_

  - [x] 3.3 Rename functions and update import in `src/lib/hmac.ts`
    - Update import: `PaymentLinkData` → `TransferLinkData`
    - Rename function `signPaymentLink` → `signTransferLink`
    - Rename function `verifyPaymentLink` → `verifyTransferLink`
    - _Bug_Condition: isBugCondition(X) where X ∈ { `signPaymentLink`, `verifyPaymentLink` } in `src/lib/hmac.ts`_
    - _Expected_Behavior: `signTransferLink` and `verifyTransferLink` produce identical HMAC output to the old functions_
    - _Preservation: HMAC algorithm and secret are unchanged — same signature for same input (Requirement 3.7)_
    - _Requirements: 1.6, 2.6_

  - [x] 3.4 Rename schema, type, and function in `src/lib/validate.ts`
    - Rename schema `PaymentLinkSchema` → `TransferLinkSchema`
    - Rename type `ValidatedPaymentLink` → `ValidatedTransferLink`
    - Rename function `validatePaymentLink` → `validateTransferLink`
    - Update comment referencing `payment_links.chain_id` → `transfer_links.chain_id`
    - _Bug_Condition: isBugCondition(X) where X ∈ { `PaymentLinkSchema`, `ValidatedPaymentLink`, `validatePaymentLink` } in `src/lib/validate.ts`_
    - _Expected_Behavior: `validateTransferLink` accepts and rejects the same inputs as before_
    - _Preservation: Validation logic is unchanged (Requirement 3.1, 3.2)_
    - _Requirements: 1.5, 1.6, 2.5, 2.6_

  - [x] 3.5 Rename type, function, and event string in `src/lib/webhookPayload.ts`
    - Rename `WebhookEventType` union member `'payment_completed'` → `'transfer_completed'`
    - Rename type `PaymentCompletedData` → `TransferCompletedData`
    - Rename function `buildPaymentCompletedPayload` → `buildTransferCompletedPayload`
    - Update `event: 'payment_completed'` literal → `event: 'transfer_completed'` inside the function body
    - _Bug_Condition: isBugCondition(X) where X ∈ { `PaymentCompletedData`, `buildPaymentCompletedPayload`, `'payment_completed'` } in `src/lib/webhookPayload.ts`_
    - _Expected_Behavior: Webhook payloads emit `event: 'transfer_completed'`_
    - _Preservation: Webhook payload shape is otherwise unchanged (Requirement 3.3)_
    - _Requirements: 1.5, 1.6, 1.7, 2.5, 2.6, 2.7_

  - [x] 3.6 Update all imports and usages in `src/app/api/links/[id]/route.ts`
    - Update imports: `decodePaymentLink` → `decodeTransferLink`, `DEMO_PAYMENT_DATA` → `DEMO_TRANSFER_DATA` (from `@/lib/encode`)
    - Update imports: `validatePaymentLink` → `validateTransferLink` (from `@/lib/validate`)
    - Update imports: `verifyPaymentLink` → `verifyTransferLink` (from `@/lib/hmac`)
    - Update imports: `paymentLinks` → `transferLinks` (from `@/lib/schema`)
    - Update imports: `buildPaymentCompletedPayload` → `buildTransferCompletedPayload` (from `@/lib/webhookPayload`)
    - Update all call sites throughout the file to use the renamed symbols
    - _Bug_Condition: isBugCondition(X) for all `payment*` import references in this file_
    - _Expected_Behavior: Route continues to handle GET and POST with identical request/response contracts_
    - _Preservation: Link fetch, confirmation, webhook dispatch, and push notification flows are unchanged (Requirements 3.2, 3.3)_
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.7 Update import and usages in `src/app/api/dashboard/[address]/route.ts`
    - Update import: `paymentLinks` → `transferLinks` (from `@/lib/schema`)
    - Update all `.from(paymentLinks)`, `.where(eq(paymentLinks.ownerAddress, ...))`, `.orderBy(desc(paymentLinks.createdAt))` usages → `transferLinks`
    - _Bug_Condition: isBugCondition(X) where X = `paymentLinks` in this file_
    - _Expected_Behavior: Dashboard route queries `transfer_links` table and returns the same response shape_
    - _Preservation: Dashboard response shape and upsert behaviour are unchanged (Requirement 3.4)_
    - _Requirements: 1.3, 2.3_

  - [x] 3.8 Audit and update any remaining `payment*` references in other source files
    - Grep all `src/` files for `/payment/i` and update any remaining references not covered above (e.g. profile API route, QR download component with `'payment-qr.png'` → `'transfer-qr.png'`, any other API routes or components)
    - _Bug_Condition: isBugCondition(X) for any remaining `payment*` identifier in `src/`_
    - _Expected_Behavior: Zero occurrences of in-scope `payment*` identifiers remain in `src/`_
    - _Preservation: All affected flows continue to work identically_
    - _Requirements: 1.8, 2.8_

  - [x] 3.9 Update Drizzle migration SQL files
    - In `drizzle/0000_left_johnny_blaze.sql` (and any other SQL files referencing `payment_links`):
      - Replace `"payment_links"` → `"transfer_links"`
      - Replace `payment_links_link_id_unique` → `transfer_links_link_id_unique`
      - Replace `link_events_link_id_payment_links_link_id_fk` → `link_events_link_id_transfer_links_link_id_fk`
    - _Bug_Condition: isBugCondition(X) where X ∈ SQL table/constraint names in `drizzle/*.sql`_
    - _Expected_Behavior: Migration SQL references `transfer_links` and updated constraint names_
    - _Requirements: 1.9, 2.9_

  - [x] 3.10 Update Drizzle meta snapshot JSON files
    - In all `drizzle/meta/*.json` snapshot files:
      - Replace all `"public.payment_links"` keys → `"public.transfer_links"`
      - Replace all `payment_links_link_id_unique` values → `transfer_links_link_id_unique`
      - Replace all FK constraint name references `link_events_link_id_payment_links_link_id_fk` → `link_events_link_id_transfer_links_link_id_fk`
    - _Bug_Condition: isBugCondition(X) where X ∈ table/constraint keys in `drizzle/meta/*.json`_
    - _Expected_Behavior: Meta snapshots reference `transfer_links` and updated constraint names_
    - _Requirements: 1.10, 2.10_

  - [x] 3.11 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Zero "payment" Identifiers Remain in In-Scope Files
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (zero in-scope `payment*` occurrences)
    - Run `npm test` targeting `payment-to-transfer-rename.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms all identifiers have been renamed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [x] 3.12 Verify preservation tests still pass
    - **Property 2: Preservation** - Encode/Decode, HMAC, and Validation Behaviour Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `npm test` targeting `payment-to-transfer-rename-preservation.property.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions in encoding, HMAC, or validation)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.6, 3.7_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite: `npm test`
  - Confirm both property test files pass
  - Confirm all pre-existing `*.property.test.ts` and `*.test.ts` files continue to pass
  - Confirm TypeScript compiles without errors: `npm run build` (or `tsc --noEmit`)
  - Ask the user if any questions arise
  - _Requirements: 3.10_
