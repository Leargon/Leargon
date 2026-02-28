import { spawn, type ChildProcess } from 'node:child_process';
import { GenericContainer, Network, Wait } from 'testcontainers';
import { MySqlContainer } from '@testcontainers/mysql';

const FRONTEND_URL = 'http://localhost:5173';
const FRONTEND_STARTUP_TIMEOUT = 60_000;

async function waitForFrontend(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < FRONTEND_STARTUP_TIMEOUT) {
    try {
      const res = await fetch(FRONTEND_URL);
      if (res.ok || res.status < 500) {
        return;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Frontend at ${FRONTEND_URL} did not become ready within ${FRONTEND_STARTUP_TIMEOUT}ms`);
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  console.log('[E2E] Creating Docker network...');
  const network = await new Network().start();

  console.log('[E2E] Starting MySQL 8.4 container...');
  const mysql = await new MySqlContainer('mysql:8.4')
    .withNetwork(network)
    .withNetworkAliases('mysql')
    .withDatabase('leargon')
    .withUsername('leargon')
    .withUserPassword('leargon')
    .withRootPassword('leargon')
    .start();

  console.log(`[E2E] MySQL ready (host port ${mysql.getPort()}). Starting backend container...`);
  const backend = await new GenericContainer('leargon-backend:e2e')
    .withNetwork(network)
    .withExposedPorts(8080)
    .withEnvironment({
      MICRONAUT_SERVER_PORT: '8080',
      DATASOURCES_DEFAULT_URL:
        'jdbc:mysql://mysql:3306/leargon?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true',
      DATASOURCES_DEFAULT_USERNAME: 'leargon',
      DATASOURCES_DEFAULT_PASSWORD: 'leargon',
      JWT_SECRET: 'e2etestsecretkeythatisverylong32characters',
      ADMIN_EMAIL: 'admin@e2e-test.local',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'AdminPass123!',
    })
    .withWaitStrategy(
      Wait.forHttp('/health', 8080).forStatusCode(200).withStartupTimeout(180_000),
    )
    .start();

  const backendUrl = `http://${backend.getHost()}:${backend.getMappedPort(8080)}`;
  console.log(`[E2E] Backend ready at ${backendUrl}`);

  process.env.E2E_BACKEND_URL = backendUrl;

  console.log('[E2E] Starting Vite dev server...');
  const viteProcess: ChildProcess = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    shell: true,
    env: {
      ...process.env,
      VITE_BACKEND_URL: backendUrl,
    },
    stdio: 'pipe',
  });

  viteProcess.stdout?.on('data', (data: Buffer) => {
    process.stdout.write(`[vite] ${data}`);
  });
  viteProcess.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(`[vite] ${data}`);
  });

  console.log('[E2E] Waiting for frontend to become ready...');
  await waitForFrontend();
  console.log('[E2E] Frontend ready at', FRONTEND_URL);

  return async () => {
    console.log('[E2E] Stopping Vite dev server...');
    // On Windows, kill('SIGTERM') only kills cmd.exe but not the child npm/node/vite tree.
    // Use taskkill /T to kill the whole process tree on Windows.
    if (process.platform === 'win32' && viteProcess.pid) {
      const { execSync } = await import('node:child_process');
      try { execSync(`taskkill /PID ${viteProcess.pid} /T /F`); } catch { /* already dead */ }
    } else {
      viteProcess.kill('SIGTERM');
    }

    console.log('[E2E] Stopping containers...');
    await backend.stop();
    await mysql.stop();
    await network.stop();
    console.log('[E2E] Cleanup complete.');
  };
}
