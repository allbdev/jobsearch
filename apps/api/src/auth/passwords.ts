import { hash, verify } from '@node-rs/argon2'

/**
 * argon2id at OWASP's recommended floor: 19 MiB, 2 iterations, 1 lane. The
 * library's default algorithm is argon2id; the PHC string records all of this,
 * so raising the cost later leaves existing hashes verifiable.
 */
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 }

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS)
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password)
}

let dummy: Promise<string> | undefined

/**
 * Spends the same work as a real verification, for an email with no password.
 *
 * Without it, "no such account" answers in a millisecond and "wrong password"
 * in tens of them, and the difference tells anyone which addresses are
 * registered -- whatever the error message says.
 */
export async function verifyAgainstNothing(password: string): Promise<false> {
  dummy ??= hashPassword('not a real password, only a timing equaliser')
  await verify(await dummy, password)
  return false
}
