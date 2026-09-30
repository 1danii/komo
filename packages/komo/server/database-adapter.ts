import { DrizzleQueryError, type SQL } from "drizzle-orm";
import type { DatabaseOperations } from "./database-operations";

/** Database results keep affected-row counts for quota and invitation checks. */
export type DatabaseResult<Row = Record<string, unknown>> = {
  results: Row[];
  meta: { changes: number };
};

/** A deferred database statement can run alone or in an atomic batch. */
export interface DatabaseStatement<Row = Record<string, unknown>> {
  first(): Promise<Row | null>;
  execute(): Promise<DatabaseResult<Row>>;
}

/** Preserve the row type of each operation in an atomic batch. */
export type BatchResults<T extends readonly DatabaseStatement<unknown>[]> = {
  -readonly [K in keyof T]: T[K] extends DatabaseStatement<infer Row>
    ? DatabaseResult<Row>
    : never;
};

/** Internal database adapter; batches commit all statements or none on both engines. */
export interface KomoDatabase {
  readonly operations: DatabaseOperations;
  readonly dialect: "sqlite" | "postgres";
  readonly commentSequence: SQL;
  raw<Row = Record<string, unknown>>(statement: SQL): DatabaseStatement<Row>;
  batch<const T extends readonly DatabaseStatement<unknown>[]>(
    statements: T,
  ): Promise<BatchResults<T>>;
}

/** Platform bindings are normalized at the server boundary, never in route handlers. */
export type KomoBackendEnv = Omit<Env, "DB"> & { DB: KomoDatabase };

/** Preserve database constraint errors through Drizzle's query-error wrapper. */
export function databaseErrorCause(error: unknown): unknown {
  return error instanceof DrizzleQueryError && error.cause
    ? databaseErrorCause(error.cause)
    : error;
}
