const crypto = require('crypto');
const { getConfig, setConfig, deleteConfig } = require('./config');

const PREFIX = 'scrypt1';
const KEYLEN = 64;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(plain), salt, KEYLEN, SCRYPT_OPTS);
  return `${PREFIX}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyScrypt(plain, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  let hash;
  try {
    hash = crypto.scryptSync(String(plain), salt, KEYLEN, SCRYPT_OPTS);
  } catch {
    return false;
  }
  if (hash.length !== expected.length) return false;
  return crypto.timingSafeEqual(hash, expected);
}

function timingSafeEqualString(a, b) {
  const x = Buffer.from(String(a), 'utf8');
  const y = Buffer.from(String(b), 'utf8');
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

/**
 * Verify admin password: scrypt hash, legacy plaintext row, or default "admin" if unset.
 */
function verifyAdminPassword(plain) {
  const hash = getConfig('admin_password_hash');
  if (hash) {
    return verifyScrypt(plain, hash);
  }
  const legacy = getConfig('admin_password');
  if (legacy != null && legacy !== '') {
    return timingSafeEqualString(plain, legacy);
  }
  return timingSafeEqualString(plain, 'admin');
}

/**
 * After successful login: store scrypt hash and remove legacy plaintext row.
 */
function upgradePasswordToHashIfNeeded(plain) {
  if (getConfig('admin_password_hash')) return;
  setConfig('admin_password_hash', hashPassword(plain));
  deleteConfig('admin_password');
}

function setAdminPasswordFromPlain(plain) {
  setConfig('admin_password_hash', hashPassword(plain));
  deleteConfig('admin_password');
}

function sanitizeConfigForClient(raw) {
  const config = { ...raw };
  delete config.admin_password;
  delete config.admin_password_hash;
  const hasHash = !!getConfig('admin_password_hash');
  const legacy = getConfig('admin_password');
  const hasLegacy = legacy != null && String(legacy).length > 0;
  config.admin_password_configured = hasHash || hasLegacy;
  return config;
}

module.exports = {
  hashPassword,
  verifyAdminPassword,
  upgradePasswordToHashIfNeeded,
  setAdminPasswordFromPlain,
  sanitizeConfigForClient
};
