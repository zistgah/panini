/* recorder.js — capture the way you actually work, and write it back as a cycler.
 *
 * THIS IS THE POINT. Not a feature of the studio: the reason the studio exists.
 *
 * You already have a way of working through a piece. It lives in your hands and in the order you
 * do things, and every time you sit down you rebuild it from memory. The recorder watches one
 * real session — what you asked, in what order, what shape came back, what you rejected, where
 * you stopped to decide — and writes a .pni you can run again.
 *
 * WHAT IT RECORDS, and what it refuses to
 * ---------------------------------------
 * It records the SHAPE of your working: the prompts, their order, the shapes of the answers, the
 * gates you insisted on, the validations you added after something came back wrong.
 *
 * It does NOT record the answers themselves. Those are the work, not the method — and a recorder
 * that swept up your content would make the .pni unshareable and, for yadein, a privacy incident.
 * A recorded cycler is a method you can hand to somebody else.
 */

export class Recorder {
  constructor(meta = {}) {
    this.meta = Object.assign({ id: 'MYCYCLE', title: 'My cycle', output: 'PRINT',
                                unit: 'item', purpose: '' }, meta);
    this.steps = [];
    this.refusals = [];
    this.started = new Date().toISOString();
    this.on = true;
  }

  /** A prompt you sent. `shape` is what you were expecting back. */
  asked(prompt, shape = 'TEXT', into = null) {
    if (!this.on) return;
    this.steps.push({ kind: 'ask', prompt: String(prompt || '').trim(), shape, into,
                      at: Date.now(), rejected: 0, validate: [] });
    return this.steps.length - 1;
  }

  /** You rejected an answer. That is a validation you have not written down yet. */
  rejected(why) {
    const s = this.last('ask'); if (!s) return;
    s.rejected++;
    if (why && !s.reasons) s.reasons = [];
    if (why) s.reasons.push(String(why));
  }

  /** You accepted. If a shape came back that you did not expect, the recording learns it. */
  accepted(actualShape) {
    const s = this.last('ask'); if (!s) return;
    s.accepted = true;
    if (actualShape && actualShape !== s.shape) s.shape = actualShape;
  }

  /** You stopped and decided something yourself. That is a gate, and it belongs in the cycler. */
  gated(label, word) {
    if (!this.on) return;
    this.steps.push({ kind: 'gate', label: String(label || 'DECIDE'), word: word || null, at: Date.now() });
  }

  /** You brought a file back. Binary shape, through the inbox. */
  attached(shape = 'ANY') {
    if (!this.on) return;
    this.steps.push({ kind: 'attach', shape, at: Date.now() });
  }

  /** You said out loud what this cycle will not do. */
  refuses(text) { if (text) this.refusals.push(String(text).trim()); }

  last(kind) {
    for (let i = this.steps.length - 1; i >= 0; i--)
      if (this.steps[i].kind === kind) return this.steps[i];
    return null;
  }

  /** What the recording noticed about how you work. Observations, not instructions. */
  observations() {
    const asks = this.steps.filter(s => s.kind === 'ask');
    const o = [];
    if (!asks.length) return ['Nothing was recorded yet.'];
    const rej = asks.filter(s => s.rejected > 0);
    if (rej.length)
      o.push(`${rej.length} of ${asks.length} prompts needed more than one attempt. Those became VALIDATE lines.`);
    const gates = this.steps.filter(s => s.kind === 'gate');
    if (gates.length) o.push(`You stopped to decide ${gates.length} time${gates.length===1?'':'s'}. Those became gates.`);
    const bin = asks.filter(s => !['TEXT','JSON','LIST','NUMBER','BOOLEAN'].includes(s.shape));
    if (bin.length) o.push(`${bin.length} answer${bin.length===1?'':'s'} came back as a file, not as text.`);
    const gaps = [];
    for (let i = 1; i < asks.length; i++) {
      const d = (asks[i].at - asks[i-1].at) / 1000;
      if (d > 300) gaps.push(i);
    }
    if (gaps.length) o.push(`You paused for more than five minutes ${gaps.length} time${gaps.length===1?'':'s'}. Long pauses often mark where a cycle really divides.`);
    return o;
  }

  /* ── writing it back out ────────────────────────────────────────────────
     The output is a .pni: a text you can read, correct and run again. Nothing is inferred that
     was not observed, and where the recording cannot tell, it says so in a REM rather than
     inventing a plausible line. */
  toPni() {
    const L = [];
    const q = s => '"' + String(s).replace(/"/g, '\\"') + '"';
    const id = String(this.meta.id || 'MYCYCLE').toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const asks = this.steps.filter(s => s.kind === 'ask');

    L.push('REM  Recorded from one real session on ' + this.started.slice(0, 10) + '.');
    L.push('REM  This is your method, not your content: the prompts and their order were kept,');
    L.push('REM  the answers were not. Read it, correct it, run it again.');
    L.push('');
    L.push('CYCLER ' + id);
    L.push('  TITLE   ' + q(this.meta.title));
    if (this.meta.script) L.push('  SCRIPT  ' + q(this.meta.script));
    L.push('  OUTPUT  ' + String(this.meta.output).toUpperCase());
    L.push('  UNIT    ' + q(this.meta.unit));
    L.push('  PURPOSE ' + q(this.meta.purpose || 'REPLACE THIS: what a person is trying to do here.'));
    L.push('');
    L.push('  CONTRACT');
    if (this.refusals.length) for (const r of this.refusals) L.push('    REFUSE    ' + q(r));
    else {
      L.push('    REM  You did not say what this cycle refuses. The refusals are the');
      L.push('    REM  specification, so this will not check clean until you write one.');
      L.push('    REFUSE    "REPLACE THIS: what this cycle will not do"');
    }
    L.push('  END CONTRACT');

    let n = 0;
    for (const s of this.steps) {
      L.push('');
      if (s.kind === 'gate') {
        L.push('  STAGE ' + name(s.label, ++n));
        L.push('    RESOLUTION EASY          \' a boundary is crossed at every level');
        L.push('    VERB  INTEGRATE');
        L.push('    GATE  HUMAN ' + q(s.word || s.label));
        L.push('  END STAGE');
        continue;
      }
      if (s.kind === 'attach') {
        L.push('  STAGE ' + name('ATTACH', ++n));
        L.push('    RESOLUTION MID');
        L.push('    VERB   INTEGRATE');
        L.push('    EXPECT ' + s.shape);
        L.push('    OPTIONAL');
        L.push('    ATTACH INBOX');
        L.push('    ASK');
        L.push('      Bring back the file that belongs here.');
        L.push('    END ASK');
        L.push('  END STAGE');
        continue;
      }
      const sid = name(s.into || firstWords(s.prompt), ++n);
      L.push('  STAGE ' + sid);
      L.push('    RESOLUTION ' + (n <= 2 ? 'EASY' : 'MID'));
      L.push('    VERB   ' + verbFor(s));
      L.push('    EXPECT ' + s.shape);
      if (s.into) L.push('    INTO   ' + s.into);
      L.push('    ASK');
      for (const line of String(s.prompt).split('\n')) L.push('      ' + line);
      L.push('    END ASK');
      if (s.rejected > 0) {
        L.push("    REM  You rejected " + s.rejected + " answer" + (s.rejected===1?'':'s') + " here.");
        if (s.reasons && s.reasons.length)
          for (const r of s.reasons.slice(0, 3)) L.push('    REM    ' + r);
        L.push('    REM  Write the check that would have caught it:');
        L.push('    VALIDATE NOT EMPTY(' + (s.into || 'result') + ')');
        L.push('    ON FAIL REPAIR');
      }
      L.push('  END STAGE');
    }
    L.push('');
    L.push('END CYCLER');
    return L.join('\n');

    function name(x, i) {
      const s = String(x || 'STEP').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
      return (s || 'STEP') + (s.length < 2 ? String(i) : '');
    }
    function firstWords(p) {
      return String(p || '').trim().split(/\s+/).slice(0, 2).join('_') || 'STEP';
    }
    function verbFor(s) {
      const p = String(s.prompt).toLowerCase();
      if (/\bcheck|verify|confirm|is it true\b/.test(p)) return 'VERIFY';
      if (/\brun\b|\bexecute\b/.test(p)) return 'EXECUTE';
      if (/\bmeasure\b|\bhow many\b|\bhow long\b/.test(p)) return 'MEASURE';
      if (/\bbreak\b|\bkill\b|counterexample/.test(p)) return 'FALSIFY';
      if (/\bcombine\b|\bfold\b|\bwhole\b|abstract/.test(p)) return 'INTEGRATE';
      return 'CREATE';
    }
  }

  toJSON() {
    return { meta: this.meta, started: this.started, steps: this.steps,
             refusals: this.refusals, observations: this.observations() };
  }
  static fromJSON(j) {
    const r = new Recorder(j.meta);
    r.started = j.started; r.steps = j.steps || []; r.refusals = j.refusals || [];
    return r;
  }
}

export default { Recorder };
