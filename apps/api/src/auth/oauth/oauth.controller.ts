import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common'
import { OAuth2RequestError } from 'arctic'
import type { SessionResponse } from '@jobsearch/shared'
import { oauthCallbackRequestSchema, oauthProviderSchema } from '@jobsearch/shared'
import { parseBody } from '../../common/parse-body'
import { AuthService } from '../auth.service'
import { OAuthService } from './oauth.service'
import type { ProviderClient } from './providers'
import { providerFromEnv } from './providers'

@Controller('auth/oauth')
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly auth: AuthService,
  ) {}

  @Get(':provider/start')
  start(@Param('provider') provider: string) {
    return this.client(provider).start()
  }

  @Post(':provider/callback')
  @HttpCode(200)
  async callback(@Param('provider') provider: string, @Body() body: unknown): Promise<SessionResponse> {
    const client = this.client(provider)
    const { code, codeVerifier } = parseBody(oauthCallbackRequestSchema, body)

    const identity = await client.identify(code, codeVerifier).catch((error: unknown) => {
      // A code that is expired, reused or forged is the user's problem to retry,
      // not a server error.
      if (error instanceof OAuth2RequestError) {
        throw new BadRequestException({ message: 'sign-in was not completed', reason: error.code })
      }
      throw error
    })
    return this.auth.startSession(await this.oauth.userFor(identity))
  }

  private client(provider: string): ProviderClient {
    const parsed = oauthProviderSchema.safeParse(provider)
    const client = parsed.success ? providerFromEnv(parsed.data) : null
    if (!client) throw new NotFoundException(`sign-in with ${provider} is not available`)
    return client
  }
}
