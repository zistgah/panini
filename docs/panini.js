/* panini.js — PANINI, a language for prompt cycles.
 *
 * پاणिनی · पाणिनि — named for the grammarian who wrote the rules down so the language could
 * outlive its speakers. That is the whole intent here: a cycler stops being code somebody has to
 * read and becomes a text somebody can WRITE.
 *
 * WHAT IS BEING CYCLED
 * --------------------
 * Not stages. Not screens. **A sequence of prompts and the outputs they produce.** Everything
 * else in this language exists to say precisely what to ask, what shape the answer must take,
 * where it goes, and who is allowed to move on.
 *
 * QBASIC-COMPATIBLE IN SHAPE
 * --------------------------
 * Line-oriented. Uppercase keywords. REM and ' for comments. LET, PRINT, IF/THEN/ELSE/END IF,
 * FOR/NEXT, WHILE/WEND, DIM, SUB, labels. Anyone who wrote BASIC in 1991 can read a cycler here
 * without a manual, which is the point — the six cyclers are configuration a person edits, not
 * a module a programmer maintains.
 *
 * RESOLUTION IS THE INTERACTION, NOT THE CYCLE
 * --------------------------------------------
 * EASY, MID and PRO describe how much of the machinery you TOUCH. They do not change which
 * stages run — EVERY STAGE ALWAYS RUNS.
 *
 *   EASY   click through. One control. The prompt is handled for you; you press on.
 *   MID    you see the prompt and paste the answer back yourself.
 *   PRO    you see and edit everything: prompt, shape, validation, gate, the .pni itself.
 *
 * An earlier version had this wrong — it hid stages at EASY, which meant a simpler view
 * produced a DIFFERENT and less complete artifact. That is exactly backwards. Simplicity is
 * about the number of decisions in front of you, never about how much of the work gets done.
 *
 * THE INTERPRETER NEVER CALLS AN AI
 * ---------------------------------
 * `ASK` yields. The host — a browser page, a CLI, a VS Code panel — decides whether that prompt
 * goes to the clipboard, to a tab, to a server on this machine, or to a person typing. The
 * language has no provider and cannot acquire one.
 */

export const VERSION = '1.0.0';

/* ── 1. Lexer ─────────────────────────────────────────────────────────────── */

export const KEYWORDS = new Set([
  // structure
  'CYCLER','END','STAGE','CONTRACT','ASK','SUB','FUNCTION','TYPE',
  // cycler header
  'TITLE','SCRIPT','OUTPUT','UNIT','PURPOSE','VERSION','AUTHOR','LICENSE',
  // contract
  'REFUSE','INVARIANT','EVIDENCE','REQUIRE','FORBID',
  // stage body
  'RESOLUTION','VERB','EXPECT','INTO','FROM','VALIDATE','GATE','ON','FAIL','REPAIR','CLARIFY',
  'OPTIONAL','REPEAT','FOREACH','EMIT','ATTACH','SENSE','ACTUATE','ENVELOPE','RENDER','COMPUTE',
  // classic BASIC
  'LET','PRINT','INPUT','IF','THEN','ELSE','ELSEIF','FOR','TO','STEP','NEXT','WHILE','WEND',
  'DIM','AS','REM','GOTO','GOSUB','RETURN','SELECT','CASE','EXIT','CONST','DO','LOOP','UNTIL',
  // literals / operators as words
  'AND','OR','NOT','MOD','TRUE','FALSE','NOTHING'
]);

export const VERBS = new Set(['CREATE','VERIFY','EXECUTE','MEASURE','FALSIFY','INTEGRATE']);
export const RESOLUTIONS = ['EASY','MID','PRO'];
export const EXPECTS = new Set([
  'TEXT','JSON','LIST','NUMBER','BOOLEAN',
  'IMAGE','AUDIO','VIDEO','MODEL','DOCUMENT','DATA','ANY',   // MIME-bearing
  'SIGNAL','TRAJECTORY','ENVELOPE'                            // physical
]);

/* MIME is DATA. A host may extend this; the language ships what it can name honestly. */
export const MIME = {
  TEXT:'text/plain', JSON:'application/json', LIST:'application/json',
  IMAGE:'image/*', AUDIO:'audio/*', VIDEO:'video/*',
  MODEL:'model/gltf-binary', DOCUMENT:'application/pdf', DATA:'text/csv',
  SIGNAL:'application/octet-stream', TRAJECTORY:'application/json', ENVELOPE:'application/json',
  ANY:'*/*'
};

export function lex(src) {
  const toks = [];
  const lines = String(src).split(/\r?\n/);
  let inAsk = false, askBuf = [], askLine = 0;

  for (let ln = 0; ln < lines.length; ln++) {
    const raw = lines[ln], line = raw.trim();

    /* ASK … END ASK is a HEREDOC. A prompt is prose; it must survive verbatim, including its
       blank lines and its indentation, or the thing being cycled is not what was written. */
    if (inAsk) {
      if (/^END\s+ASK$/i.test(line)) {
        toks.push({ t: 'ASKTEXT', v: dedent(askBuf.join('\n')), ln: askLine });
        toks.push({ t: 'EOL', ln });
        inAsk = false; askBuf = [];
      } else askBuf.push(raw);
      continue;
    }
    if (/^ASK\s*$/i.test(line)) {
      toks.push({ t: 'KW', v: 'ASK', ln });
      inAsk = true; askLine = ln + 1;
      continue;
    }

    if (!line || /^(REM\b|')/i.test(line)) { toks.push({ t: 'EOL', ln }); continue; }

    let i = 0;
    while (i < line.length) {
      const c = line[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === "'" ) break;                                  // trailing comment
      if (c === '"') {                                        // string
        let j = i + 1, s = '';
        while (j < line.length && line[j] !== '"') {
          if (line[j] === '\\' && j + 1 < line.length) { s += unesc(line[++j]); }
          else s += line[j];
          j++;
        }
        if (j >= line.length) throw err(ln, 'unterminated string');
        toks.push({ t: 'STR', v: s, ln }); i = j + 1; continue;
      }
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(line[i+1] || ''))) {
        let j = i; while (j < line.length && /[0-9._]/.test(line[j])) j++;
        toks.push({ t: 'NUM', v: parseFloat(line.slice(i, j).replace(/_/g,'')), ln }); i = j; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        let j = i; while (j < line.length && /[A-Za-z0-9_.$]/.test(line[j])) j++;
        const w = line.slice(i, j), U = w.toUpperCase();
        if (U === 'REM') break;
        toks.push(KEYWORDS.has(U) ? { t:'KW', v:U, ln } : { t:'ID', v:w, ln });
        i = j; continue;
      }
      const two = line.slice(i, i + 2);
      if (['<=','>=','<>','->','=>'].includes(two)) { toks.push({t:'OP',v:two,ln}); i += 2; continue; }
      if ('+-*/\\^=<>(),:;[]{}'.includes(c)) { toks.push({t:'OP',v:c,ln}); i++; continue; }
      throw err(ln, `unexpected character ${JSON.stringify(c)}`);
    }
    toks.push({ t: 'EOL', ln });
  }
  if (inAsk) throw err(askLine, 'ASK block was never closed with END ASK');
  toks.push({ t: 'EOF', ln: lines.length });
  return toks;
}

const unesc = c => ({ n:'\n', t:'\t', '"':'"', '\\':'\\' }[c] ?? c);
const err = (ln, m) => Object.assign(new Error(`line ${ln + 1}: ${m}`), { line: ln + 1 });

function dedent(s) {
  const ls = s.split('\n').filter(l => l.trim());
  if (!ls.length) return s.trim();
  const pad = Math.min(...ls.map(l => l.match(/^\s*/)[0].length));
  return s.split('\n').map(l => l.slice(pad)).join('\n').trim();
}

/* ── 2. Parser ────────────────────────────────────────────────────────────── */

export function parse(src) {
  const T = lex(src);
  let p = 0;
  const peek = (k = 0) => T[p + k] || T[T.length - 1];
  const at = (t, v) => peek().t === t && (v === undefined || peek().v === v);
  const eat = (t, v) => { if (!at(t, v)) throw err(peek().ln, `expected ${v || t}, found ${peek().v ?? peek().t}`); return T[p++]; };
  const skipEol = () => { while (at('EOL')) p++; };
  const opt = (t, v) => at(t, v) ? (p++, true) : false;

  const prog = { version: VERSION, cyclers: [], subs: [] };
  skipEol();
  while (!at('EOF')) {
    if (at('KW','CYCLER')) prog.cyclers.push(cycler());
    else if (at('KW','SUB') || at('KW','FUNCTION')) prog.subs.push(sub());
    else throw err(peek().ln, `expected CYCLER or SUB at top level, found ${peek().v ?? peek().t}`);
    skipEol();
  }
  if (!prog.cyclers.length) throw err(0, 'a PANINI program declares at least one CYCLER');
  return prog;

  function cycler() {
    eat('KW','CYCLER');
    const c = { id: name(), title:'', script:'', output:'', unit:'item', purpose:'',
                meta:{}, contract:{ refuse:[], invariants:[], evidence:[], require:[], forbid:[] },
                stages:[], line: peek().ln };
    skipEol();
    while (!at('KW','END')) {
      if (at('EOF')) throw err(peek().ln, `CYCLER ${c.id} was never closed with END CYCLER`);
      if (at('KW','STAGE')) { c.stages.push(stage(c)); skipEol(); continue; }
      if (at('KW','CONTRACT')) { contract(c); skipEol(); continue; }
      const k = eat('KW').v;
      const map = { TITLE:'title', SCRIPT:'script', OUTPUT:'output', UNIT:'unit',
                    PURPOSE:'purpose', VERSION:'version', AUTHOR:'author', LICENSE:'license' };
      if (!(k in map)) throw err(peek().ln, `${k} is not a CYCLER property`);
      /* A property VALUE may be a keyword: `OUTPUT PRINT` names the print medium, not the
         PRINT statement. Position disambiguates, so accept either token class here. */
      const v = at('STR') ? eat('STR').v : ident().toUpperCase();
      if (map[k] in c) c[map[k]] = v; else c.meta[map[k]] = v;
      skipEol();
    }
    eat('KW','END'); eat('KW','CYCLER'); 
    if (!c.stages.length) throw err(c.line, `CYCLER ${c.id} has no STAGE — nothing to cycle`);
    return c;
  }

  function contract(c) {
    eat('KW','CONTRACT'); skipEol();
    while (!at('KW','END')) {
      if (at('EOF')) throw err(peek().ln, 'CONTRACT was never closed');
      const k = eat('KW').v, v = eat('STR').v;
      ({ REFUSE:'refuse', INVARIANT:'invariants', EVIDENCE:'evidence',
         REQUIRE:'require', FORBID:'forbid' }[k]
        ? c.contract[{ REFUSE:'refuse', INVARIANT:'invariants', EVIDENCE:'evidence',
                       REQUIRE:'require', FORBID:'forbid' }[k]].push(v)
        : (() => { throw err(peek().ln, `${k} is not a CONTRACT clause`); })());
      skipEol();
    }
    eat('KW','END'); eat('KW','CONTRACT');
  }

  function stage(c) {
    eat('KW','STAGE');
    const s = { id: name(), resolution:'MID', verb:null, expect:'TEXT', into:null, from:[],
                ask:null, validate:[], gate:null, onFail:null, optional:false, repeat:null,
                emit:[], attach:null, envelope:null, body:[], line: peek().ln };
    skipEol();
    while (!at('KW','END')) {
      if (at('EOF')) throw err(peek().ln, `STAGE ${s.id} was never closed with END STAGE`);
      if (at('KW')) {
        const k = peek().v;
        if (k === 'RESOLUTION') { p++; const r = ident().toUpperCase();
          if (!RESOLUTIONS.includes(r)) throw err(peek().ln, `RESOLUTION must be EASY, MID or PRO`);
          s.resolution = r; skipEol(); continue; }
        if (k === 'VERB') { p++; const v = ident().toUpperCase();
          if (!VERBS.has(v)) throw err(peek().ln,
            `VERB must be one of ${[...VERBS].join(', ')} — a stage that only describes is not a stage`);
          s.verb = v; skipEol(); continue; }
        if (k === 'EXPECT') { p++; const e = ident().toUpperCase();
          if (!EXPECTS.has(e)) throw err(peek().ln, `EXPECT ${e} is not a known shape`);
          s.expect = e; skipEol(); continue; }
        if (k === 'INTO')   { p++; s.into = dotted(); skipEol(); continue; }
        if (k === 'FROM')   { p++; s.from.push(dotted()); while (opt('OP',',')) s.from.push(dotted()); skipEol(); continue; }
        if (k === 'ASK')    { p++; s.ask = eat('ASKTEXT').v; skipEol(); continue; }
        if (k === 'VALIDATE'){ p++; s.validate.push(expr()); skipEol(); continue; }
        if (k === 'OPTIONAL'){ p++; s.optional = true; skipEol(); continue; }
        if (k === 'GATE')   { p++; const who = ident().toUpperCase(); const word = at('STR') ? eat('STR').v : null;
          s.gate = { who, word }; skipEol(); continue; }
        if (k === 'ON')     { p++; eat('KW','FAIL'); s.onFail = ident().toUpperCase(); skipEol(); continue; }
        if (k === 'REPEAT') { p++; eat('KW','FOREACH'); s.repeat = dotted(); skipEol(); continue; }
        if (k === 'EMIT')   { p++; s.emit.push({ kind: ident().toUpperCase(), path: at('STR') ? eat('STR').v : null }); skipEol(); continue; }
        if (k === 'ATTACH') { p++; s.attach = ident().toUpperCase(); skipEol(); continue; }
        if (k === 'ENVELOPE'){p++; s.envelope = eat('STR').v; skipEol(); continue; }
      }
      s.body.push(stmt()); skipEol();
    }
    eat('KW','END'); eat('KW','STAGE');
    if (s.ask && !s.verb) s.verb = 'CREATE';
    return s;
  }

  function sub() {
    const kind = eat('KW').v;
    const s = { kind, id: name(), params: [], body: [] };
    if (opt('OP','(')) { if (!at('OP',')')) { s.params.push(ident()); while (opt('OP',',')) s.params.push(ident()); } eat('OP',')'); }
    skipEol();
    while (!at('KW','END')) { if (at('EOF')) throw err(peek().ln, `${kind} ${s.id} never closed`); s.body.push(stmt()); skipEol(); }
    eat('KW','END'); eat('KW', kind);
    return s;
  }

  /* classic BASIC statements */
  function stmt() {
    const ln = peek().ln;
    if (at('KW','LET') || (at('ID') && peek(1).t === 'OP' && peek(1).v === '=')) {
      if (at('KW','LET')) p++;
      const target = dotted(); eat('OP','='); return { k:'let', target, value: expr(), ln };
    }
    if (at('KW','PRINT')) { p++; const args = at('EOL') ? [] : [expr()];
      while (opt('OP',';') || opt('OP',',')) if (!at('EOL')) args.push(expr());
      return { k:'print', args, ln }; }
    if (at('KW','IF')) {
      p++; const cond = expr(); eat('KW','THEN'); skipEol();
      const then = [], els = [];
      while (!at('KW','ELSE') && !at('KW','END')) { if (at('EOF')) throw err(ln,'IF never closed'); then.push(stmt()); skipEol(); }
      if (opt('KW','ELSE')) { skipEol(); while (!at('KW','END')) { if (at('EOF')) throw err(ln,'ELSE never closed'); els.push(stmt()); skipEol(); } }
      eat('KW','END'); eat('KW','IF');
      return { k:'if', cond, then, els, ln };
    }
    if (at('KW','FOR')) {
      p++; const v = ident(); eat('OP','='); const a = expr(); eat('KW','TO'); const b = expr();
      const st = opt('KW','STEP') ? expr() : { k:'num', v:1 };
      skipEol(); const body = [];
      while (!at('KW','NEXT')) { if (at('EOF')) throw err(ln,'FOR never closed'); body.push(stmt()); skipEol(); }
      eat('KW','NEXT'); if (at('ID')) p++;
      return { k:'for', v, a, b, step: st, body, ln };
    }
    if (at('KW','WHILE')) {
      p++; const cond = expr(); skipEol(); const body = [];
      while (!at('KW','WEND')) { if (at('EOF')) throw err(ln,'WHILE never closed'); body.push(stmt()); skipEol(); }
      eat('KW','WEND');
      return { k:'while', cond, body, ln };
    }
    if (at('KW','DIM')) { p++; const v = ident(); if (opt('KW','AS')) ident(); return { k:'dim', v, ln }; }
    if (at('KW','CONST')) { p++; const v = ident(); eat('OP','='); return { k:'const', v, value: expr(), ln }; }
    if (at('KW','EXIT')) { p++; const what = at('KW') ? eat('KW').v : 'STAGE'; return { k:'exit', what, ln }; }
    if (at('KW','RETURN')) { p++; return { k:'return', value: at('EOL') ? null : expr(), ln }; }
    if (at('ID')) { const id = ident();
      if (opt('OP','(')) { const args = []; if (!at('OP',')')) { args.push(expr()); while (opt('OP',',')) args.push(expr()); } eat('OP',')');
        return { k:'call', id, args, ln }; }
      return { k:'call', id, args: [], ln }; }
    throw err(ln, `cannot parse statement starting at ${peek().v ?? peek().t}`);
  }

  /* expressions: precedence climbing */
  function expr(min = 0) {
    let l = unary();
    const P = { 'OR':1,'AND':2,'=':3,'<>':3,'<':3,'>':3,'<=':3,'>=':3,
                '+':4,'-':4,'*':5,'/':5,'MOD':5,'\\':5,'^':6 };
    for (;;) {
      const t = peek();
      const op = (t.t === 'OP' || t.t === 'KW') ? t.v : null;
      if (op == null || !(op in P) || P[op] < min) break;
      p++;
      const r = expr(P[op] + (op === '^' ? 0 : 1));
      l = { k:'bin', op, l, r };
    }
    return l;
  }
  function unary() {
    if (at('KW','NOT')) { p++; return { k:'un', op:'NOT', v: unary() }; }
    if (at('OP','-'))   { p++; return { k:'un', op:'-',   v: unary() }; }
    return atom();
  }
  function atom() {
    if (at('NUM')) return { k:'num', v: eat('NUM').v };
    if (at('STR')) return { k:'str', v: eat('STR').v };
    if (at('KW','TRUE'))    { p++; return { k:'bool', v:true }; }
    if (at('KW','FALSE'))   { p++; return { k:'bool', v:false }; }
    if (at('KW','NOTHING')) { p++; return { k:'nothing' }; }
    if (at('OP','(')) { p++; const e = expr(); eat('OP',')'); return e; }
    if (at('OP','[')) { p++; const items = []; if (!at('OP',']')) { items.push(expr()); while (opt('OP',',')) items.push(expr()); } eat('OP',']'); return { k:'list', items }; }
    if (at('ID')) {
      const id = dotted();
      if (opt('OP','(')) { const args = []; if (!at('OP',')')) { args.push(expr()); while (opt('OP',',')) args.push(expr()); } eat('OP',')');
        return { k:'fn', id, args }; }
      return { k:'var', id };
    }
    throw err(peek().ln, `expected a value, found ${peek().v ?? peek().t}`);
  }

  function name()   { return at('ID') ? eat('ID').v : eat('KW').v; }
  function ident()  { return at('ID') ? eat('ID').v : eat('KW').v; }
  function dotted() { let s = ident(); while (at('OP','.')) { p++; s += '.' + ident(); } return s; }
}

/* ── 3. Built-in functions. Pure, small, and named for what a prompt cycle needs. ── */
export const BUILTINS = {
  LEN: s => (s == null ? 0 : (Array.isArray(s) ? s.length : String(s).length)),
  WORDS: s => String(s ?? '').trim().split(/\s+/).filter(Boolean).length,
  UPPER: s => String(s ?? '').toUpperCase(),
  LOWER: s => String(s ?? '').toLowerCase(),
  TRIM: s => String(s ?? '').trim(),
  LEFT: (s,n) => String(s ?? '').slice(0, n),
  RIGHT: (s,n) => String(s ?? '').slice(-n),
  MID: (s,i,n) => String(s ?? '').substr(i-1, n),
  INSTR: (s,f) => String(s ?? '').indexOf(f) + 1,
  VAL: s => parseFloat(s) || 0,
  STR: n => String(n),
  ISJSON: s => { try { JSON.parse(String(s)); return true; } catch { return false; } },
  HAS: (o,k) => { try { const j = typeof o === 'string' ? JSON.parse(o) : o;
                        return !!j && Object.prototype.hasOwnProperty.call(j, k); } catch { return false; } },
  COUNT: a => Array.isArray(a) ? a.length : 0,
  EMPTY: v => v == null || String(v).trim() === '',
  MATCHES: (s,re) => new RegExp(re).test(String(s ?? '')),
  MIMEOF: k => MIME[String(k).toUpperCase()] || 'application/octet-stream'
};

/* ── 4. The machine. Yields at ASK and at GATE; the host resumes it. ── */

export class Machine {
  constructor(prog, opts = {}) {
    this.prog = prog;
    this.cycler = prog.cyclers.find(c => !opts.cycler || c.id === opts.cycler) || prog.cyclers[0];
    this.resolution = opts.resolution || 'MID';
    this.vars = Object.create(null);
    this.out = [];
    this.i = 0;
    this.done = false;
    this.subs = Object.fromEntries(prog.subs.map(s => [s.id, s]));
    this.artifacts = [];
  }

  /* EVERY STAGE RUNS AT EVERY RESOLUTION. This returns the whole cycle, always.
     `stage.resolution` no longer gates visibility; it records the level at which a stage's
     CONTROLS are exposed, which the host reads — see `controls()`. */
  visible() { return this.cycler.stages; }

  /* What the host should put in front of a person at this resolution. */
  controls(res = this.resolution) {
    const s = this.stage();
    if (!s) return null;
    const auto = res === 'EASY';
    return {
      showPrompt:   res !== 'EASY',
      editPrompt:   res === 'PRO',
      showShape:    res !== 'EASY',
      editShape:    res === 'PRO',
      showValidate: res === 'PRO',
      editSource:   res === 'PRO',
      /* At EASY the person still crosses every gate. A boundary is never automated away —
         that is authority, not machinery, and simplifying the interface must not touch it. */
      gateAlways:   true,
      oneButton:    auto,
      label: auto ? 'Next' : 'File this answer'
    };
  }
  setResolution(r) { if (RESOLUTIONS.includes(r)) this.resolution = r; return this.resolution; }

  stage() { return this.cycler.stages[this.i] || null; }

  /** Build the prompt for the current stage. Interpolation is {var} — nothing else. */
  prompt() {
    const s = this.stage();
    if (!s || !s.ask) return null;
    const ctx = this.context();
    const filled = s.ask.replace(/\{([A-Za-z_][A-Za-z0-9_.]*)\}/g,
      (_, k) => { const v = this.get(k); return v == null ? '' : String(v); });
    const L = [filled, ''];
    L.push(`— shape expected: ${s.expect} (${MIME[s.expect] || 'text/plain'})`);
    if (this.cycler.contract.refuse.length) {
      L.push('— this cycler refuses:');
      for (const r of this.cycler.contract.refuse) L.push(`    · ${r}`);
    }
    if (s.from.length) {
      L.push('— already established:');
      for (const f of s.from) { const v = this.get(f); if (v != null && String(v).trim()) L.push(`    ${f}: ${v}`); }
    }
    L.push('');
    L.push('Where you do not know, write UNRESOLVED. Do not supply a plausible value.');
    return { text: L.join('\n'), stage: s.id, expect: s.expect,
             mime: MIME[s.expect] || 'text/plain', ctx };
  }

  context() {
    return { cycler: this.cycler.id, title: this.cycler.title, unit: this.cycler.unit,
             stage: this.stage() ? this.stage().id : null,
             index: this.i, total: this.cycler.stages.length,
             resolution: this.resolution };
  }

  /** Run until the machine needs something: a prompt answered, or a gate crossed. */
  step() {
    const s = this.stage();
    if (!s) { this.done = true; return { need:'done', out:this.out.slice() }; }
    for (const st of s.body) this.exec(st);
    if (s.gate && !s.gateCrossed)
      return { need:'gate', stage:s.id, who:s.gate.who, word:s.gate.word,
               why:`${s.id} crosses a boundary only ${s.gate.who.toLowerCase()} may cross`,
               out:this.out.splice(0) };
    if (s.ask && !s.answered)
      return { need:'answer', stage:s.id, prompt:this.prompt(), optional:s.optional,
               out:this.out.splice(0) };
    return this.advance();
  }

  crossGate(word) {
    const s = this.stage();
    if (!s || !s.gate) return { ok:false, why:'no gate here' };
    if (s.gate.word && String(word).trim() !== s.gate.word)
      return { ok:false, why:`the gate word is exactly "${s.gate.word}". Nothing was done.` };
    s.gateCrossed = true;
    return { ok:true, why:`${s.id} crossed by ${s.gate.who.toLowerCase()}` };
  }

  /** Give the machine what came back. It validates, stores, and moves — or routes. */
  answer(value) {
    const s = this.stage();
    if (!s) return { ok:false, why:'nothing is being asked' };
    const shaped = this.shape(value, s.expect);
    if (!shaped.ok) {
      if (s.optional) { s.answered = true; return { ok:true, note:'skipped (optional)', ...this.advance() }; }
      return { ok:false, why:shaped.why, route:s.onFail || 'REPAIR' };
    }
    if (s.into) this.set(s.into, shaped.value);
    for (const v of s.validate) {
      if (!truthy(this.eval(v))) {
        return { ok:false, why:`VALIDATE failed at stage ${s.id}`, route:s.onFail || 'REPAIR' };
      }
    }
    if (s.attach) this.artifacts.push({ kind:s.attach, stage:s.id,
      provenance:'chosen by the operator; origin not asserted', at:new Date().toISOString() });
    s.answered = true;
    return { ok:true, ...this.advance() };
  }

  shape(v, expect) {
    if (v == null || String(v).trim() === '') return { ok:false, why:'nothing was returned' };
    const s = String(v).trim();
    if (expect === 'JSON' || expect === 'LIST') {
      const t = s.replace(/^```[a-z]*\n?/i,'').replace(/```$/,'').trim();
      const a = t.indexOf('['), o = t.indexOf('{');
      const i0 = (a !== -1 && (o === -1 || a < o)) ? a : o;
      const i1 = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
      if (i0 === -1 || i1 <= i0) return { ok:false, why:`expected ${expect}; that is not JSON` };
      try { const j = JSON.parse(t.slice(i0, i1 + 1));
        if (expect === 'LIST' && !Array.isArray(j)) return { ok:false, why:'expected a JSON array' };
        return { ok:true, value:j };
      } catch (e) { return { ok:false, why:`expected ${expect}; ${e.message}` }; }
    }
    if (expect === 'NUMBER') { const n = parseFloat(s);
      return isNaN(n) ? { ok:false, why:'expected a number' } : { ok:true, value:n }; }
    if (expect === 'BOOLEAN') return { ok:true, value: /^(true|yes|1)$/i.test(s) };
    return { ok:true, value:s };
  }

  advance() {
    const s = this.stage();
    if (s && s.repeat) {
      const list = this.get(s.repeat);
      s._n = (s._n || 0) + 1;
      if (Array.isArray(list) && s._n < list.length) { s.answered = false; return this.step(); }
    }
    this.i++;
    if (this.i >= this.cycler.stages.length) { this.done = true; return { need:'done', out:this.out.splice(0) }; }
    return this.step();
  }

  /* variables, with dotted paths */
  get(path) {
    const parts = String(path).split('.');
    let o = this.vars;
    for (const k of parts) { if (o == null) return undefined; o = o[k]; }
    return o;
  }
  set(path, v) {
    const parts = String(path).split('.');
    let o = this.vars;
    for (let k = 0; k < parts.length - 1; k++) { if (typeof o[parts[k]] !== 'object' || o[parts[k]] == null) o[parts[k]] = {}; o = o[parts[k]]; }
    o[parts[parts.length - 1]] = v;
  }

  exec(st) {
    switch (st.k) {
      case 'let': case 'const': this.set(st.target || st.v, this.eval(st.value)); return;
      case 'dim': this.set(st.v, ''); return;
      case 'print': this.out.push(st.args.map(a => fmt(this.eval(a))).join(' ')); return;
      case 'if': if (truthy(this.eval(st.cond))) st.then.forEach(x => this.exec(x));
                 else st.els.forEach(x => this.exec(x)); return;
      case 'for': {
        const a = this.eval(st.a), b = this.eval(st.b), sp = this.eval(st.step) || 1;
        for (let n = a; sp > 0 ? n <= b : n >= b; n += sp) { this.set(st.v, n); st.body.forEach(x => this.exec(x)); }
        return; }
      case 'while': { let guard = 0;
        while (truthy(this.eval(st.cond))) { if (++guard > 100000) throw err(st.ln, 'WHILE ran 100000 times — refusing to hang');
          st.body.forEach(x => this.exec(x)); }
        return; }
      case 'call': {
        const s = this.subs[st.id];
        if (!s) throw err(st.ln, `no SUB named ${st.id}`);
        const saved = { ...this.vars };
        s.params.forEach((pn, i) => this.set(pn, st.args[i] != null ? this.eval(st.args[i]) : undefined));
        s.body.forEach(x => this.exec(x));
        for (const k of Object.keys(this.vars)) if (!(k in saved) && s.params.includes(k)) delete this.vars[k];
        return; }
      case 'exit': case 'return': return;
      default: throw err(st.ln || 0, `cannot execute ${st.k}`);
    }
  }

  eval(e) {
    if (!e) return undefined;
    switch (e.k) {
      case 'num': case 'str': case 'bool': return e.v;
      case 'nothing': return null;
      case 'list': return e.items.map(x => this.eval(x));
      case 'var': return this.get(e.id);
      case 'un': return e.op === 'NOT' ? !truthy(this.eval(e.v)) : -this.eval(e.v);
      case 'fn': {
        const f = BUILTINS[String(e.id).toUpperCase()];
        if (!f) throw new Error(`no such function: ${e.id}`);
        return f(...e.args.map(a => this.eval(a))); }
      case 'bin': {
        const a = this.eval(e.l), b = this.eval(e.r);
        switch (e.op) {
          case '+': return (typeof a === 'string' || typeof b === 'string') ? String(a ?? '') + String(b ?? '') : a + b;
          case '-': return a - b; case '*': return a * b; case '/': return a / b;
          case '\\': return Math.trunc(a / b); case 'MOD': return a % b; case '^': return Math.pow(a, b);
          case '=': return a === b; case '<>': return a !== b;
          case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b;
          case 'AND': return truthy(a) && truthy(b); case 'OR': return truthy(a) || truthy(b);
        } }
    }
    throw new Error(`cannot evaluate ${e.k}`);
  }
}

const truthy = v => !(v === false || v == null || v === 0 || v === '' );
const fmt = v => v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));

/* ── 5. Static check. A cycler that cannot pass this should not ship. ── */
export function check(prog) {
  const problems = [];
  for (const c of prog.cyclers) {
    if (!c.title) problems.push(`${c.id}: no TITLE`);
    if (!c.purpose) problems.push(`${c.id}: no PURPOSE — a cycler that cannot say what it is for is not one`);
    if (!c.output) problems.push(`${c.id}: no OUTPUT — cyclers are classified by what comes out`);
    if (!c.contract.refuse.length) problems.push(`${c.id}: refuses nothing; the refusals are the specification`);
    const ids = new Set();
    for (const s of c.stages) {
      if (ids.has(s.id)) problems.push(`${c.id}/${s.id}: duplicate stage id`);
      ids.add(s.id);
      if (!s.ask && !s.body.length && !s.gate)
        problems.push(`${c.id}/${s.id}: neither asks, computes nor gates — it does nothing`);
      if (s.ask && /^\s*(describe|explain|summari[sz]e|discuss)\b/i.test(s.ask))
        problems.push(`${c.id}/${s.id}: the prompt opens by asking for prose ABOUT a thing rather than the thing`);
      if (s.into && !s.ask && !s.body.length)
        problems.push(`${c.id}/${s.id}: INTO ${s.into} but nothing produces a value`);
      if (s.ask && !s.into && !s.optional)
        problems.push(`${c.id}/${s.id}: asks but stores nothing — add INTO`);
    }
    if (!c.stages.some(s => s.resolution === 'EASY'))
      problems.push(`${c.id}: no stage is visible at EASY resolution`);
  }
  return problems;
}

export function run(src, opts) { return new Machine(parse(src), opts); }
export default { VERSION, lex, parse, check, run, Machine, BUILTINS, MIME, VERBS, RESOLUTIONS, EXPECTS };
