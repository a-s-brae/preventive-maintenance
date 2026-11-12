// Each person's own sign-in password, stored as a salted scrypt hash.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { PASSWORD_MAX_LENGTH } from "@/lib/forms";

const KEY_LENGTH = 32;
// scrypt cost (N=2^15, r=8): ~32 MB and tens of milliseconds per check.
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, PARAMS, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** "scrypt$<salt>$<key>", both base64. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${(await derive(password, salt)).toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key || password.length > PASSWORD_MAX_LENGTH) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Checked against when there's no account or no password, so a wrong email
// takes as long as a wrong password and doesn't give away who has an account.
let decoy: Promise<string> | undefined;
export async function verifyAgainstDecoy(password: string): Promise<false> {
  decoy ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await decoy);
  return false;
}
