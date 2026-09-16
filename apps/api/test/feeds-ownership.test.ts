import { randomUUID } from 'node:crypto'
import { NotFoundException } from '@nestjs/common'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { User } from '@jobsearch/db'
import { prisma } from '@jobsearch/db'
import { FeedsService } from '../src/feeds/feeds.service'

const run = randomUUID().slice(0, 8)
const feeds = new FeedsService(prisma)

describe.skipIf(!process.env.DATABASE_URL && !process.env.CI)('feeds belong to their owner', () => {
  let owner: User
  let stranger: User
  let feedId: string

  beforeAll(async () => {
    owner = await prisma.user.create({ data: { email: `feeds-test-${run}-owner@example.test` } })
    stranger = await prisma.user.create({ data: { email: `feeds-test-${run}-stranger@example.test` } })
    await prisma.profile.create({ data: { userId: owner.id, residenceCountry: 'BR', timezone: 'America/Sao_Paulo' } })
    feedId = (await prisma.feed.create({ data: { userId: owner.id, name: 'Everything', minCompensation: 9_000_000 } })).id
    await prisma.feed.create({ data: { userId: owner.id, name: 'Second' } })
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: `feeds-test-${run}-` } } })
    await prisma.$disconnect()
  })

  it('lists only the owner’s feeds, oldest first, with whole-unit compensation', async () => {
    const mine = await feeds.list(owner)
    expect(mine.map((feed) => feed.definition.name)).toEqual(['Everything', 'Second'])
    expect(mine[0]?.definition.minCompensation).toBe(90_000)
    expect(await feeds.list(stranger)).toEqual([])
  })

  it('counts matches the same way the feed itself does', async () => {
    const [listed] = await feeds.list(owner)
    const result = await feeds.result(feedId, owner, 'best_match', 1)
    expect(listed?.matchedCount).toBe(result.feed.matchedCount)
  })

  it('answers someone else’s feed exactly like a missing one', async () => {
    const foreign = await feeds.result(feedId, stranger, 'best_match', 1).catch((error: unknown) => error)
    const missing = await feeds.result('no-such-feed', stranger, 'best_match', 1).catch((error: unknown) => error)
    expect(foreign).toBeInstanceOf(NotFoundException)
    expect(missing).toBeInstanceOf(NotFoundException)
    expect((foreign as Error).message.replace(feedId, 'ID')).toBe((missing as Error).message.replace('no-such-feed', 'ID'))
  })
})
