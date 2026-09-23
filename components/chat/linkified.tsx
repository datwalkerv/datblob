const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]}]/gi;

/** Renders plain text with http(s) links made clickable. Never interprets HTML. */
export function Linkified({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <a
        key={start}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        className="underline decoration-current/30 underline-offset-2 hover:decoration-current"
      >
        {match[0]}
      </a>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
