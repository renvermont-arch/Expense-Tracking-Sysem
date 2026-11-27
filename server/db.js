import fs from 'node:fs';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const dbName = process.env.DB_NAME || 'expense_tracker';
const baseConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
};

let pool;

export function getPool() {
  if (!pool) throw new Error('Database is not initialized yet.');
  return pool;
}

export async function initDb() {
  // Connect without a database first so we can create it if needed.
  const bootstrap = mysql.createPool({ ...baseConfig, multipleStatements: true });
  await bootstrap.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName.replace(/[^a-zA-Z0-9_]/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await bootstrap.end();

  pool = mysql.createPool({ ...baseConfig, database: dbName, multipleStatements: true, dateStrings: true });

  const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);

  // Add the General/Personal column to databases created by older versions.
  const [columns] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'scope'`,
    [dbName],
  );
  if (!columns.length) {
    await pool.query(
      "ALTER TABLE sessions ADD COLUMN scope VARCHAR(20) NOT NULL DEFAULT 'general'",
    );
  }
}
