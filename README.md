# PANINI

**پाणिनि · پاणिنی — a language for prompt cycles.**

A cycler is a **sequence of prompts and the outputs they produce**. PANINI lets you write that
sequence down, so a cycler stops being code somebody maintains and becomes a text somebody edits.

```basic
STAGE ENVELOPE
  RESOLUTION EASY
  VERB   MEASURE
  EXPECT TEXT
  INTO   manoeuvre.envelope
  ASK
    State the operating envelope in 60 to 110 words. Be specific and refuse to guess.

    Where a limit is not known, write "not established" rather than a plausible number.
    An invented limit is worse than an absent one.
  END ASK
  VALIDATE NOT EMPTY(manoeuvre.envelope)
  ON FAIL REPAIR
END STAGE
```

That is the whole thing. No build step, no compiler, no framework.

## QBASIC in shape

Line-oriented, case-insensitive, `REM` and `'` comments, `LET` `PRINT` `IF/THEN/ELSE`
`FOR/NEXT` `WHILE/WEND` `DIM` `SUB`. Anyone who wrote BASIC in 1991 can read a cycler without a
manual — which is the point, because the cyclers are **configuration**, not a module.

## Resolution is a lens, not a mode

`EASY`, `MID` and `PRO` are levels of resolution over **one program**. A stage declares where it
becomes visible. Raising the dial reveals more of the same text; it never changes what is asked,
computed or stored — and a test proves the prompt is byte-identical at every level.

```
EASY   3 stages   ENTRIES  HAPPENED  MARK
MID    6 stages   ENTRIES  HAPPENED  HOLD  WHO  MARK  ABSTRACT
PRO    8 stages   ENTRIES  HAPPENED  HOLD  WHO  ATTACH  MARK  ABSTRACT  EXPORT
```

## It has no provider and cannot acquire one

`ASK` **yields**. The machine says it needs an answer and stops. The *host* decides where the
prompt goes:

- **click through** to whichever AI you use — the list ships with entries, alphabetical so the
  order is not a ranking, and every one is deletable
- **bring your own key** — your endpoint, your credential, never in the program
- **a server on your own machine** — keyless, nothing leaves the machine
- **type it yourself** — always a valid path

A test asserts `panini.js` opens no connection and names no service anywhere in its source.

## Shapes, MIME, graphics, physical

`TEXT` `JSON` `LIST` `NUMBER` `BOOLEAN` · `IMAGE` `AUDIO` `VIDEO` `MODEL` `DOCUMENT` `DATA` ·
`SIGNAL` `TRAJECTORY` `ENVELOPE`.

Anything beyond text is a **binary shape**: the answer is a file, and the host returns it through
an artefact inbox. When it does, the recorded provenance is *chosen by the operator; origin not
asserted* — because a file in a folder is not evidence an AI made it.

## The six verbs

`CREATE` `VERIFY` `EXECUTE` `MEASURE` `FALSIFY` `INTEGRATE`

There is no verb for *describing*. `VERB DESCRIBE` is a parse error, and a prompt that opens by
asking for prose *about* a thing fails the static check.

## Try it

```bash
python3 panini.py check  cyclers/pench.pni      # static checks
python3 panini.py stages cyclers/yadein.pni     # what each resolution shows
python3 panini.py prompt cyclers/matba.pni      # the first prompt, and stop
python3 panini.py run    cyclers/khwab.pni      # walk it at the terminal
python3 panini.py serve                         # the studio on 127.0.0.1:8717
node tests/panini.test.mjs                      # 39 assertions
```

## In VS Code

`vscode/` is a complete extension: syntax highlighting that treats an `ASK` block as the prose it
is, seven snippets, folding and indentation, check-on-save with the problem pinned to the stage
that caused it, an outline showing stages by resolution, and a runner that hands each prompt to
whichever AI you have configured. It names no service; the providers come from settings.

## The six cyclers

| | output | unit |
|---|---|---|
| `matba.pni` | print | plate |
| `khwab.pni` | visual | shot |
| `awaz.pni` | audio | passage |
| `tilasm.pni` | immersive | station |
| `pench.pni` | embodied | manoeuvre |
| `yadein.pni` | record | entry |

**The engine is shared. The workflows are emphatically not** — a test asserts no two cyclers share
a stage sequence. Each declares its own refusals, and those refusals are the specification:
pench will not publish a manoeuvre without a stated envelope; yadein will not sharpen a vague
date; tilasm will not accept a station with no comfort note.

## Specification

`SPEC.md` is normative — lexical structure, EBNF, the six verbs, shapes and MIME, gates, static
checks, host responsibilities, and seven conformance conditions. The reference implementation is
`panini.js`; its conformance suite is `tests/panini.test.mjs`.

---

Copyright © 1993–2026 Abhishek Choudhary · AyeAI · ORCID 0009-0002-0684-8320 · Apache-2.0
*Kaivalyik Immutabilis*
