/**
 * This project intentionally uses its external PostgreSQL database.
 * Keep this separate from Replit's reserved DATABASE_URL so publishing
 * cannot silently switch the app to a different database.
 */
export const databaseUrl = process.env.EXTERNAL_DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("EXTERNAL_DATABASE_URL must be set for the external database");
}