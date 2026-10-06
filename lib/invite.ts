const ID = "[A-Za-z0-9_-]{22}";
const BARE_ID = new RegExp(`^${ID}$`);
const IN_LINK = new RegExp(`(?:^|/)c/(${ID})(?![A-Za-z0-9_-])`);

/**
 * Pull a chat id out of whatever the user pasted: a full invite link
 * (any host, with or without protocol, query or hash), a `/c/<id>` path,
 * or a bare id. Only the id is used; navigation always stays on this site.
 */
export function extractChatId(input: string): string | null {
  const value = input.trim();
  if (BARE_ID.test(value)) return value;
  return IN_LINK.exec(value)?.[1] ?? null;
}
