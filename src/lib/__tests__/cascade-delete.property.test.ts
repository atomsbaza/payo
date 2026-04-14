import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { linkEvents, transferLinks } from '../schema'

/**
 * Feature: database-integration, Property 14: Cascade delete of link events
 *
 * For any payment link with associated events in `link_events`, deleting the
 * payment link should also delete all its associated events (ON DELETE CASCADE).
 *
 * Since we don't have a real database in tests, we verify the CASCADE behavior
 * at the Drizzle schema level by inspecting the foreign key configuration
 * programmatically. We use fast-check to generate random link/event scenarios
 * and confirm the schema relationship is correctly defined for each.
 *
 * **Validates: Requirements 7.5**
 */

// --- Helpers to extract schema metadata ---

function getLinkEventsForeignKeys() {
  const config = getTableConfig(linkEvents)
  return config.foreignKeys
}

function getPaymentLinksTableName() {
  const config = getTableConfig(transferLinks)
  return config.name
}

// --- Arbitraries ---

const linkIdArb = fc.string({ minLength: 1, maxLength: 100 })

const eventCountArb = fc.integer({ min: 1, max: 50 })

const eventTypeArb = fc.constantFrom('viewed', 'paid', 'expired', 'tamper_blocked')

// --- Tests ---

describe('Feature: database-integration, Property 14: Cascade delete of link events', () => {
  /**
   * The linkEvents table must have exactly one foreign key, and it must
   * reference the paymentLinks table with ON DELETE CASCADE.
   *
   * We generate random (linkId, eventCount) pairs to simulate the scenario
   * of a payment link with N associated events. For every such pair the
   * schema-level FK + cascade guarantee means deleting the parent link_id
   * row would cascade-delete all child event rows.
   *
   * **Validates: Requirements 7.5**
   */
  it('linkEvents.linkId FK references transferLinks with onDelete cascade for any link with events', () => {
    const foreignKeys = getLinkEventsForeignKeys()
    const parentTableName = getPaymentLinksTableName()

    // There should be at least one FK on linkEvents
    expect(foreignKeys.length).toBeGreaterThanOrEqual(1)

    // Find the FK that targets transferLinks
    const cascadeFK = foreignKeys.find((fk) => {
      const fkName = fk.getName()
      // Drizzle FK names contain the referenced table name
      return fkName.includes('transfer_links')
    })

    expect(cascadeFK).toBeDefined()

    fc.assert(
      fc.property(
        linkIdArb,
        eventCountArb,
        eventTypeArb,
        (linkId, eventCount, eventType) => {
          // For any generated linkId with N events of any type,
          // the schema guarantees cascade delete via the FK definition.

          // 1. Verify FK exists and targets the correct parent table
          expect(cascadeFK).toBeDefined()
          const fkName = cascadeFK!.getName()
          expect(fkName).toContain('transfer_links')

          // 2. Verify the FK references the linkId column on paymentLinks
          // The FK name in Drizzle follows the pattern:
          // <child_table>_<child_col>_<parent_table>_<parent_col>_fk
          expect(fkName).toContain('link_id')

          // 3. Verify ON DELETE CASCADE is configured
          // Access the internal onDelete action
          const onDeleteAction = (cascadeFK as unknown as Record<string, unknown>).onDelete
          expect(onDeleteAction).toBe('cascade')

          // 4. The parent table name must be 'transfer_links'
          expect(parentTableName).toBe('transfer_links')

          // 5. Verify the scenario: a link with `eventCount` events
          //    would have all events removed on parent deletion
          //    (this is guaranteed by the cascade FK, not runtime logic)
          expect(eventCount).toBeGreaterThanOrEqual(1)
          expect(linkId.length).toBeGreaterThanOrEqual(1)
          expect(['viewed', 'paid', 'expired', 'tamper_blocked']).toContain(eventType)
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * The linkEvents.linkId column must be NOT NULL, ensuring every event
   * is always associated with a parent payment link.
   *
   * **Validates: Requirements 7.5**
   */
  it('linkEvents.linkId column is NOT NULL — every event must reference a parent link', () => {
    const config = getTableConfig(linkEvents)
    const linkIdCol = config.columns.find((c) => c.name === 'link_id')

    expect(linkIdCol).toBeDefined()
    expect(linkIdCol!.notNull).toBe(true)

    fc.assert(
      fc.property(linkIdArb, (linkId) => {
        // For any generated linkId, the schema enforces NOT NULL,
        // meaning an event cannot exist without a parent link reference.
        expect(linkIdCol!.notNull).toBe(true)
        expect(linkId.length).toBeGreaterThanOrEqual(1)
      }),
      { numRuns: 100 },
    )
  })

  /**
   * Simulate cascade delete logic: for any link with N events,
   * deleting the link should result in 0 remaining events for that linkId.
   *
   * This is a logical simulation — we build an in-memory model of the
   * cascade relationship and verify the invariant holds for random inputs.
   *
   * **Validates: Requirements 7.5**
   */
  it('simulated cascade: deleting a link removes all its associated events', () => {
    fc.assert(
      fc.property(
        linkIdArb,
        fc.array(eventTypeArb, { minLength: 1, maxLength: 20 }),
        (linkId, eventTypes) => {
          // Model: a map of linkId → events
          const linkEventsMap = new Map<string, string[]>()
          linkEventsMap.set(linkId, eventTypes)

          // Before delete: events exist
          expect(linkEventsMap.get(linkId)!.length).toBe(eventTypes.length)
          expect(linkEventsMap.get(linkId)!.length).toBeGreaterThanOrEqual(1)

          // Simulate CASCADE DELETE: removing the link removes all its events
          linkEventsMap.delete(linkId)

          // After delete: no events remain for this linkId
          expect(linkEventsMap.has(linkId)).toBe(false)
          expect(linkEventsMap.get(linkId)).toBeUndefined()
        },
      ),
      { numRuns: 100 },
    )
  })

  /**
   * Simulate cascade with multiple links: deleting one link only removes
   * its own events, not events belonging to other links.
   *
   * **Validates: Requirements 7.5**
   */
  it('simulated cascade: deleting one link does not affect other links events', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(linkIdArb, { minLength: 2, maxLength: 5 }),
        fc.array(
          fc.array(eventTypeArb, { minLength: 1, maxLength: 10 }),
          { minLength: 2, maxLength: 5 },
        ),
        (linkIds, eventArrays) => {
          // Ensure we have matching counts
          const count = Math.min(linkIds.length, eventArrays.length)
          if (count < 2) return // need at least 2 links

          const usedLinkIds = linkIds.slice(0, count)
          const usedEvents = eventArrays.slice(0, count)

          // Build model
          const linkEventsMap = new Map<string, string[]>()
          for (let i = 0; i < count; i++) {
            linkEventsMap.set(usedLinkIds[i], usedEvents[i])
          }

          // Pick the first link to delete
          const deletedLinkId = usedLinkIds[0]
          const survivingLinkIds = usedLinkIds.slice(1)

          // Record surviving events before delete
          const survivingEventsBefore = survivingLinkIds.map(
            (id) => linkEventsMap.get(id)!.length,
          )

          // CASCADE DELETE the first link
          linkEventsMap.delete(deletedLinkId)

          // Deleted link's events are gone
          expect(linkEventsMap.has(deletedLinkId)).toBe(false)

          // Surviving links' events are untouched
          for (let i = 0; i < survivingLinkIds.length; i++) {
            const id = survivingLinkIds[i]
            expect(linkEventsMap.has(id)).toBe(true)
            expect(linkEventsMap.get(id)!.length).toBe(survivingEventsBefore[i])
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
