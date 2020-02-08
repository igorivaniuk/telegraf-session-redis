import { Redis } from 'ioredis'
import { Context, ContextMessageUpdate, Middleware } from 'telegraf'
import { SessionOptions } from './interfaces'

const debug = require('debug')('telegraf:session-redis')

export class TelegrafSessionRedis {
  client: Redis
  options: SessionOptions

  constructor(options: SessionOptions) {
    this.options = Object.assign(
      {
        property: 'session',
        getSessionKey: (ctx: Context) => ctx.from && ctx.chat && `${ctx.from.id}:${ctx.chat.id}`,
        store: {}
      },
      options
    )

    this.client = this.options.client
  }

  async getSession(key: string): Promise<any> {
    let json = await this.client.get(key)
    if (!json) {
      return {}
    }
    try {
      const session = JSON.parse(json)
      debug('session state', key, session)
      return session
    } catch (error) {
      debug('Parse session state failed', error)
    }
    return {}
  }

  async clearSession(key: string): Promise<void> {
    debug('clear session', key)
    await this.client.del(key)
  }

  async saveSession(key: string, session: object): Promise<any> {
    if (!session || Object.keys(session).length === 0) {
      return this.clearSession(key).then(() => ({}))
    }
    if (this.options.ttl) {
      debug('session ttl', session)
      await this.client.setex(key, this.options.ttl, JSON.stringify(session))
    } else {
      debug('save session', key, session)
      await this.client.set(key, JSON.stringify(session))
    }
  }

  middleware(): Middleware<ContextMessageUpdate> {
    return async (ctx: ContextMessageUpdate, next: any) => {
      const key = this.options.getSessionKey!(ctx)
      if (!key) {
        return next()
      }
      let session = await this.getSession(key)
      debug('session snapshot', key, session)
      Object.defineProperty(ctx, this.options.property!, {
        get: function() {
          return session
        },
        set: function(newValue) {
          session = Object.assign({}, newValue)
        }
      })
      let rs = await next()
      await this.saveSession(key, session)
      return rs
    }
  }
}
