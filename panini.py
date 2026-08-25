#!/usr/bin/env python3
"""panini — the local runner.

    panini check <file.pni>          static checks; exits 1 on any problem
    panini stages <file.pni> [EASY|MID|PRO]
    panini prompt <file.pni> [n]     print the nth prompt and stop
    panini run <file.pni>            walk the cycle at the terminal
    panini serve [port]              the studio on 127.0.0.1:8717

Standard library only. No key, no cloud, loopback only.

THE RUNNER NEVER CALLS AN AI. It builds the prompt and hands it to you: to your clipboard, to a
tab you choose, to a server on your own machine, or to you typing. Which of those happens is your
decision and it is made here, at the terminal, not by the language.
"""
import json, os, re, sys, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ENGINE = os.path.join(HERE, "panini.js")


def _node(script, *args):
    """The reference implementation is panini.js. Rather than write a second parser that would
    drift from it, this runner drives the one that the specification names."""
    if not os.path.exists(ENGINE):
        raise SystemExit("panini.js not found beside this script (%s)" % ENGINE)
    import shutil
    if not shutil.which("node"):
        raise SystemExit("node is required to run the reference engine. "
                         "Nothing is faked; install node or use the browser studio.")
    p = subprocess.run(["node", "--input-type=module", "-e", script, *map(str, args)],
                       capture_output=True, text=True)
    if p.returncode:
        sys.stderr.write(p.stderr)
        raise SystemExit(p.returncode)
    return p.stdout


def _load(f):
    return ("import P from 'file://%s';\n"
            "import fs from 'node:fs';\n"
            "const src = fs.readFileSync(%s,'utf8');\n" % (ENGINE, json.dumps(os.path.abspath(f))))


def cmd_check(f):
    out = _node(_load(f) + """
const prog = P.parse(src);
const pr = P.check(prog);
console.log(JSON.stringify({cycler: prog.cyclers[0].id, stages: prog.cyclers[0].stages.length,
                            output: prog.cyclers[0].output, problems: pr}));""")
    d = json.loads(out)
    print("%s · %s · %d stages" % (d["cycler"], d["output"], d["stages"]))
    for p in d["problems"]:
        print("  FAIL %s" % p)
    print("  %d problems" % len(d["problems"]))
    return 1 if d["problems"] else 0


def cmd_stages(f, res=None):
    out = _node(_load(f) + """
const m = P.run(src);
const o = {};
for (const r of ['EASY','MID','PRO']) o[r] = m.visible(r).map(s => ({id:s.id, verb:s.verb,
  expect:s.expect, gate: s.gate ? s.gate.word : null, optional: s.optional}));
console.log(JSON.stringify(o));""")
    d = json.loads(out)
    for r in (["EASY", "MID", "PRO"] if not res else [res.upper()]):
        print("%-5s %2d stages" % (r, len(d[r])))
        for s in d[r]:
            mark = " [gate: %s]" % s["gate"] if s["gate"] else (" (optional)" if s["optional"] else "")
            print("      %-12s %-10s %s%s" % (s["id"], s["verb"] or "", s["expect"], mark))
    print("\nResolution changes what you SEE. It never changes what is computed.")
    return 0


def cmd_prompt(f, n=0):
    out = _node(_load(f) + """
const m = P.run(src);
const n = Number(process.argv[2] || 0);
for (let i = 0; i < n; i++) { m.i++; }
const pr = m.prompt();
console.log(JSON.stringify(pr || {text:'(this stage asks nothing)', expect:'-', mime:'-'}));""", n)
    d = json.loads(out)
    print(d["text"])
    print("\n(expects %s · %s)" % (d.get("expect"), d.get("mime")))
    return 0


def cmd_run(f):
    """Walk the cycle. Every prompt is printed; every answer is typed or pasted here."""
    state = os.path.join(os.getcwd(), ".panini-session.json")
    print("Prompts are printed here. Nothing is sent anywhere.\n"
          "Copy a prompt to whichever AI you use, paste the answer back, or type it yourself.\n"
          "Ctrl-C stops; your answers so far stay in %s\n" % os.path.basename(state))
    script = _load(f) + """
import readline from 'node:readline';
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(r => rl.question(q, r));
const m = P.run(src);
console.log(m.cycler.title + ' — ' + m.cycler.purpose + '\\n');
for (;;) {
  const need = m.step();
  for (const l of need.out || []) console.log('  ' + l);
  if (need.need === 'done') { console.log('\\nThe cycle is complete.'); break; }
  if (need.need === 'gate') {
    console.log('\\nGATE — ' + need.why);
    const w = await ask('Type exactly "' + need.word + '": ');
    const r = m.crossGate(w);
    console.log('  ' + r.why);
    if (!r.ok) break;
    continue;
  }
  console.log('\\n\\u2500\\u2500 ' + need.stage + ' \\u2500\\u2500');
  console.log(need.prompt.text);
  console.log('\\n(expects ' + need.prompt.expect + ' \\u00b7 ' + need.prompt.mime + ')');
  const a = await ask(need.optional ? 'Answer (empty to skip): ' : 'Answer: ');
  const r = m.answer(a);
  if (!r.ok) { console.log('  refused: ' + r.why + '  \\u2192  ' + r.route); }
  else if (r.note) console.log('  ' + r.note);
}
rl.close();
"""
    if not os.path.exists(ENGINE):
        raise SystemExit("panini.js not found beside this script")
    return subprocess.call(["node", "--input-type=module", "-e", script])


def cmd_serve(port=8717):
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from urllib.parse import urlparse

    root = HERE

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a): pass
        def do_GET(self):
            u = urlparse(self.path)
            rel = "studio.html" if u.path in ("/", "/index.html") else u.path.lstrip("/")
            f = os.path.normpath(os.path.join(root, rel))
            if not f.startswith(root) or not os.path.isfile(f):
                self.send_response(404); self.end_headers()
                self.wfile.write(b"not found: " + rel.encode()); return
            ct = {"html": "text/html", "js": "text/javascript", "json": "application/json",
                  "pni": "text/plain", "md": "text/markdown", "css": "text/css"}.get(
                      f.rsplit(".", 1)[-1], "application/octet-stream")
            b = open(f, "rb").read()
            self.send_response(200)
            self.send_header("Content-Type", ct + "; charset=utf-8")
            self.send_header("Content-Length", str(len(b)))
            self.end_headers(); self.wfile.write(b)

    print("panini studio — http://127.0.0.1:%d" % port)
    print("cyclers served from %s" % os.path.join(root, "cyclers"))
    print("loopback only. No key, no cloud.")
    try:
        ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
    except KeyboardInterrupt:
        print("\nstopped.")
    return 0


def main(a):
    if not a or a[0] in ("-h", "--help"): print(__doc__); return 0
    c = a[0]
    if c == "check":  return cmd_check(a[1])
    if c == "stages": return cmd_stages(a[1], a[2] if len(a) > 2 else None)
    if c == "prompt": return cmd_prompt(a[1], a[2] if len(a) > 2 else 0)
    if c == "run":    return cmd_run(a[1])
    if c == "serve":  return cmd_serve(int(a[1]) if len(a) > 1 else 8717)
    print("unknown command: %s" % c); return 2


if __name__ == "__main__":
    try: rc = main(sys.argv[1:])
    except BrokenPipeError: os._exit(0)
    except KeyboardInterrupt: print(); rc = 130
    except IndexError: print(__doc__); rc = 2
    sys.exit(rc)
