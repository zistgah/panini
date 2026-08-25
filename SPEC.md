# PANINI — Language Specification

**Version 1.0.0** · پاणिنی · पाणिनि

A language for **prompt cycles**. Not a workflow engine, not a template system, not a chat
wrapper: a way to write down *the sequence of prompts and the outputs they produce* so that a
cycler stops being code somebody maintains and becomes a text somebody edits.

Named for the grammarian who wrote the rules down so the language could outlive its speakers.

---

## 1. Design position

### 1.1 What is cycled

**A sequence of prompts and their outputs.** Every construct in this language exists to state
four things precisely:

1. what to ask,
2. what shape the answer must take,
3. where the answer goes,
4. who is permitted to move on.

### 1.2 QBASIC compatibility in shape

Line-oriented. Case-insensitive. Uppercase keywords by convention. `REM` and `'` comments.
`LET`, `PRINT`, `IF/THEN/ELSE/END IF`, `FOR/NEXT`, `WHILE/WEND`, `DIM`, `CONST`, `SUB`,
`FUNCTION`. Anybody who wrote BASIC in 1991 can read a cycler without a manual — which is the
point, because the cyclers are **configuration a person edits**, not a module a programmer owns.

Compatibility is of *shape*, not of runtime. PANINI does not implement `PEEK`, `POKE`, `DEF SEG`,
line numbers as addresses, or `GOTO` into arbitrary memory.

### 1.3 Resolution is a lens, not a mode

`EASY`, `MID` and `PRO` are **levels of resolution over one program**. A stage declares the
resolution at which it becomes visible. Raising the resolution reveals more of the same text; it
never changes what is computed, what is asked, or what is stored.

> **Normative:** for any program *P* and any two resolutions *r₁*, *r₂*, the prompt produced at a
> given stage is identical. A conforming implementation MUST NOT branch semantics on resolution.

### 1.4 The interpreter has no provider

`ASK` **yields**. The machine reports that it needs an answer and stops. The *host* — a browser
page, a CLI, a VS Code panel — decides whether the prompt goes to the clipboard, to a tab, to a
server on the operator's own machine, or to a person typing it out.

> **Normative:** a conforming implementation MUST NOT open a network connection, and MUST NOT
> name a commercial AI service anywhere in its source. Click-through, bring-your-own-key and
> local models are all *host* concerns.

---

## 2. Lexical structure

### 2.1 Lines and comments

A program is a sequence of lines. `REM` and `'` begin a comment that runs to end of line.
A blank line is not significant.

### 2.2 Case

Keywords and enumerated values are case-insensitive. `RESOLUTION EASY`, `resolution easy` and
`Resolution Easy` are identical. Identifiers preserve case but compare case-sensitively.

### 2.3 Literals

| | |
|---|---|
| string | `"…"` with `\n`, `\t`, `\"`, `\\` |
| number | decimal, `_` permitted as a digit separator |
| boolean | `TRUE`, `FALSE` |
| absent | `NOTHING` |
| list | `[a, b, c]` |

### 2.4 The `ASK` heredoc

```
ASK
  … prose, verbatim, including blank lines …
END ASK
```

Everything between `ASK` on its own line and `END ASK` is captured **verbatim**, with common
leading indentation removed uniformly. No escape processing occurs inside an ASK block.

> **Rationale.** A prompt is prose. If a blank line disappears or indentation shifts, the thing
> being cycled is not the thing that was written.

---

## 3. Grammar

```ebnf
program        = { cycler | sub } ;

cycler         = "CYCLER" ident EOL
                 { property | contract | stage }
                 "END" "CYCLER" EOL ;

property       = ( "TITLE" | "SCRIPT" | "OUTPUT" | "UNIT" | "PURPOSE"
                 | "VERSION" | "AUTHOR" | "LICENSE" ) value EOL ;

contract       = "CONTRACT" EOL
                 { ( "REFUSE" | "INVARIANT" | "EVIDENCE" | "REQUIRE" | "FORBID" ) string EOL }
                 "END" "CONTRACT" EOL ;

stage          = "STAGE" ident EOL
                 { stage-prop | statement }
                 "END" "STAGE" EOL ;

stage-prop     = "RESOLUTION" resolution
               | "VERB"       verb
               | "EXPECT"     shape
               | "INTO"       path
               | "FROM"       path { "," path }
               | "ASK"        ask-text "END" "ASK"
               | "VALIDATE"   expression
               | "OPTIONAL"
               | "GATE"       ident [ string ]
               | "ON" "FAIL"  ( "REPAIR" | "CLARIFY" | ident )
               | "REPEAT" "FOREACH" path
               | "EMIT"       ident [ string ]
               | "ATTACH"     ident
               | "ENVELOPE"   string ;

resolution     = "EASY" | "MID" | "PRO" ;
verb           = "CREATE" | "VERIFY" | "EXECUTE" | "MEASURE" | "FALSIFY" | "INTEGRATE" ;
shape          = "TEXT" | "JSON" | "LIST" | "NUMBER" | "BOOLEAN"
               | "IMAGE" | "AUDIO" | "VIDEO" | "MODEL" | "DOCUMENT" | "DATA" | "ANY"
               | "SIGNAL" | "TRAJECTORY" | "ENVELOPE" ;

statement      = let | print | if | for | while | dim | const | call | exit | return ;
let            = [ "LET" ] path "=" expression ;
print          = "PRINT" [ expression { ( ";" | "," ) expression } ] ;
if             = "IF" expression "THEN" EOL { statement }
                 [ "ELSE" EOL { statement } ] "END" "IF" ;
for            = "FOR" ident "=" expression "TO" expression [ "STEP" expression ] EOL
                 { statement } "NEXT" [ ident ] ;
while          = "WHILE" expression EOL { statement } "WEND" ;

sub            = ( "SUB" | "FUNCTION" ) ident [ "(" [ ident { "," ident } ] ")" ] EOL
                 { statement } "END" ( "SUB" | "FUNCTION" ) ;

path           = ident { "." ident } ;
```

### 3.1 Operator precedence

Lowest to highest: `OR` · `AND` · `= <> < > <= >=` · `+ -` · `* / \ MOD` · `^` · unary `NOT -`.

---

## 4. The six verbs

Every stage declares exactly one verb. The set is closed.

| verb | the stage … |
|---|---|
| `CREATE` | brings a component into existence that was not there before |
| `VERIFY` | independently attacks a component that exists and reports what held |
| `EXECUTE` | runs it and returns what happened, not what should happen |
| `MEASURE` | produces a number, with its units and its uncertainty |
| `FALSIFY` | tries to kill the claim with the smallest counterexample it can find |
| `INTEGRATE` | folds a verified component back in and states what changed |

> **Normative:** there is no verb for *describing*. A stage that only produces prose about a thing
> is not a stage, and `VERB DESCRIBE` is a parse error.

---

## 5. Shapes and MIME

| shape | MIME | note |
|---|---|---|
| `TEXT` | `text/plain` | |
| `JSON` | `application/json` | fenced and chatty replies are unwrapped |
| `LIST` | `application/json` | must parse to an array |
| `NUMBER` `BOOLEAN` | — | |
| `IMAGE` | `image/*` | returns through the host's artefact inbox |
| `AUDIO` | `audio/*` | |
| `VIDEO` | `video/*` | |
| `MODEL` | `model/gltf-binary` | glTF / GLB, for the immersive kinds |
| `DOCUMENT` | `application/pdf` | |
| `DATA` | `text/csv` | |
| `SIGNAL` | `application/octet-stream` | physical: sensor traces, captures |
| `TRAJECTORY` | `application/json` | physical: paths, joint sequences |
| `ENVELOPE` | `application/json` | physical: operating limits |
| `ANY` | `*/*` | |

A shape that is not `TEXT`, `JSON`, `LIST`, `NUMBER` or `BOOLEAN` is a **binary** shape: the
answer is a *file*, and the host returns it through an artefact inbox rather than the clipboard.

> **Normative:** a host MUST NOT assert that a file it received was produced by an AI. The correct
> provenance is *chosen by the operator; origin not asserted*.

---

## 6. Gates

```
GATE HUMAN "MINT matba"
```

A gate stops the machine. `crossGate(word)` succeeds only on an **exact** match; any other input
returns `ok: false` and does nothing.

> **Normative:** a conforming implementation MUST NOT advance through a gate automatically, MUST
> NOT default the word, and MUST NOT accept a case-insensitive or trimmed variant.

`ENVELOPE "…"` on a gated stage carries the consequence in prose — for example, that a DOI is a
dated public disclosure and cannot be withdrawn.

---

## 7. Static checks

`check(program)` returns a list of problems. A cycler that does not pass SHOULD NOT ship.

- no `TITLE`, no `PURPOSE`, no `OUTPUT`
- **refuses nothing** — the refusals are the specification
- a duplicate stage id
- a stage that neither asks, computes nor gates
- a prompt that opens by asking for prose *about* a thing
- `INTO` with nothing that produces a value
- an `ASK` that stores nothing
- no stage visible at `EASY`

---

## 8. Host responsibilities

The language deliberately leaves these to the host, and says so rather than pretending:

| | |
|---|---|
| **Click-through** | open a provider with the prompt seeded or on the clipboard |
| **Bring your own key** | the operator's endpoint and credential, never in the program |
| **Local models** | an address on `localhost`, keyless |
| **No AI at all** | typing the answer is always a valid path |
| **Artefact inbox** | how a binary answer comes back |
| **Graphics, WASM** | rendering and computation the host provides |

> **Normative:** the shipped provider list is **configuration**. It ships *with* entries so the
> tool works out of the box, ordered alphabetically so the order is not a ranking, and deleting
> every entry MUST leave a working program.

---

## 9. Conformance

An implementation is conforming if:

1. it parses the grammar in §3;
2. resolution changes visibility only (§1.3);
3. `ASK` text survives verbatim (§2.4);
4. it opens no network connection and names no AI service (§1.4);
5. gates require an exact word (§6);
6. `VERB DESCRIBE` is a parse error (§4);
7. `check()` reports every condition in §7.

The reference implementation is `panini.js`. Its test suite is `tests/panini.test.mjs`.

---

*Copyright © 1993–2026 Abhishek Choudhary · AyeAI · Apache-2.0*
