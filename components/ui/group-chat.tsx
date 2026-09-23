"use client";

import { Blobatar } from "@blobatar/react";
import type { BlobatarOptions } from "blobatar";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  /** The seed and the display name. Use an id and pass `title` if the two differ. */
  name: string;
  /** Shown instead of `name`. The face still comes from `name`. */
  title?: string;
  text: string;
  /** Already formatted, for the same reason `User.lastSeen` is. */
  time?: string;
};

export type GroupChatProps = {
  messages: ChatMessage[];
  /** The room. Rendered with a `#` in front of it, Slack-style. */
  channel?: string;
  /** Faces for the header, overlapping. Names, not messages. */
  members?: string[];
  /** How many members the pile is not showing. */
  extra?: number;
  /** Whoever is mid-message. Renders the trailing indicator. */
  typing?: string;
  /**
   * Passed to every face in the thread, the pile and the indicator. A house
   * style is a property of the room, not of each message: two people drawn
   * under different rules read as two products.
   */
  blobatar?: BlobatarOptions;
  className?: string;
};

/** Consecutive messages from one person become one group with one face. */
function grouped(messages: ChatMessage[]): ChatMessage[][] {
  return messages.reduce<ChatMessage[][]>((runs, message) => {
    const last = runs.at(-1);
    if (last && last[0]!.name === message.name) last.push(message);
    else runs.push([message]);
    return runs;
  }, []);
}

export function GroupChat({
  messages,
  channel,
  members,
  extra,
  typing,
  blobatar,
  className,
}: GroupChatProps) {
  const runs = grouped(messages);

  return (
    <div
      className={cn(
        "bg-card text-card-foreground border-border flex w-full flex-col rounded-xl border",
        className,
      )}
    >
      {(channel || members?.length) && (
        <div className="border-border flex items-center justify-between gap-4 border-b px-5 py-3">
          {channel ? (
            <span className="font-mono text-sm">
              <span className="text-muted-foreground">#</span> {channel}
            </span>
          ) : (
            <span />
          )}

          {/*
            The facepile, and the ring is what makes it one. Blobatars are
            transparent-backdrop silhouettes, so two overlapping bare ones merge
            into a single unreadable blob; `background="circle"` plus a ring in
            the card's own colour is what separates each disc from the one
            behind it. That is also why this component sets an opaque `bg-card`
            rather than a translucent surface: the ring has to match something.
          */}
          {members?.length ? (
            <div className="flex items-center" aria-hidden="true">
              {members.map(member => (
                <Blobatar
                  key={member}
                  name={member}
                  background="circle"
                  {...blobatar}
                  alt=""
                  className="ring-card -ml-2 size-7 rounded-full ring-2 first:ml-0"
                />
              ))}
              {extra ? (
                <span className="bg-accent text-muted-foreground ring-card -ml-2 grid size-7 place-items-center rounded-full font-mono text-[0.6rem] ring-2">
                  +{extra}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-5 px-5 py-5">
        {runs.map(run => (
          <div
            // The run's identity, not its author's: one person speaking twice
            // in a thread is two runs, and keying on the name alone would make
            // React reuse the first one's nodes for the second.
            key={`${run[0]!.name}-${run[0]!.time ?? ""}-${run.length}`}
            className="flex gap-3"
          >
            {/*
              `animate="hover"` is affordable here and would not be in the user
              table: a thread is a dozen faces, not a page of them, and the
              reaction lands on the one you are pointing at. It needs the
              library's stylesheet, imported once anywhere in your app:
              `import "blobatar/motion.css"`. Without it the face is correct and
              simply does not move.
            */}
            <Blobatar
              name={run[0]!.name}
              {...blobatar}
              animate="hover"
              title={`${run[0]!.title ?? run[0]!.name}`}
              className="size-10 shrink-0"
            />

            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">
                  {run[0]!.title ?? run[0]!.name}
                </span>
                {run[0]!.time ? (
                  <span className="text-muted-foreground font-mono text-[0.7rem]">
                    {run[0]!.time}
                  </span>
                ) : null}
              </div>

              {/* Every message in the run under one name, which is the whole
                  reason to group them. Repeating the sender on each line is
                  what makes a real chat log unreadable. */}
              <div className="mt-1 flex flex-col gap-1">
                {run.map(message => (
                  <p
                    key={message.text}
                    className="text-muted-foreground text-sm leading-relaxed"
                  >
                    {message.text}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}

        {typing ? (
          <div className="flex items-center gap-3">
            {/*
              Bare, like every other face in the thread. The disc that used to
              be here made the person who is mid-message look like a different
              kind of thing from the person who just posted, which is the one
              impression this row must not give: it is the same person, a
              moment earlier. Opacity is the whole difference.
            */}
            <Blobatar
              name={typing}
              {...blobatar}
              alt=""
              className="size-10 shrink-0 opacity-50"
            />
            {/* A live region, because the point of a typing indicator is that it
                arrives after you stopped looking. `polite`, so it waits for a
                gap rather than interrupting. */}
            <div
              aria-live="polite"
              className="text-muted-foreground flex items-center gap-2 text-xs"
            >
              {typing} is typing
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
