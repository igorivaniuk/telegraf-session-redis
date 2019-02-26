import { RedisClient } from 'redis'
import { Context, ContextMessageUpdate, Middleware } from 'telegraf'
import { ContextUpdate, RedisOptions } from './interfaces'

const debug = require('debug')('telegraf:session-redis')
const redis = require('redis')

export class TelegrafSessionRedis {
  client: RedisClient
  options: RedisOptions

  constructor(options: RedisOptions) {
    this.options = Object.assign(
      {
        property: 'session',
        getSessionKey: (ctx: Context) => ctx.from && ctx.chat && `${ctx.from.id}:${ctx.chat.id}`,
        store: {}
      },
      options
    )

    this.client = redis.createClient(this.options.store)
  }

  getSession(key: string): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      this.client.get(key, (err, json) => {
        if (err) {
          return reject(err)
        }
        if (json) {
          try {
            const session = JSON.parse(json)
            debug('session state', key, session)
            resolve(session)
          } catch (error) {
            debug('Parse session state failed', error)
          }
        }
        resolve({})
      })
    })
  }

  clearSession(key: string): Promise<void> {
    debug('clear session', key)
    return new Promise((resolve, reject) => {
      this.client.del(key, (err, json) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }

  async saveSession(key: string, session: object): Promise<any> {
    if (!session || Object.keys(session).length === 0) {
      return this.clearSession(key).then(() => ({}))
    }
    debug('save session', key, session)
    return new Promise((resolve, reject) => {
      this.client.set(key, JSON.stringify(session), (err, json) => {
        if (err) {
          return reject(err)
        }
        if (this.options.ttl) {
          debug('session ttl', session)
          this.client.expire(key, this.options.ttl)
        }
        resolve({})
      })
    })
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
