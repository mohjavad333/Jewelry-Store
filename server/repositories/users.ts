import { db } from "../db";

export type User = { id: string; name: string; identifier: string; joinedAt: string };

type UserRow = {
  id: string;
  name: string;
  identifier: string;
  joined_at: string | Date;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    identifier: row.identifier,
    joinedAt: new Date(row.joined_at).toISOString(),
  };
}

export async function findUserById(id: string) {
  const result = await db.query<UserRow>("SELECT id, name, identifier, joined_at FROM users WHERE id = $1", [id]);
  return result.rows[0] ? toUser(result.rows[0]) : null;
}

export async function findUserByIdentifier(identifier: string) {
  const result = await db.query<UserRow>(
    "SELECT id, name, identifier, joined_at FROM users WHERE LOWER(identifier) = LOWER($1)",
    [identifier],
  );
  return result.rows[0] ? toUser(result.rows[0]) : null;
}

export async function listUsers() {
  const result = await db.query<UserRow>("SELECT id, name, identifier, joined_at FROM users ORDER BY joined_at DESC");
  return result.rows.map(toUser);
}

export async function createUser(input: Omit<User, "joinedAt">) {
  const result = await db.query<UserRow>(
    `INSERT INTO users (id, name, identifier)
     VALUES ($1, $2, $3)
     RETURNING id, name, identifier, joined_at`,
    [input.id, input.name, input.identifier],
  );
  return toUser(result.rows[0]);
}

export async function updateUserName(id: string, name: string) {
  const result = await db.query<UserRow>(
    `UPDATE users
     SET name = $1
     WHERE id = $2
     RETURNING id, name, identifier, joined_at`,
    [name, id],
  );
  return result.rows[0] ? toUser(result.rows[0]) : null;
}
