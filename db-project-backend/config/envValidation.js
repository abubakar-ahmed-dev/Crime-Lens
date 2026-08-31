/**
 * Environment Variable Validation
 *
 * Validates all required environment variables on server start.
 * Throws an error if any required variables are missing.
 */

const requiredEnvVars = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'JWT_SECRET',
];

const optionalEnvVars = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'CORS_ORIGINS',
  'PORT',
  'NODE_ENV',
  'REDIS_URL',
];

/**
 * Validate all required environment variables
 * @throws {Error} If any required environment variable is missing
 */
export function validateEnv() {
  const missing = [];
  const usingDefaults = [];

  // Check required variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  // Check optional variables and warn if using defaults
  if (!process.env.PORT) {
    usingDefaults.push('PORT (will use default: 5001)');
  }
  if (!process.env.CORS_ORIGINS) {
    usingDefaults.push('CORS_ORIGINS (will use default: http://localhost:5173)');
  }
  if (!process.env.REDIS_URL) {
    usingDefaults.push('REDIS_URL (will use default: redis://localhost:6379)');
  }
  // if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  //   usingDefaults.push('SUPABASE_SERVICE_ROLE_KEY (admin features limited)');
  // }

  // Throw if required vars are missing
  if (missing.length > 0) {
    throw new Error(
      `❌ Missing required environment variables:\n  - ${missing.join('\n  - ')}\n\n` +
      `Please set these variables in your .env file before starting the server.`
    );
  }

  // Warn about defaults
  if (usingDefaults.length > 0) {
    console.warn('⚠️  Using default values for:\n  - ' + usingDefaults.join('\n  - '));
  }

  // Log validation success (only in development)
  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ Environment variables validated successfully');
  }
}

/**
 * Get a configuration object with all validated env vars
 */
export function getConfig() {
  validateEnv();

  return {
    supabase: {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    jwt: {
      secret: process.env.JWT_SECRET,
    },
    database: {
      url: process.env.DATABASE_URL,
    },
    server: {
      port: parseInt(process.env.PORT || '5001', 10),
      env: process.env.NODE_ENV || 'development',
      corsOrigins: process.env.CORS_ORIGINS || 'http://localhost:5173',
    },
  };
}

export default { validateEnv, getConfig };
