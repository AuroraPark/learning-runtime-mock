import dotenv from 'dotenv';

dotenv.config();

const requiredEnv = ['FEATURE_FLAG_API_URL', 'API_KEY'] as const;

for (const name of requiredEnv) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const normalizedBaseUrl = (process.env.FEATURE_FLAG_API_URL as string)
  .replace(/\/+$/, '')
  .replace(/\/api\/v1$/i, '')
  .replace(/\/api$/i, '');

export const config = {
  port: Number(process.env.PORT || 3000),
  featureFlagApiUrl: normalizedBaseUrl,
  apiKey: process.env.API_KEY as string,
  lkgMaxAgeMs: Number(process.env.LKG_MAX_AGE_MS || 300000)
};
