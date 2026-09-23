"use client";

import { useCallback, useEffect, useRef, useState } from "react";
/* Imported rather than reached for through the `React` namespace, which is a
   global that happens to exist in this repo and may not in the project this
   file gets copied into. The sibling items do the same. */
import type { ComponentProps } from "react";
import { Blobatar } from "@blobatar/react";
import type { BlobatarOptions } from "blobatar";
import { useGaze } from "@blobatar/react/gaze";
import { sleepy } from "blobatar/expression";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The glyph a hidden field is measured with.
 *
 * The mirror below has to lay out what the input is *showing*, not what it
 * holds, and browsers draw the mask with their own character at their own
 * width. `•` is what Blink and WebKit use; Gecko draws `*`. The difference is
 * under a pixel per character at ordinary sizes and it lands on where a pair of
 * eyes on a 128px face are pointing, so it is not worth a per-engine table.
 * What matters is that the count is right, which it always is.
 */
const MASK = "•";

/**
 * Where the caret is, in client coordinates, or `null` if there isn't one.
 *
 * An `<input>` will not tell you this: it exposes `selectionStart` as an offset
 * into a string and nothing about geometry. So the text up to that offset is
 * laid out again in a hidden span wearing the input's own font, and its width
 * is how far along the caret sits.
 *
 * `white-space: pre` matters more than it looks. Without it the mirror collapses
 * runs of spaces and a password with two of them in a row measures short, which
 * is the kind of bug that only ever reproduces for the person who types like
 * that.
 */
function caretAt(input: HTMLInputElement): { x: number; y: number } | null {
  const i = input.selectionStart;
  if (i === null) return null;

  const cs = getComputedStyle(input);
  const mirror = document.createElement("span");
  mirror.style.cssText =
    "position:absolute;top:0;left:-9999px;visibility:hidden;white-space:pre";
  for (const p of [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "fontVariant",
    "letterSpacing",
    "textTransform",
  ] as const) {
    mirror.style[p] = cs[p];
  }
  mirror.textContent =
    input.type === "password" ? MASK.repeat(i) : input.value.slice(0, i);

  document.body.appendChild(mirror);
  const w = mirror.getBoundingClientRect().width;
  mirror.remove();

  const r = input.getBoundingClientRect();
  const inset =
    (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.paddingLeft) || 0);
  /* The far edge is where the *text* stops, not where the field does. The
     reveal toggle sits inside the box on 80px of padding, so clamping to the
     border edge would let the eyes aim at a strip of the field no caret can
     ever be in — a fifth of the field's width, on the side the eyes swing
     furthest to. */
  const stop =
    r.right -
    ((parseFloat(cs.borderRightWidth) || 0) + (parseFloat(cs.paddingRight) || 0));
  return {
    /* Clamped to the run of text, so a value longer than the box aims at the
       edge the caret is actually parked against rather than off into the page.
       The input scrolls its own content, which `scrollLeft` accounts for. */
    x: Math.min(Math.max(r.left + inset - input.scrollLeft + w, r.left + inset), stop),
    y: r.top + r.height / 2,
  };
}

export type PasswordFieldProps = Omit<
  ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** The seed for the face. Give it the account, so a person meets the same one. */
  name?: string;
  /**
   * Rendered size of the face in pixels.
   *
   * The excursion is in viewBox units, so it scales with this: a bigger face
   * does not merely draw the same gaze larger, it moves the eyes further in
   * pixels for the same angle. That is most of why the default is not small.
   */
  size?: number;
  /**
   * Passed to the face. A house style belongs here rather than on each usage:
   * `{ traits: { shape: [0.11] } }` pins the silhouette so a login screen and a
   * change-password screen show the same creature.
   */
  blobatar?: BlobatarOptions;
  /** The label above the field. */
  label?: string;
  className?: string;
};

export function PasswordField({
  name = "alain00",
  size = 160,
  blobatar,
  label = "Password",
  className,
  value,
  defaultValue,
  onValueChange,
  onFocus,
  onBlur,
  id,
  ...props
}: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  /*
   * Focus, not a keystroke timer, is what holds the eyes on the caret.
   *
   * The earlier version stood the caret branch down a beat after you stopped
   * typing, and the beat is the bug: a person stops to think mid-password, the
   * eyes leave the field for whatever the pointer is over, and the component
   * looks away exactly when the field still has the caret in it. A focused
   * password field is a field you are still in, so the eyes stay until you
   * leave it.
   */
  const [focused, setFocused] = useState(false);
  /* Uncontrolled by default, so the component is useful in a form that does not
     want to hold the password in React state at all. */
  const [own, setOwn] = useState(defaultValue ?? "");
  const text = value ?? own;

  /*
   * The hook rather than the driver directly, for the ref and the teardown.
   * `lookAt` is stable for the life of the component, so the callback below can
   * depend on it without churning.
   */
  const { ref: face, lookAt } = useGaze({
    /*
     * The excursion, in viewBox units, and what opts this blobatar into the
     * layer at all. Three is a little over twice the idle glance's widest stop:
     * a deliberate look at this size, and short of the eyes leaving the
     * silhouette.
     *
     * Given here rather than in a stylesheet because it is a fact about this
     * component rather than about the page it lands on, and a registry item is
     * copied into projects whose CSS it knows nothing about. The hook writes it
     * inline and remeasures, so the driver's write threshold follows it. A page
     * styling a whole field of blobatars wants the CSS property instead, which
     * inherits and can be made responsive.
     */
    travel: 16,
  });
  const input = useRef<HTMLInputElement>(null);
  const fieldId = id ?? "blobatar-password";

  /*
   * The driver is the hook's, created once when the blobatar mounts and torn
   * down when it leaves. It is deliberately not rebuilt when the state below
   * changes: it holds the eyes' current position, so a new one on every
   * keystroke would snap them to centre between every pair of letters. What
   * changes is only where it is pointed.
   */

  /** Point the eyes at whatever the current state says they should watch. */
  const aim = useCallback(() => {

    /*
     * Revealed: the eyes go to the middle and stay there.
     *
     * `"rest"` and not `null`, and the difference is the whole gag. Let go, the
     * blobatar would get its idle glance back and start looking around the room
     * on its own, which reads as a creature minding its own business rather
     * than as one pointedly not reading your screen. `"rest"` keeps the idle
     * saccade stood down, so the stillness is deliberate and legible as such.
     */
    if (shown) {
      lookAt("rest");
      return;
    }

    /* Focused: watch the caret, re-read whenever it may have moved. */
    if (focused && input.current) {
      const at = caretAt(input.current);
      if (at) {
        lookAt(at);
        return;
      }
    }

    /* Otherwise the pointer, which is the driver's own default. */
    lookAt("pointer");
  }, [shown, focused, lookAt]);

  useEffect(aim, [aim, text]);

  /*
   * The caret is in the page, so it moves when the page scrolls or reflows and
   * nothing about this component's state changes when it does. Only while
   * focused: the pointer branch is the driver's own business and it already
   * watches both of these for its own box.
   */
  useEffect(() => {
    if (!focused || shown) return;
    const on = () => aim();
    addEventListener("scroll", on, { passive: true, capture: true });
    addEventListener("resize", on, { passive: true });
    return () => {
      removeEventListener("scroll", on, { capture: true });
      removeEventListener("resize", on);
    };
  }, [focused, shown, aim]);

  /*
   * Re-aim after something that may have moved the caret without changing the
   * text. `aim` reads `selectionStart` off the DOM, which the browser has
   * already updated by the time these handlers run, so this is a straight call
   * rather than another piece of state for the effect above to chase.
   */
  const track = () => aim();

  return (
    /* `gap-4`, not `gap-6`: every pixel between the face and the field is drop
       the aim has to divide the caret's travel by, so the two being close is
       what makes the look legible as a look. */
    <div className={cn("flex w-full max-w-sm flex-col items-center gap-4", className)}>
      <Blobatar
        ref={face}
        /*
         * Spread first, so the two props below win.
         *
         * The other order is a bug that hides until somebody uses the prop:
         * `blobatar={{ expression: happy }}` would override the `sleepy` pose
         * on the branch that is the whole point of the component, and the field
         * would go on reading "Not looking" over a face that plainly was.
         */
        {...blobatar}
        name={name}
        size={size}
        animate="always"
        /*
         * The only state the face carries. `sleepy` is the library's own pose,
         * so this is a morph on a creature that was already breathing rather
         * than a swap to a second drawing.
         */
        expression={shown ? sleepy : blobatar?.expression}
      />

      <div className="w-full">
        <label htmlFor={fieldId} className="mb-2 block text-sm font-medium">
          {label}
        </label>

        {/* `relative` so the toggle can sit inside the field's own box. */}
        <div className="relative">
          <Input
            ref={input}
            id={fieldId}
            /*
             * A real `type="password"`, swapped rather than masked by hand.
             * Password managers, autofill and the browser's own "reveal" affordances
             * all key off this attribute, and a field that draws its own dots into a
             * text input is invisible to every one of them.
             */
            type={shown ? "text" : "password"}
            value={text}
            autoComplete="current-password"
            /*
             * Deliberately large, and the size is a functional decision rather
             * than a stylistic one.
             *
             * The eyes aim at the caret by *angle*, so what they can express is
             * how far the caret moves compared to how far away it is. At the
             * default field size that ratio is hopeless: 8px of caret travel
             * per keystroke against 150px of drop to the field moves a 128px
             * face's eye by 0.8px, which is a real gaze nobody can see. It read
             * as a broken feature and was measured as a working one.
             *
             * `text-2xl` and the tracking are what fix it, and the tracking
             * does most of the work: it is 0.3em of extra width per character,
             * so a keystroke is worth about 20px of caret rather than 8. Dots
             * want the air anyway — a run of `•` at normal tracking reads as a
             * smear rather than as a count of what you typed.
             *
             * `caretAt` copies `letterSpacing` onto its mirror, so the
             * measurement follows this automatically and none of it is a second
             * number to keep in sync.
             *
             * `md:text-2xl` is not redundant. The base `Input` carries
             * `text-base md:text-sm`, and a responsive utility beats a plain
             * one at that width whatever the order here — so `text-2xl` alone
             * is a field that is 24px on a phone and 14px on the desktop this
             * component is demonstrated on. It was written that way first, and
             * the measurement is what caught it.
             */
            className="h-14 pr-24 text-2xl tracking-[0.3em] md:text-2xl"
            onChange={(e) => {
              if (value === undefined) setOwn(e.target.value);
              onValueChange?.(e.target.value);
              track();
            }}
            /* Moving the caret without changing the text is still aiming. */
            onKeyUp={track}
            onClick={track}
            onSelect={track}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              /* Leaving the field hands the eyes back to the pointer at once:
                 they should be following you before you have finished moving to
                 whatever you clicked. */
              setFocused(false);
              onBlur?.(e);
            }}
            {...props}
          />

          <button
            type="button"
            /*
             * `tabIndex={-1}` and not in the tab order, deliberately. Tabbing out
             * of a password field goes to the submit button, and a reveal toggle
             * between the two is a keyboard trap on the most-used form on the
             * internet. It stays reachable by pointer and by the label below.
             */
            tabIndex={-1}
            aria-pressed={shown}
            aria-label={shown ? "Hide password" : "Show password"}
            onClick={() => {
              setShown((s) => !s);
              /* Focus goes back where it was: revealing is a thing you do *to*
                 the field, not a thing you leave it for. */
              input.current?.focus();
            }}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium underline underline-offset-4 transition-colors"
          >
            {shown ? "Hide" : "Show"}
          </button>
        </div>

        <p className="text-muted-foreground mt-2 text-xs" aria-live="polite">
          {shown ? "Not looking. Your password is on screen." : "Watching you type."}
        </p>
      </div>
    </div>
  );
}
