/**
 * The external production database must not use Replit's reserved
 * DATABASE_URL secret name. Replit injects that name for its managed database
 * and flags a manually stored value during publishing.
 */
export const databaseUrl =
  process.env.EXTERNAL_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("EXTERNAL_DATABASE_URL must be set for the external database");
}