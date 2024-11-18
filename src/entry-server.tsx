// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";
import { installIntoGlobal } from "iterator-helpers-polyfill";

console.log(process.env);

installIntoGlobal();

export default createHandler(({ nonce }) => {
  return (
    <StartServer
      document={({ assets, children, scripts }) => {
        return (
          <html lang="en">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
              <meta property="csp-nonce" nonce={nonce} />
              {assets}
            </head>
            <body>
              {children}
              {scripts}
            </body>
          </html>
        );
      }} />
  );
}, event => {
  const nonce = crypto.randomUUID();
  const isDev = process.env.NODE_ENV === 'development';

  const base = `'self' 'nonce-${nonce}' ${isDev ? `'unsafe-eval'` : ''}`;

  const policies = {
    default: base,
    connect: `${base} ws://localhost:*`,
    script: `${base}`,
    style: `'self' data: https://fonts.googleapis.com 'unsafe-inline'`,
    // style: `${base} data: https://fonts.googleapis.com`,
    font: `${base} https://*.gstatic.com`,
  } as const;

  event.response.headers.append('Content-Security-Policy', Object.entries(policies).map(([p, v]) => `${p}-src ${v}`).join('; '))

  return { nonce };
});
