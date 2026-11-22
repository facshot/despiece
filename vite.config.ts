import { defineConfig, type Plugin } from 'vite';

// En desarrollo, /api/* lo atiende el mismo servidor de Vite con server/router.ts.
// En Vercel lo atiende api/index.ts.
function api(): Plugin {
  return {
    name: 'api-local',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          const { manejar } = (await server.ssrLoadModule('/server/router.ts')) as typeof import('./server/router');
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const tieneCuerpo = req.method !== 'GET' && req.method !== 'HEAD';
          const respuesta = await manejar(new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method, headers, body: tieneCuerpo ? Buffer.concat(chunks) : undefined,
          }));
          res.statusCode = respuesta.status;
          respuesta.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await respuesta.arrayBuffer()));
        } catch (e) {
          console.error(e);
          res.statusCode = 500;
          res.end('Error');
        }
      });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [api()],
  server: { watch: { ignored: ['**/.datos-locales/**'] } },
});
