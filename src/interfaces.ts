import { Redis } from 'ioredis'
import { Context } from 'telegraf'

export interface SessionOptions {
  // session expire seconds
  readonly ttl?: number
  readonly property?: string
  readonly client: Redis
  readonly getSessionKey?: (ctx: Context) => any
}

export type ContextUpdate = (ctx: any, next: () => any) => any
