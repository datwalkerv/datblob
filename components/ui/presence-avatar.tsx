"use client";

import { Blobatar } from "@blobatar/react";
import type { BlobatarOptions } from "blobatar";
import { thinking } from "blobatar/expression";
import { cn } from "@/lib/utils";

/**
 * Four states, and no `busy`.
 *
 * `busy` was here and is gone on purpose. Against `thinking` it was the same
 * claim in a different colour — both mean "this person or agent is occupied
 * right now" — and a status vocabulary whose two middle values need a legend
 * to tell apart is a vocabulary with one value too many. What is left is three
 * facts about availability and one about activity, which is a distinction
 * somebody can actually read off a badge.
 */
export type PresenceState = "online" | "away" | "offline" | "thinking";

/**
 * What each state looks like and what it is called.
 *
 * The label is not decoration. A coloured dot is invisible to a screen reader
 * and ambiguous to anyone who does not already know the convention, so every
 * state carries the word as well and the word is what goes into the accessible
 * name below.
 *
 * `thinking` has no dot: it renders the three-dot indicator instead. It is the
 * one state that is about something in progress rather than about where
 * somebody is, and a loading indicator says that in a way no colour does.
 */
const PRESENCE: Record<PresenceState, { dot?: string; label: string }> = {
  online: { dot: "bg-emerald-500", label: "online" },
  away: { dot: "bg-amber-500", label: "away" },
  offline: { dot: "bg-zinc-600", label: "offline" },
  thinking: { label: "thinking" },
};

/**
 * How far past its own box the face is drawn. See the note in the component.
 *
 * A transform rather than a bigger element, so the layout box is untouched and
 * nothing around it moves. It is also free of resolution cost: the picture is
 * an SVG either way.
 */
const OVERFLOW = "scale-[1.18]";

export type PresenceAvatarProps = {
  /**
   * Who this is for. A username, a display name, an email, an agent's handle,
   * a row id: any string, and the same string always renders the same face.
   */
  name: string;
  /** Defaults to `online`. `thinking` is the one that animates. */
  state?: PresenceState;
  /** Unread count. `0` and `undefined` both render nothing. */
  unread?: number;
  /**
   * What to call this person in the accessible name, when `name` is an id or
   * an email rather than something worth reading aloud.
   */
  label?: string;
  /**
   * Anything the generator takes: `hue`, `background`, `traits`, and the rest.
   *
   * Nested rather than spread onto this component, so that a prop added to the
   * library later cannot collide with a prop added here. It is also the seam
   * for a house style: `{ traits: { shape: [0.11, 0.54, 0.99] } }` keeps every
   * face in your product to three silhouettes while leaving colour, eyes and
   * everything else per name.
   */
  blobatar?: BlobatarOptions;
  className?: string;
};

export function PresenceAvatar({
  name,
  state = "online",
  unread,
  label,
  blobatar,
  className,
}: PresenceAvatarProps) {
  const presence = PRESENCE[state];
  const who = label ?? name;

  /*
   * No `background`, so what renders is the silhouette itself on whatever the
   * page is. A blobatar's body *is* the picture: a disc behind it turns ten
   * distinct outlines into ten circles with different fills, which throws away
   * the half of the identity you can read at 24px and across the room. Pass
   * `blobatar={{ background: "circle" }}` where the layout needs a disc, which
   * is mainly overlapping stacks, where two bare silhouettes would merge into
   * one shape.
   *
   * That is also why the badges below sit at the corners of the box rather than
   * on its edge: with no disc there is no edge, and a corner is the one place
   * on a bounding box that no silhouette reaches into.
   *
   * And it is why the face is drawn slightly larger than its own box. A
   * blobatar keeps a margin inside its viewBox so that no silhouette can touch
   * the frame, which is right for the picture and wrong for anything pinned to
   * a corner of it: the badge ends up floating in a gap with nothing under it,
   * reading as a separate object rather than as a mark on this face. Scaling
   * past the box closes the gap without changing the box, so a row of these
   * still lines up on the layout size rather than on how wide each creature
   * happens to be.
   *
   * The two branches exist because the adapter's props are a union: `animate`
   * turns the element from an `<img>` into an `<svg>`, and passing
   * `animate={undefined}` to satisfy both arms is exactly the thing the union
   * is shaped to refuse.
   */
  const face = (
    <Blobatar
      name={name}
      {...blobatar}
      /*
       * One element for every state now, where this used to be two. The branch
       * existed because `animate` decides whether the adapter renders an `<img>`
       * or an `<svg>`, and the props union follows the element: passing
       * `animate={undefined}` satisfies neither arm. With the prop constant
       * there is nothing left to branch on, and the expression rides on top.
       */
      animate="always"
      expression={state === "thinking" ? thinking : blobatar?.expression}
      // Decorative: the accessible name is on the wrapper, and a picture that
      // announced itself here would be read twice.
      aria-hidden="true"
      className={cn("size-full", OVERFLOW)}
    />
  );

  return (
    /*
     * One labelled node, not three. The face, the dot and the badge are one
     * fact about one person, and a screen reader that met them separately would
     * read "image, status, 3" with nothing tying the three together.
     */
    <span
      className={cn("relative inline-block size-10 shrink-0", className)}
      role="img"
      aria-label={
        unread
          ? `${who}, ${presence.label}, ${unread} unread`
          : `${who}, ${presence.label}`
      }
    >
      {face}

      {/*
        Top right, which is where a status light goes when the thing under it is
        not a rectangle. On a disc the conventional spot is bottom right, on the
        curve; on a bare silhouette that corner is under the widest part of most
        bodies, and a `sun` or a `cloud` puts a lobe straight through it.

        Sized as a percentage of the avatar rather than in pixels, which is the
        only version of this that survives being used at more than one size. A
        `size-3` dot is a quarter of a 48px face and a third of a 32px one: the
        same component reads as an avatar with a status light in one list and as
        a status light with an avatar behind it in the next.

        `ring-background` rather than a border: the ring is the page showing
        through, which separates the dot from whatever it overlaps without
        introducing a colour that has to be chosen per surface.
      */}
      {state === "thinking" ? (
        <span
          aria-hidden="true"
          /*
           * Under the face and centred, not in a corner, because it is not the
           * same kind of mark as the others. A presence dot is a property of
           * the person and belongs on them; this is a process running, and
           * underneath is where a caption goes. Centred also means it does not
           * have to dodge whichever silhouette it lands on.
           */
          className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-[3px]"
        >
          {/*
            Three dots rather than one pulsing light, because this is the only
            state that means "wait" and a loading indicator is the shape
            everybody already reads as waiting.

            The stagger is an inline style rather than a class, and that is a
            Tailwind fact rather than a preference: utilities are compiled from
            the class strings found in the source, so a delay interpolated into
            a class name is a class that was never generated. Duration is set
            here too, since `animate-pulse` runs at 2s, which reads as breathing
            rather than as loading.
          */}
          {[0, 1, 2].map(i => (
            <i
              key={i}
              /* `muted-foreground`, the colour of everything on a page that is
                 present but not being asserted. A blue light says "look here",
                 and a thing that is merely still working should not. */
              className="bg-muted-foreground size-1 animate-pulse rounded-full"
              style={{ animationDuration: "1.1s", animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "ring-background absolute top-0 right-0 h-[26%] w-[26%] rounded-full ring-2",
            presence.dot,
          )}
        />
      )}

      {/*
        The count takes the other corner, since the dot has this one now. They
        are two different questions anyway: the dot is about the person, the
        badge is about your inbox, and stacking them would make a 99+ pill
        swallow the state it is sitting on.
      */}
      {unread ? (
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground ring-background absolute -right-1 -bottom-1 grid h-5 min-w-5 place-items-center rounded-full px-1 font-mono text-[0.65rem] leading-none ring-2"
        >
          {/* Past two digits the badge stops being a count and starts being a
              layout problem. Anything over 99 is "lots", which is all the
              number was ever telling you. */}
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </span>
  );
}
