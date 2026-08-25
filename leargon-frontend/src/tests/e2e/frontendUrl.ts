/**
 * Where the e2e run expects the Vite dev server.
 *
 * Defaults to Vite's own 5173 so CI and a plain `npm run test:e2e` behave exactly as before. Set
 * `E2E_FRONTEND_PORT` when that port is already taken on the machine — otherwise Vite quietly moves
 * to the next free port and the whole suite drives whatever else is listening on 5173.
 */
export const FRONTEND_PORT: number = Number(process.env.E2E_FRONTEND_PORT ?? 5173);

export const FRONTEND_ORIGIN = `http://localhost:${FRONTEND_PORT}`;
