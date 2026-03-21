const crypto = require('crypto');
const { getConfig } = require('./config');

/** RFC 4648 base32 decode (authenticator secrets) */
function decodeBase32(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  const cleaned = String(secret)
    .replace(/=+$/, '')
    .toUpperCase()
    .replace(/\s/g, '');
  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx === -1) throw new Error('Invalid base32');
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** RFC 4226 HOTP → 6-digit string (SHA-1) */
function hotpCode(key, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 1000000).padStart(6, '0');
}

function getTotpSecret() {
  const env = (process.env.ADMIN_TOTP_SECRET || '').trim();
  if (env) return env;
  const v = getConfig('admin_totp_secret');
  return v ? String(v).trim() : null;
}

function isTotpEnabled() {
  const s = getTotpSecret();
  return !!s && s.length > 0;
}

/** RFC 6238 TOTP; ±1 step clock skew */
function verifyTotp(token) {
  if (!token) return false;
  const secretStr = getTotpSecret();
  if (!secretStr) return true;
  const clean = String(token).replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  let key;
  try {
    key = decodeBase32(secretStr);
  } catch {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  const step = 30;
  const counter = Math.floor(now / step);
  for (const delta of [-1, 0, 1]) {
    const c = counter + delta;
    if (c < 0) continue;
    if (hotpCode(key, c) === clean) return true;
  }
  return false;
}

module.exports = {
  getTotpSecret,
  isTotpEnabled,
  verifyTotp
};
