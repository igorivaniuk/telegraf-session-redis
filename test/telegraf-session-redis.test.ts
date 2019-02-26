import Telegraf, { ContextMessageUpdate } from 'telegraf'
import { TelegrafSessionRedis } from '../src'

describe('TelegrafSessionRedis', () => {
  let app = new Telegraf<ContextMessageUpdate & { session: any }>('')
  let session: TelegrafSessionRedis
  let update = { message: { chat: { id: 1 }, from: { id: 1 }, text: 'hey' } } as any
  const key = '1:1'
  beforeAll(async () => {
    session = new TelegrafSessionRedis({
      store: {
        host: process.env.TELEGRAM_SESSION_HOST || '127.0.0.1',
        port: process.env.TELEGRAM_SESSION_PORT || 6379
      },
      ttl: 100
    })
    await session.clearSession(key)
  })

  afterAll(() => {
    session.client.quit()
  })

  it('should be defined', async done => {
    app.on('text', session.middleware(), ctx => {
      expect('session' in ctx).toBe(true)
      done()
    })
    await app.handleUpdate(update)
  })

  it('should retrieve and save session', async done => {
    let res = await session.getSession(key)
    expect(res).toEqual({})
    res.foo = 42
    await session.saveSession(key, res)

    let app = new Telegraf<ContextMessageUpdate & { session: any }>('')

    app.use(session.middleware(), async (ctx, next: any) => {
      ctx.session.bar = 101
      await next()
      done()
    })
    await app.handleUpdate(update)

    res = await session.getSession(key)
    expect(res).toEqual({ foo: 42, bar: 101 })
  })

  it('should replace session', async () => {
    let app = new Telegraf<ContextMessageUpdate & { session: any }>('')

    app.use(session.middleware(), async (ctx, next: any) => {
      ctx.session = { test: 1, user: 2 }
      await next()
    })
    await app.handleUpdate(update)
    let res = await session.getSession(key)
    expect(res).toEqual({ test: 1, user: 2 })
  })

  it('should handle existing session', async done => {
    app = new Telegraf<ContextMessageUpdate & { session: any }>('')
    app.use(session.middleware(), ctx => {
      expect('session' in ctx).toBe(true)
      expect(ctx.session.test).toBe(1)
      expect(ctx.session.user).toBe(2)
      done()
    })
    await app.handleUpdate(update)
  })

  it('should handle not existing session', async done => {
    app = new Telegraf<ContextMessageUpdate & { session: any }>('')
    await session.clearSession(key)
    app.on('text', session.middleware(), ctx => {
      expect('session' in ctx).toBe(true)
      expect('foo' in ctx.session).toBe(false)
      done()
    })
    await app.handleUpdate(update)
  })
})
