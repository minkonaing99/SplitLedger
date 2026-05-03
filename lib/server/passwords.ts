import { randomUUID, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto"

const KEY_LENGTH = 64
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1
} as const

export async function hashPassword(password: string): Promise<string> {
  const salt = randomUUID().replaceAll("-", "")
  const derivedKey = await scryptAsync(
    password,
    salt,
    KEY_LENGTH,
    SCRYPT_OPTIONS
  )

  return [
    "scrypt",
    String(SCRYPT_OPTIONS.N),
    String(SCRYPT_OPTIONS.r),
    String(SCRYPT_OPTIONS.p),
    salt,
    derivedKey.toString("base64")
  ].join("$")
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const parts = passwordHash.split("$")

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false
  }

  const [, n, r, p, salt, encodedHash] = parts
  const expected = Buffer.from(encodedHash, "base64")
  const actual = await scryptAsync(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p)
  })

  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function scryptAsync(
  password: string,
  salt: string,
  keyLength: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error)
        return
      }

      resolve(derivedKey)
    })
  })
}
