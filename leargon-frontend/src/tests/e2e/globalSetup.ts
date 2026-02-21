import { GenericContainer, Network, Wait } from 'testcontainers';
import { MySqlContainer } from '@testcontainers/mysql';

let teardownFn: (() => Promise<void>) | undefined;

export async function setup() {
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

  teardownFn = async () => {
    console.log('[E2E] Stopping containers...');
    await backend.stop();
    await mysql.stop();
    await network.stop();
    console.log('[E2E] Cleanup complete.');
  };
}

export async function teardown() {
  await teardownFn?.();
}
