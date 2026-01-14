import axios, { AxiosInstance } from 'axios';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

export function createHttpClient(): AxiosInstance {
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;

  const client = axios.create({
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Flopods/1.0)',
    },
  });

  if (httpProxy || httpsProxy) {
    const proxyUrl = httpProxy || httpsProxy;

    if (!proxyUrl) {
      return client;
    }

    console.log(`[HTTP Client] 🔌 Proxy configured: ${proxyUrl}`);

    try {
      client.defaults.httpAgent = new HttpProxyAgent(proxyUrl);
      client.defaults.httpsAgent = new HttpsProxyAgent(proxyUrl);
      client.defaults.proxy = false;

      console.log('[HTTP Client] Proxy agents configured successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[HTTP Client] ❌ Failed to configure proxy: ${errorMessage}`);
    }
  } else {
    console.log('[HTTP Client] 🔌 No proxy configured (direct connection)');
  }

  return client;
}
