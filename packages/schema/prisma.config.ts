import { defineConfig } from '@prisma/config';
import { resolve } from 'path';
import { config } from 'dotenv';

// 1. Force load .env from monorepo root
config({ path: resolve(__dirname, '../../.env') });

// 2. Proxy Setup
if (process.env.HTTP_PROXY) {
  process.env.https_proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  process.env.http_proxy = process.env.HTTP_PROXY;
}

export default defineConfig({
  schema: 'prisma',

  datasource: {
    url: process.env.DATABASE_URL,
  },
});
