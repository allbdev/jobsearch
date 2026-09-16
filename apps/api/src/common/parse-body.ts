import { BadRequestException } from '@nestjs/common'
import type { z } from 'zod'

/** Validates a request body against a shared schema, as a 400 naming each field. */
export function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    throw new BadRequestException({
      message: 'invalid request body',
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    })
  }
  return parsed.data
}
