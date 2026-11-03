// server/src/rie/security/secretPatterns.js
//
// Regular expressions and heuristic rules for detecting secrets, credentials,
// and high-entropy sensitive tokens in repository files.
//
// Every pattern specifies:
//   - id: Unique rule identifier
//   - category: Human-readable category (e.g., "AWS Access Key", "GitHub Token")
//   - title: Human-readable finding title
//   - description: Explanation of risk
//   - severity: "Critical" | "High" | "Medium" | "Low"
//   - confidence: "High" | "Medium"
//   - regex: Regular expression with capture group for the secret value
//   - maskFn: Function to produce a safe, non-revealing masked representation
//   - recommendation: Remediation guidance

/**
 * Calculates Shannon entropy of a string: H = -sum(p * log2(p)).
 * Useful for heuristic detection of high-entropy cryptographic keys and tokens.
 *
 * @param {string} str
 * @returns {number}
 */
export function calculateShannonEntropy(str) {
  if (!str || typeof str !== "string") return 0;
  const len = str.length;
  if (len === 0) return 0;

  const frequencies = {};
  for (let i = 0; i < len; i++) {
    const char = str[i];
    frequencies[char] = (frequencies[char] || 0) + 1;
  }

  let entropy = 0;
  for (const char in frequencies) {
    const p = frequencies[char] / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Helper: Masks a secret string safely.
 * Reveals at most 4 prefix characters and 2-4 suffix characters (if length >= 12),
 * or fully masks with asterisks for shorter secrets.
 *
 * @param {string} secret
 * @param {number} [prefixKeep=4]
 * @param {number} [suffixKeep=2]
 * @returns {string}
 */
export function maskSecretValue(secret, prefixKeep = 4, suffixKeep = 2) {
  if (!secret || typeof secret !== "string") return "****";
  const len = secret.length;
  if (len <= 8) return "****";
  if (len <= 14) {
    return `${secret.slice(0, 2)}****${secret.slice(-2)}`;
  }
  const prefix = secret.slice(0, prefixKeep);
  const suffix = secret.slice(-suffixKeep);
  return `${prefix}${"*".repeat(Math.min(len - prefixKeep - suffixKeep, 8))}${suffix}`;
}

export const SECRET_PATTERNS = [
  // 1. AWS Access Key ID
  {
    id: "aws-access-key-id",
    category: "AWS Access Key ID",
    title: "Hardcoded AWS Access Key ID Detected",
    description: "An active or hardcoded AWS Access Key ID was identified in the repository source code.",
    severity: "Critical",
    confidence: "High",
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    maskFn: (val) => maskSecretValue(val, 4, 4),
    recommendation: "Rotate the exposed AWS key immediately in AWS IAM and store credentials in environment variables or AWS Secrets Manager.",
  },

  // 2. AWS Secret Access Key (context-aware pattern)
  {
    id: "aws-secret-access-key",
    category: "AWS Secret Access Key",
    title: "Hardcoded AWS Secret Access Key Detected",
    description: "A hardcoded 40-character AWS Secret Access Key was detected alongside its identifier.",
    severity: "Critical",
    confidence: "High",
    regex: /(?:aws_secret_access_key|aws_secret_key|secret_access_key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi,
    captureGroup: 1,
    maskFn: (val) => maskSecretValue(val, 2, 2),
    recommendation: "Revoke and rotate this secret key immediately in the AWS Console. Never commit cloud provider credentials.",
  },

  // 3. GitHub Personal Access Tokens (classic & fine-grained)
  {
    id: "github-pat",
    category: "GitHub Personal Access Token",
    title: "Hardcoded GitHub Personal Access Token (Classic)",
    description: "A GitHub Personal Access Token (ghp_) was discovered in the repository.",
    severity: "Critical",
    confidence: "High",
    regex: /\b(ghp_[0-9a-zA-Z]{36})\b/g,
    maskFn: (val) => maskSecretValue(val, 4, 4),
    recommendation: "Revoke this token immediately under GitHub Account Settings -> Developer Settings -> Personal Access Tokens.",
  },
  {
    id: "github-pat-fine-grained",
    category: "GitHub Fine-Grained Token",
    title: "Hardcoded GitHub Fine-Grained Personal Access Token",
    description: "A fine-grained GitHub token (github_pat_) was detected in source code.",
    severity: "Critical",
    confidence: "High",
    regex: /\b(github_pat_[0-9a-zA-Z_]{82})\b/g,
    maskFn: (val) => maskSecretValue(val, 11, 4),
    recommendation: "Revoke this token immediately in GitHub settings and check audit logs for unauthorized access.",
  },
  {
    id: "github-oauth",
    category: "GitHub OAuth Token",
    title: "Hardcoded GitHub OAuth/App Token",
    description: "A GitHub OAuth, user-to-server, or refresh token was detected in code.",
    severity: "Critical",
    confidence: "High",
    regex: /\b(gh[ousr]_[0-9a-zA-Z]{36})\b/g,
    maskFn: (val) => maskSecretValue(val, 4, 4),
    recommendation: "Revoke the OAuth credential and refresh token in GitHub Developer Applications.",
  },

  // 4. Private SSH / TLS / PGP Keys
  {
    id: "private-key-block",
    category: "Private Key",
    title: "Unencrypted Private Cryptographic Key Material",
    description: "A private key block (RSA, EC, DSA, or PGP) was discovered in plain text.",
    severity: "Critical",
    confidence: "High",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/g,
    maskFn: () => "-----BEGIN PRIVATE KEY [REDACTED]-----",
    recommendation: "Treat this private key as compromised. Regenerate new keypairs, update authorized_keys/certificates, and remove this file from Git history.",
  },

  // 5. Database Connection Strings with embedded credentials
  {
    id: "mongodb-connection-string",
    category: "Database Connection String (MongoDB)",
    title: "Hardcoded MongoDB URI with Credentials",
    description: "A MongoDB connection string containing embedded username and password was detected.",
    severity: "Critical",
    confidence: "High",
    regex: /\b(mongodb(?:\+srv)?:\/\/[^:\s]+:([^@\s]+)@[^\s"']+)/gi,
    captureGroup: 1,
    maskFn: (val) => val.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/i, "$1****$3"),
    recommendation: "Change the MongoDB database user password immediately in MongoDB Atlas and supply the URI strictly through environment variables.",
  },
  {
    id: "postgres-connection-string",
    category: "Database Connection String (PostgreSQL)",
    title: "Hardcoded PostgreSQL URI with Credentials",
    description: "A PostgreSQL connection string containing credentials was detected.",
    severity: "Critical",
    confidence: "High",
    regex: /\b(postgres(?:ql)?:\/\/[^:\s]+:([^@\s]+)@[^\s"']+)/gi,
    captureGroup: 1,
    maskFn: (val) => val.replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/i, "$1****$3"),
    recommendation: "Rotate the database password and inject credentials via standard DATABASE_URL environment variable.",
  },
  {
    id: "mysql-connection-string",
    category: "Database Connection String (MySQL)",
    title: "Hardcoded MySQL URI with Credentials",
    description: "A MySQL connection URI containing embedded user and password was detected.",
    severity: "Critical",
    confidence: "High",
    regex: /\b(mysql:\/\/[^:\s]+:([^@\s]+)@[^\s"']+)/gi,
    captureGroup: 1,
    maskFn: (val) => val.replace(/(mysql:\/\/[^:]+:)([^@]+)(@)/i, "$1****$3"),
    recommendation: "Rotate the MySQL user password and configure connection pooling using secret managers.",
  },
  {
    id: "redis-connection-string",
    category: "Database Connection String (Redis)",
    title: "Hardcoded Redis Connection String with Password",
    description: "A Redis connection string with an embedded authentication token was detected.",
    severity: "High",
    confidence: "High",
    regex: /\b(redis(?:s)?:\/\/(?:[^:\s]+:)?([^@\s]+)@[^\s"']+)/gi,
    captureGroup: 1,
    maskFn: (val) => val.replace(/(redis(?:s)?:\/\/(?:[^:]+:)?)([^@]+)(@)/i, "$1****$3"),
    recommendation: "Rotate the Redis AUTH password and use private networking/VPC peering.",
  },

  // 6. SaaS API Keys
  {
    id: "slack-token",
    category: "Slack Token",
    title: "Hardcoded Slack API Token",
    description: "A Slack bot or user access token was detected in the codebase.",
    severity: "High",
    confidence: "High",
    regex: /\b(xox[baprs]-[0-9a-zA-Z]{10,48})\b/g,
    maskFn: (val) => maskSecretValue(val, 5, 3),
    recommendation: "Revoke the token in your Slack App settings and re-install the application.",
  },
  {
    id: "stripe-secret-key",
    category: "Stripe Secret Key",
    title: "Hardcoded Stripe Live Secret Key",
    description: "A live Stripe secret key (sk_live_) was discovered in code.",
    severity: "Critical",
    confidence: "High",
    regex: /\b(sk_live_[0-9a-zA-Z]{24,99})\b/g,
    maskFn: (val) => maskSecretValue(val, 8, 4),
    recommendation: "Roll the secret key immediately in the Stripe Dashboard to prevent unauthorized financial operations.",
  },
  {
    id: "google-api-key",
    category: "Google API Key",
    title: "Hardcoded Google API Key",
    description: "A Google Cloud/API key (AIza...) was found hardcoded.",
    severity: "High",
    confidence: "High",
    regex: /\b(AIza[0-9A-Za-z\\-_]{35})\b/g,
    maskFn: (val) => maskSecretValue(val, 5, 4),
    recommendation: "Restrict the key in Google Cloud Console to specific APIs and HTTP referrers, or regenerate it.",
  },
  {
    id: "sendgrid-api-key",
    category: "SendGrid API Key",
    title: "Hardcoded SendGrid API Key",
    description: "A SendGrid transactional email API key was found in source files.",
    severity: "High",
    confidence: "High",
    regex: /\b(SG\.[a-zA-Z0-9_\-\.]{66})\b/g,
    maskFn: (val) => maskSecretValue(val, 5, 4),
    recommendation: "Delete this API key in SendGrid and create a new key with least-privilege permissions.",
  },
  {
    id: "twilio-api-key",
    category: "Twilio API Key",
    title: "Hardcoded Twilio API Key",
    description: "A Twilio API credential string was discovered.",
    severity: "High",
    confidence: "High",
    regex: /\b(SK[0-9a-fA-F]{32})\b/g,
    maskFn: (val) => maskSecretValue(val, 4, 4),
    recommendation: "Revoke the key in the Twilio Console and recreate it.",
  },

  // 7. JWT Tokens
  {
    id: "jwt-token",
    category: "JSON Web Token",
    title: "Hardcoded JSON Web Token (JWT)",
    description: "A hardcoded JSON Web Token was found in source code.",
    severity: "High",
    confidence: "High",
    regex: /\b(eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]+)\b/g,
    maskFn: (val) => maskSecretValue(val, 6, 6),
    recommendation: "Ensure JWTs are generated dynamically per session and never hardcoded in repository files.",
  },

  // 8. Hardcoded password or secret assignments
  {
    id: "hardcoded-credential-assignment",
    category: "Hardcoded Credential Assignment",
    title: "Hardcoded Credential or Secret Assignment",
    description: "A variable or property assignment containing password, secret_key, or auth_token was identified.",
    severity: "High",
    confidence: "Medium",
    regex: /(?:password|passwd|api_key|apikey|secret_key|auth_token)\s*[:=]\s*["']([^"'\s]{8,80})["']/gi,
    captureGroup: 1,
    filterFn: (val) => {
      const lower = val.toLowerCase();
      if (
        lower.startsWith("[redacted_secret:") ||
        lower.includes("placeholder") ||
        lower.includes("your-") ||
        lower.includes("example") ||
        lower.includes("change_me") ||
        lower.includes("todo") ||
        lower.includes("dummy") ||
        lower.includes("test") ||
        lower.startsWith("${") ||
        lower.startsWith("<")
      ) {
        return false;
      }
      return true;
    },
    maskFn: (val) => maskSecretValue(val, 2, 2),
    recommendation: "Extract credentials to environment variables or secret management services (e.g. AWS Secrets Manager, HashiCorp Vault).",
  },
];
