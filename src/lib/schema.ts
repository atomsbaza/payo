// src/lib/schema.ts
import {
  pgTable, uuid, text, integer, boolean,
  timestamp, bigint, jsonb, unique, primaryKey,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id:          uuid('id').primaryKey().defaultRandom(),
  address:     text('address').notNull().unique(),
  username:    text('username').unique(),
  ensName:     text('ens_name'),
  ensCachedAt: timestamp('ens_cached_at', { withTimezone: true }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeen:    timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
})

export const paymentLinks = pgTable('payment_links', {
  id:            uuid('id').primaryKey().defaultRandom(),
  linkId:        text('link_id').notNull().unique(),
  ownerAddress:  text('owner_address').notNull(),
  recipient:     text('recipient').notNull(),
  token:         text('token').notNull(),
  chainId:       integer('chain_id').notNull(),
  amount:        text('amount'),
  memo:          text('memo'),
  expiresAt:     timestamp('expires_at', { withTimezone: true }),
  signature:     text('signature').notNull(),
  viewCount:     integer('view_count').notNull().default(0),
  payCount:      integer('pay_count').notNull().default(0),
  singleUse:     boolean('single_use').notNull().default(false),
  isActive:      boolean('is_active').notNull().default(true),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const linkEvents = pgTable('link_events', {
  id:           uuid('id').primaryKey().defaultRandom(),
  linkId:       text('link_id').notNull()
                  .references(() => paymentLinks.linkId, { onDelete: 'cascade' }),
  eventType:    text('event_type').notNull(),
  payerAddress: text('payer_address'),
  txHash:       text('tx_hash'),
  ipHash:       text('ip_hash'),
  userAgent:    text('user_agent'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const transactions = pgTable('transactions', {
  id:              uuid('id').primaryKey().defaultRandom(),
  txHash:          text('tx_hash').notNull(),
  chainId:         integer('chain_id').notNull(),
  fromAddress:     text('from_address').notNull(),
  toAddress:       text('to_address').notNull(),
  value:           text('value').notNull(),
  tokenSymbol:     text('token_symbol'),
  tokenDecimal:    integer('token_decimal'),
  contractAddress: text('contract_address'),
  direction:       text('direction').notNull(),
  blockNumber:     bigint('block_number', { mode: 'number' }),
  timestamp:       timestamp('timestamp', { withTimezone: true }).notNull(),
  isError:         boolean('is_error').notNull().default(false),
  rawData:         jsonb('raw_data'),
  cachedAt:        timestamp('cached_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.txHash, t.chainId, t.direction),
}))

export const webhookRegistrations = pgTable('webhook_registrations', {
  id:              uuid('id').primaryKey().defaultRandom(),
  ownerAddress:    text('owner_address').notNull().unique(),
  webhookUrl:      text('webhook_url').notNull(),
  webhookSecret:   text('webhook_secret').notNull(),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
})

export const webhookLogs = pgTable('webhook_logs', {
  id:             uuid('id').primaryKey().defaultRandom(),
  ownerAddress:   text('owner_address').notNull(),
  eventType:      text('event_type').notNull(),
  payloadSummary: text('payload_summary'),
  httpStatus:     integer('http_status'),
  responseTimeMs: integer('response_time_ms'),
  success:        boolean('success').notNull(),
  errorMessage:   text('error_message'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const pushTokens = pgTable('push_tokens', {
  id:           uuid('id').primaryKey().defaultRandom(),
  ownerAddress: text('owner_address').notNull(),
  deviceToken:  text('device_token').notNull(),
  platform:     text('platform').notNull().default('ios'), // 'ios' only for now
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.ownerAddress, t.deviceToken),
}))

// Web Push (VAPID) subscriptions — one row per browser/device
export const pushSubscriptions = pgTable('push_subscriptions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  ownerAddress: text('owner_address').notNull(),
  endpoint:     text('endpoint').notNull(),
  p256dh:       text('p256dh').notNull(),
  auth:         text('auth').notNull(),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniq: unique().on(t.ownerAddress, t.endpoint),
}))

export const rateLimitLog = pgTable('rate_limit_log', {
  key:         text('key').notNull(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  count:       integer('count').notNull().default(1),
}, (t) => ({
  pk: primaryKey({ columns: [t.key, t.windowStart] }),
}))
