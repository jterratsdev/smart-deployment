import http from 'node:http';
import https from 'node:https';

const targetUrl = requiredUrl('CF_ACCESS_PROXY_TARGET_URL');
const clientId = requiredEnv('CF_ACCESS_CLIENT_ID');
const clientSecret = requiredEnv('CF_ACCESS_CLIENT_SECRET');
const listenHost = process.env.CF_ACCESS_PROXY_LISTEN_HOST || '127.0.0.1';
const listenPort = Number(process.env.CF_ACCESS_PROXY_LISTEN_PORT || '9010');

if (!Number.isInteger(listenPort) || listenPort <= 0) {
  throw new Error('CF_ACCESS_PROXY_LISTEN_PORT must be a positive integer');
}

const transport = targetUrl.protocol === 'https:' ? https : http;

const server = http.createServer((request, response) => {
  const upstreamUrl = new URL(request.url || '/', targetUrl);
  const headers = buildHeaders(request.headers, upstreamUrl);
  const upstreamRequest = transport.request(
    upstreamUrl,
    {
      method: request.method,
      headers,
    },
    (upstreamResponse) => {
      logUpstreamResponse(request, upstreamResponse);
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.statusMessage, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    }
  );

  upstreamRequest.on('error', (error) => {
    response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(`Cloudflare Access proxy upstream error: ${error.message}`);
  });

  request.pipe(upstreamRequest);
});

server.listen(listenPort, listenHost, () => {
  process.stdout.write(
    `Cloudflare Access proxy listening on http://${listenHost}:${listenPort} for ${targetUrl.origin}\n`
  );
});

function buildHeaders(sourceHeaders, upstreamUrl) {
  const headers = { ...sourceHeaders };
  delete headers.connection;
  delete headers.host;
  delete headers['proxy-connection'];
  delete headers['transfer-encoding'];

  headers.host = upstreamUrl.host;
  headers['CF-Access-Client-ID'] = clientId;
  headers['CF-Access-Client-Secret'] = clientSecret;

  return headers;
}

function logUpstreamResponse(request, upstreamResponse) {
  const status = upstreamResponse.statusCode || 0;
  if (status < 400) {
    return;
  }
  const details = {
    method: request.method,
    path: request.url,
    status,
    server: upstreamResponse.headers.server,
    contentType: upstreamResponse.headers['content-type'],
    cfRay: upstreamResponse.headers['cf-ray'],
    location: redactLocation(upstreamResponse.headers.location),
  };
  process.stderr.write(`Cloudflare Access proxy upstream non-success: ${JSON.stringify(details)}\n`);
}

function redactLocation(location) {
  if (!location) {
    return undefined;
  }
  try {
    const url = new URL(location, targetUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '[unparseable-location]';
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requiredUrl(name) {
  const value = requiredEnv(name);
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${name} must be an http or https URL`);
  }
  return url;
}
