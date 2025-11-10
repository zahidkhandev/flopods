import path from 'path';
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Set proxy only if configured in .env
if (process.env.HTTP_PROXY) {
  process.env.HTTP_PROXY = process.env.HTTP_PROXY;
  process.env.HTTPS_PROXY = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  process.env.http_proxy = process.env.HTTP_PROXY;
  process.env.https_proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
}

import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: './prisma',
});
