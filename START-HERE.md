# I have books ready. What do I do?

Three commands. Nothing to remember, nothing to configure.

```bash
python3 panini.py serve          # then open http://127.0.0.1:8717
```

Pick **matba**. Leave the dial on **EASY**. Press the hub.

That is it. The hub is the only control: it copies the prompt, opens your AI, and when you come
back with the answer on your clipboard, it takes it and turns the wheel one segment. Repeat until
the wheel is green.

---

## Why this was hard before, and what changed

The old path asked you to know `matba new`, then `intake`, then `bulk` with a tab-separated table,
then `set --cover`, then `doctor`, then `build`, then `run stage`, then `run push`, then
`run mint` — nine commands in an order you had to remember, with a file format you had to look up.

**That is now one file you can read.** `cyclers/matba.pni` is the whole thing:

```basic
STAGE INTAKE
  RESOLUTION EASY
  VERB   CREATE
  EXPECT LIST
  INTO   plates
  ASK
    You are given the plates of "{book}". List them in reading order.
    ...
  END ASK
  VALIDATE COUNT(plates) > 0
END STAGE
```

You do not have to remember the order because **the wheel shows it**. You do not have to remember
the format because **the prompt says it**. You do not have to remember the flags because there are
none.

---

## The dial

| | |
|---|---|
| **EASY** | click through. One control. The prompt is handled for you. |
| **MID** | you see the prompt and paste the answer back yourself. |
| **PRO** | you see and edit everything, including the `.pni`. |

**Every stage runs at every level.** The dial changes how many decisions are in front of you — not
how much of the work gets done, and never whether a gate is crossed. You cross every gate yourself
at every level, because that is authority and not machinery.

---

## Record how *you* do it

Press **Record** before you start. Work the way you actually work. When you are done, press
**Write it as a cycler** and you get a `.pni` of your own method: your prompts, in your order, with
a `VALIDATE` line everywhere you rejected an answer and a `GATE` everywhere you stopped to decide.

Your answers are **not** recorded. Those are the work, not the method — and a recording that swept
them up would be unshareable, and for a diary, an incident.

Then run your own file instead of mine.

---

## When you get to the end

The last segments are gates: **SEAL**, then **MINT**. The wheel will not turn through them. You
type the word, and only then does anything leave your machine.

`MINT` is permanent, and a DOI is a dated public disclosure.

---

## If something goes wrong

- **The clipboard is blocked.** Switch the dial to MID. There is a box to paste into. It never
  dead-ends.
- **An answer is refused.** The reason is on the wheel caption. Fix it and press again.
- **You want to change a prompt.** Switch to PRO, edit the text, reload. No build step.
- **You want no AI at all.** Type the answer yourself. That is always a valid path.
