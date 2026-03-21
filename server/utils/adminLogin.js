const { authenticator } = require('otplib');
const { getConfig } = require('./config');

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

function verifyTotp(token) {
  if (!token) return false;
  const secret = getTotpSecret();
  if (!secret) return true;
  const clean = String(token).replace(/\s/g, '');
  return authenticator.verify({ token: clean, secret });
}

module.exports = {
  getTotpSecret,
  isTotpEnabled,
  verifyTotp
};
