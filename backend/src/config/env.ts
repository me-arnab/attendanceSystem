import dotenv from 'dotenv';
dotenv.config();

/**
 * Validates the JWT_SECRET from environment variables.
 * Fails startup with an explicit error if missing or insecure.
 * Secrets are never exposed in logs or error messages.
 */
const validateJwtSecret = (secret?: string): string => {
  if (!secret || secret.trim() === '') {
    throw new Error(
      '[FATAL] JWT_SECRET environment variable is missing. A secure secret is required to start the server.'
    );
  }

  const trimmed = secret.trim();

  // Enforce minimum secure length (at least 32 characters for HMAC SHA-256)
  if (trimmed.length < 32) {
    throw new Error(
      '[FATAL] JWT_SECRET is insecure. The secret must be at least 32 characters long.'
    );
  }

  // Reject well-known insecure placeholder secrets
  const insecurePatterns = [
    'secret',
    'jwt_secret',
    'changeme',
    'change_me',
    'password',
    '12345678901234567890123456789012',
  ];
  if (insecurePatterns.includes(trimmed.toLowerCase())) {
    throw new Error(
      '[FATAL] JWT_SECRET is insecure. Do not use default or trivial secret values.'
    );
  }

  // If running in production mode, strictly reject development placeholder strings
  if (
    process.env.NODE_ENV === 'production' &&
    trimmed === 'super_secret_jwt_key_enterprise_attendance_2026'
  ) {
    throw new Error(
      '[FATAL] Insecure development JWT_SECRET detected in production environment. A strong, random production secret must be configured.'
    );
  }

  return trimmed;
};

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/attendance_saas',
  JWT_SECRET: validateJwtSecret(process.env.JWT_SECRET),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
};
