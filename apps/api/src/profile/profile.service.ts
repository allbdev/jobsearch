import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { Profile as ProfileRow, PrismaClient, User } from '@jobsearch/db'
import type { Profile } from '@jobsearch/shared'
import { profileInputSchema, profileSchema } from '@jobsearch/shared'
import { PRISMA } from '../prisma/prisma.module'

type ValidProfile = ReturnType<typeof profileInputSchema.parse>

@Injectable()
export class ProfileService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /**
   * 404 with a reason when there is none yet: a new account with no profile is
   * normal (#44), and the web needs to tell it apart from a failure to offer the
   * form rather than an error.
   */
  async get(user: User): Promise<Profile> {
    const row = await this.prisma.profile.findUnique({ where: { userId: user.id } })
    if (!row) throw new NotFoundException({ message: 'no profile yet', reason: 'no_profile' })
    return toProfile(row, user)
  }

  /** Creates or replaces the whole profile: the screen saves every field at once. */
  async put(user: User, input: ValidProfile): Promise<Profile> {
    const data = toData(input)
    const row = await this.prisma.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    })
    return toProfile(row, user)
  }
}

function toData(input: ValidProfile) {
  const { digest, minCompensation, ...rest } = input
  return {
    ...rest,
    // Whole units on the wire, minor units in the database (#44).
    minCompensation: minCompensation === null ? null : Math.round(minCompensation * 100),
    digestCadence: digest.cadence,
    digestSendOn: digest.sendOn,
    digestSendAt: digest.sendAt,
    digestLanguage: digest.language,
  }
}

function toProfile(row: ProfileRow, user: User): Profile {
  return profileSchema.parse({
    residenceCountry: row.residenceCountry,
    timezone: row.timezone,
    targetRegions: row.targetRegions,
    languages: row.languages,
    jobFamilies: row.jobFamilies,
    targetRoles: row.targetRoles,
    seniority: row.seniority,
    skills: row.skills,
    contractModels: row.contractModels,
    minCompensation: row.minCompensation === null ? null : row.minCompensation / 100,
    currency: row.currency,
    email: user.email,
    interfaceLanguage: row.interfaceLanguage,
    digest: {
      cadence: row.digestCadence,
      sendOn: row.digestSendOn,
      sendAt: row.digestSendAt,
      language: row.digestLanguage,
    },
  })
}
