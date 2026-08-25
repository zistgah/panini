# Editing a .pni in VS Code

A cycler is a text file. You do not need the studio to change one.

## Install the extension

The extension lives in `vscode/` in this repository. It is not on the Marketplace; install it from
disk:

```bash
git clone https://github.com/zistgah/panini
cd panini/vscode
npm install -g @vscode/vsce      # once
vsce package                     # produces panini-1.0.0.vsix
code --install-extension panini-1.0.0.vsix
```

Or, without packaging anything, symlink it into your extensions folder and reload:

```bash
ln -s "$PWD" ~/.vscode/extensions/panini          # Linux / macOS
# Windows: mklink /D %USERPROFILE%\.vscode\extensions\panini "%CD%"
```

Then open any `.pni` file. Status bar bottom-right should read **PANINI**.

## What you get

| | |
|---|---|
| **Syntax** | an `ASK` block is highlighted as the prose it is, with `{placeholders}` picked out |
| **Folding** | fold a `CYCLER`, a `STAGE`, a `CONTRACT` or an `ASK` |
| **Check on save** | problems appear in the Problems panel, pinned to the stage that caused them |
| **Snippets** | type `cycler`, `stage`, `gate`, `binary`, `validate`, `contract`, `repeat` and press Tab |
| **`PANINI: Show stages by resolution`** | what a person touches at EASY, MID and PRO |
| **`PANINI: Run the cycle here`** | walks the cycle in an output channel, handing each prompt to whichever AI you configured |

Commands are on the palette: <kbd>Ctrl/Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → type *PANINI*.

## Settings

<kbd>Ctrl/Cmd</kbd>+<kbd>,</kbd> → search *panini*.

| | |
|---|---|
| `panini.resolution` | EASY, MID or PRO — how much the runner puts in front of you |
| `panini.providers` | click-through targets. Ships empty here; add your own, or leave it empty and use the clipboard |
| `panini.localEndpoint` | an address on your own machine. Keyless. Nothing leaves the machine |
| `panini.checkOnSave` | on by default |

The extension names no AI service anywhere in its source. Whatever you put in `providers` is what
it offers, in the order you list them.

## The shape of a stage

```basic
STAGE ENVELOPE            ' the name shows on the wheel
  RESOLUTION EASY         ' how much of this stage's machinery is exposed
  VERB   MEASURE          ' CREATE VERIFY EXECUTE MEASURE FALSIFY INTEGRATE
  EXPECT TEXT             ' the shape the answer must take
  FROM   manoeuvre.lead   ' what travels into the prompt
  INTO   manoeuvre.envelope
  ASK
    Everything here is kept verbatim, including blank lines.

    {manoeuvre.title} interpolates.
  END ASK
  VALIDATE NOT EMPTY(manoeuvre.envelope)
  ON FAIL REPAIR          ' REPAIR or CLARIFY
END STAGE
```

**`RESOLUTION` is not visibility.** Every stage runs at every level. It says how much of the
stage's machinery is put in front of a person — at EASY the prompt is handled for them, at PRO
they can edit it.

**A gate is crossed by a human at every level.** `GATE HUMAN "MINT matba"` will not advance on its
own, will not accept a near-miss, and is never simplified away.

## Checking without VS Code

```bash
python3 panini.py check cyclers/matba.pni     # exits 1 on any problem
python3 panini.py stages cyclers/matba.pni    # what each level exposes
python3 panini.py prompt cyclers/matba.pni    # the first prompt, then stop
```

## The full grammar

`SPEC.md` — lexical structure, EBNF, the six verbs, shapes and MIME, gates, static checks, and the
seven conformance conditions an implementation must meet.
