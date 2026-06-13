import crypto from 'node:crypto';

export function nowIso() {
  return new Date().toISOString();
}

export function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomKey() {
  return `lsq_${crypto.randomBytes(24).toString('base64url')}`;
}

export function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

export function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}