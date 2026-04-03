// src/lib/webhookPayload.ts — Webhook payload types & builder functions

export type WebhookEventType = 'payment_completed' | 'link_created' | 'link_deactivated' | 'test'

export type PaymentCompletedData = {
  payerAddress: string
  recipientAddress: string
  amount: string
  token: string
  chainId: number
  txHash: string
  memo: string
}

export type LinkCreatedData = {
  linkId: string
  recipientAddress: string
  token: string
  chainId: number
  amount: string
  memo: string
  singleUse: boolean
}

export type LinkDeactivatedData = {
  linkId: string
  reason: 'single_use_paid' | 'manual_deactivation'
}

export type TestData = {
  message: string
}

export type WebhookPayload = {
  event: WebhookEventType
  timestamp: string // ISO 8601
  linkId: string
  data: PaymentCompletedData | LinkCreatedData | LinkDeactivatedData | TestData
}

export function buildPaymentCompletedPayload(linkId: string, data: PaymentCompletedData): WebhookPayload {
  return {
    event: 'payment_completed',
    timestamp: new Date().toISOString(),
    linkId,
    data,
  }
}

export function buildLinkCreatedPayload(linkId: string, data: LinkCreatedData): WebhookPayload {
  return {
    event: 'link_created',
    timestamp: new Date().toISOString(),
    linkId,
    data,
  }
}

export function buildLinkDeactivatedPayload(linkId: string, data: LinkDeactivatedData): WebhookPayload {
  return {
    event: 'link_deactivated',
    timestamp: new Date().toISOString(),
    linkId,
    data,
  }
}

export function buildTestPayload(): WebhookPayload {
  return {
    event: 'test',
    timestamp: new Date().toISOString(),
    linkId: 'test',
    data: { message: 'Test webhook from Payo' },
  }
}
