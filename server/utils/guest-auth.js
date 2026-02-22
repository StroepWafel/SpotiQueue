const { getConfig } = require('./config');

function isConfigEnabled(key) {
  return getConfig(key) === 'true';
}

function isGithubOAuthConfigured() {
  return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

function isGoogleOAuthConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function getGuestAuthRequirements(fingerprint) {
  const requireGithubAuth = isConfigEnabled('require_github_auth');
  const requireGoogleAuth = isConfigEnabled('require_google_auth');

  const hasGithubAuth = !!fingerprint?.github_id;
  const hasGoogleAuth = !!fingerprint?.google_id;

  const needsGithubAuth = requireGithubAuth && !hasGithubAuth;
  const needsGoogleAuth = requireGoogleAuth && !hasGoogleAuth;

  return {
    requireGithubAuth,
    requireGoogleAuth,
    hasGithubAuth,
    hasGoogleAuth,
    needsGithubAuth,
    needsGoogleAuth,
    authRequired: needsGithubAuth || needsGoogleAuth,
    githubOAuthConfigured: isGithubOAuthConfigured(),
    googleOAuthConfigured: isGoogleOAuthConfigured()
  };
}

function sendAuthRequiredResponse(res, requirements) {
  const missing = [];
  if (requirements.needsGithubAuth) missing.push('GitHub');
  if (requirements.needsGoogleAuth) missing.push('Google');

  if (missing.length === 0) return;

  return res.status(401).json({
    error: `${missing.join(' or ')} authentication required.`,
    requires_github_auth: requirements.needsGithubAuth,
    requires_google_auth: requirements.needsGoogleAuth,
    github_oauth_configured: requirements.githubOAuthConfigured,
    google_oauth_configured: requirements.googleOAuthConfigured
  });
}

module.exports = {
  isGithubOAuthConfigured,
  isGoogleOAuthConfigured,
  getGuestAuthRequirements,
  sendAuthRequiredResponse
};
