import { spawn, type ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';
import { GenericContainer, Network, Wait } from 'testcontainers';
import { MySqlContainer } from '@testcontainers/mysql';

import { FRONTEND_ORIGIN, FRONTEND_PORT } from './frontendUrl';

const FRONTEND_URL = FRONTEND_ORIGIN;
const FRONTEND_STARTUP_TIMEOUT = 60_000;

/**
 * Marker proving the server on FRONTEND_PORT is *this* app. A bare 200 is not enough: another
 * project's dev server answers 200 just as happily, and if it is also a Vite app then even
 * /@vite/client would match. This favicon path is unique to Léargon's index.html and is pure
 * ASCII, so it survives any encoding of the surrounding markup.
 */
const APP_IDENTITY_MARKER = '/LeargonFavicon.png';

/**
 * Fail before spawning anything if the port is taken. Vite is started with --strictPort, so it
 * exits rather than silently moving to 5174 — but on its own that only guarantees Vite is *not*
 * serving the port, and waitForFrontend() would then happily accept whatever is.
 *
 * This connects rather than binding: on Windows a bind to 127.0.0.1 succeeds even while another
 * process holds 0.0.0.0 on the same port, so a bind probe reports the port free when it is not.
 */
async function assertPortFree(port: number): Promise<void> {
  const inUse = await new Promise<boolean>((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const settle = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(2_000);
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false));
    socket.once('error', () => settle(false)); // ECONNREFUSED — nothing listening
  });

  if (inUse) {
    throw new Error(
      `Port ${port} is already in use, so the Vite dev server cannot start there. ` +
        'Another project is probably running on it. Set E2E_FRONTEND_PORT to a free ' +
        'port and re-run, e.g. E2E_FRONTEND_PORT=5199 npm run test:e2e',
    );
  }
}

/**
 * `hasExited` lets the poll loop give up the moment Vite dies instead of burning the full
 * startup timeout, and the identity check stops us adopting a stranger's dev server.
 */
async function waitForFrontend(hasExited: () => number | null | undefined): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < FRONTEND_STARTUP_TIMEOUT) {
    const exitCode = hasExited();
    if (exitCode !== undefined) {
      throw new Error(
        `Vite dev server exited (code ${exitCode}) before it became ready. ` +
          `Check the [vite] output above; if port ${FRONTEND_PORT} is taken, set E2E_FRONTEND_PORT.`,
      );
    }
    try {
      const res = await fetch(FRONTEND_URL);
      if (res.ok || res.status < 500) {
        const body = await res.text();
        if (body.includes(APP_IDENTITY_MARKER)) {
          return;
        }
        throw new Error(
          `Something is serving ${FRONTEND_URL}, but it is not the Léargon frontend ` +
            `(no "${APP_IDENTITY_MARKER}" in the response). Refusing to run the suite against ` +
            'another application. Set E2E_FRONTEND_PORT to a free port and re-run.',
        );
      }
    } catch (err) {
      // A failed identity check is fatal; a connection error just means "not up yet".
      if (err instanceof Error && err.message.includes(APP_IDENTITY_MARKER)) {
        throw err;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Frontend at ${FRONTEND_URL} did not become ready within ${FRONTEND_STARTUP_TIMEOUT}ms`);
}

/**
 * On Windows, kill('SIGTERM') only kills cmd.exe but not the child npm/node/vite tree.
 * Use taskkill /T to kill the whole process tree on Windows.
 */
async function stopViteProcess(viteProcess: ChildProcess): Promise<void> {
  if (process.platform === 'win32' && viteProcess.pid) {
    const { execSync } = await import('node:child_process');
    try {
      execSync(`taskkill /PID ${viteProcess.pid} /T /F`);
    } catch {
      /* already dead */
    }
  } else {
    viteProcess.kill('SIGTERM');
  }
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  // Checked first: starting MySQL and the backend takes ~30s, and there is no point paying that
  // only to discover the port is occupied.
  await assertPortFree(FRONTEND_PORT);

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
      DB_URL:
        'jdbc:mysql://mysql:3306/leargon?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true',
      DB_USERNAME: 'leargon',
      DB_PASSWORD: 'leargon',
      DATASOURCES_DEFAULT_URL:
        'jdbc:mysql://mysql:3306/leargon?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true',
      DATASOURCES_DEFAULT_USERNAME: 'leargon',
      DATASOURCES_DEFAULT_PASSWORD: 'leargon',
      JWT_SECRET: 'e2etestsecretkeythatisverylong32characters',
      // Raise token lifetime to 4h so a long e2e run never trips the default 1h expiry (test env only).
      MICRONAUT_SECURITY_TOKEN_JWT_GENERATOR_ACCESS_TOKEN_EXPIRATION: '14400',
      ADMIN_EMAIL: 'admin@e2e-test.local',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'AdminPass123!',
    })
    .withWaitStrategy(
      Wait.forHttp('/health', 8080).forStatusCode(200).withStartupTimeout(300_000),
    )
    .start();

  const backendUrl = `http://${backend.getHost()}:${backend.getMappedPort(8080)}`;
  console.log(`[E2E] Backend ready at ${backendUrl}`);

  process.env.E2E_BACKEND_URL = backendUrl;

  console.log('[E2E] Starting Vite dev server...');
  const viteProcess: ChildProcess = spawn('npm', ['run', 'dev', '--', '--port', String(FRONTEND_PORT), '--strictPort'], {
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

  // undefined while running; the exit code (or null, if killed by a signal) once it has exited.
  let viteExitCode: number | null | undefined;
  viteProcess.on('exit', (code) => {
    viteExitCode = code;
  });

  console.log('[E2E] Waiting for frontend to become ready...');
  try {
    await waitForFrontend(() => viteExitCode);
  } catch (err) {
    // Playwright never calls the teardown callback if globalSetup throws, so a failed readiness
    // check would otherwise strand the MySQL and backend containers on the developer's machine.
    console.error('[E2E] Frontend never became ready — tearing down containers.');
    await stopViteProcess(viteProcess);
    await backend.stop().catch(() => undefined);
    await mysql.stop().catch(() => undefined);
    await network.stop().catch(() => undefined);
    throw err;
  }
  console.log('[E2E] Frontend ready at', FRONTEND_URL);

  return async () => {
    console.log('[E2E] Stopping Vite dev server...');
    await stopViteProcess(viteProcess);

    console.log('[E2E] Stopping containers...');
    await backend.stop();
    await mysql.stop();
    await network.stop();
    console.log('[E2E] Cleanup complete.');
  };
}
