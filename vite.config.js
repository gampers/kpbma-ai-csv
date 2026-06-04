import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

// A simple plugin to simulate the Vercel serverless function in local development
function localApiPlugin() {
  return {
    name: 'local-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url.startsWith('/api/sync') && req.method === 'POST') {
          let gasApiUrl = process.env.GAS_API_URL;
          
          if (!gasApiUrl) {
            // Try loading from .env file manually
            const envPath = resolve(process.cwd(), '.env');
            if (fs.existsSync(envPath)) {
              const envContent = fs.readFileSync(envPath, 'utf8');
              const match = envContent.match(/^GAS_API_URL\s*=\s*["']?(.*?)["']?$/m);
              if (match) {
                gasApiUrl = match[1];
              }
            }
          }

          if (!gasApiUrl) {
            // Fallback default
            gasApiUrl = "https://script.google.com/macros/s/AKfycbyspIGIBNc-erhvFKSgfRcjFduPT576G2SqR8T-jWYCjdPMfnI0Je00Ax53UOOb5h3Mog/exec";
          }

          try {
            let bodyStr = '';
            req.on('data', chunk => {
              bodyStr += chunk;
            });

            req.on('end', async () => {
              try {
                const response = await fetch(gasApiUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                  },
                  body: bodyStr
                });
                const data = await response.json();
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
              } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  root: resolve(__dirname, './'),
  plugins: [localApiPlugin()],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
