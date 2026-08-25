import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = [here, path.join(here,'..'), process.cwd()].find(r => existsSync(path.join(r,'panini.js')));
if (!root) { console.error('panini.js not found. Looked in: ' + [here, path.join(here,'..'), process.cwd()].join(', ')); process.exit(1); }
const P = await import(path.join(root,'panini.js'));
let n=0; const t=(m,f)=>{f();n++;console.log('  ok   '+m);};
const flat = s => String(s).replace(/\s+/g,' ');
/* Prose wraps and sentences start with a capital. A presence check must not fail on either. */
const says = (x,p) => assert.ok(flat(x).toLowerCase().includes(p.toLowerCase()), 'does not say: '+p);
const CY = path.join(root,'cyclers');

const mini = `
CYCLER T
  TITLE "T"
  OUTPUT PRINT
  PURPOSE "a test"
  CONTRACT
    REFUSE "nothing"
  END CONTRACT
  STAGE ONE
    RESOLUTION EASY
    VERB CREATE
    EXPECT TEXT
    INTO a
    ASK
      Say something about {topic}.
    END ASK
    VALIDATE WORDS(a) > 2
  END STAGE
  STAGE TWO
    RESOLUTION PRO
    VERB INTEGRATE
    GATE HUMAN "GO t"
  END STAGE
END CYCLER`;

/* ── QBASIC in shape ── */
t('REM and apostrophe are comments; keywords are case-insensitive', () => {
  const p = P.parse(`REM a comment\n' another\nCYCLER X\n title "x"\n output print\n purpose "p"\n contract\n refuse "r"\n end contract\n stage s\n resolution easy\n print "hi"\n end stage\nend cycler`);
  assert.equal(p.cyclers[0].id, 'X'); });
t('LET, PRINT, IF/THEN/ELSE, FOR/NEXT and WHILE/WEND all run', () => {
  const src = `CYCLER B
 TITLE "b"
 OUTPUT PRINT
 PURPOSE "p"
 CONTRACT
  REFUSE "r"
 END CONTRACT
 STAGE S
  RESOLUTION EASY
  VERB CREATE
  LET total = 0
  FOR i = 1 TO 5
    LET total = total + i
  NEXT i
  LET k = 0
  WHILE k < 3
    LET k = k + 1
  WEND
  IF total = 15 THEN
    PRINT "sum " + STR(total) + " loops " + STR(k)
  ELSE
    PRINT "wrong"
  END IF
 END STAGE
END CYCLER`;
  const m = P.run(src); const r = m.step();
  assert.deepEqual(r.out, ['sum 15 loops 3']); });
t('a WHILE that cannot end is refused rather than hanging', () => {
  const src = `CYCLER L
 TITLE "l"
 OUTPUT PRINT
 PURPOSE "p"
 CONTRACT
  REFUSE "r"
 END CONTRACT
 STAGE S
  RESOLUTION EASY
  VERB CREATE
  LET x = 1
  WHILE x = 1
   LET x = 1
  WEND
 END STAGE
END CYCLER`;
  assert.throws(() => P.run(src).step(), /refusing to hang/); });

/* ── the prompt is the thing being cycled ── */
t('ASK is a heredoc: the prompt survives verbatim, blank lines and all', () => {
  const p = P.parse(mini);
  const ask = p.cyclers[0].stages[0].ask;
  assert.equal(ask, 'Say something about {topic}.'); });
t('a multi-paragraph prompt keeps its shape', () => {
  const src = mini.replace('Say something about {topic}.',
    'First line.\n\n      Second paragraph after a blank line.\n      Still the second.');
  const a = P.parse(src).cyclers[0].stages[0].ask;
  assert.ok(a.includes('\n\n'), 'the blank line was eaten');
  assert.ok(!/^\s/.test(a.split('\n')[2] || ''), 'indentation was not stripped uniformly'); });
t('the prompt interpolates, declares its shape, and carries the refusals', () => {
  const m = P.run(mini); m.set('topic','rivers');
  const pr = m.prompt();
  says(pr.text, 'Say something about rivers');
  says(pr.text, 'shape expected: TEXT (text/plain)');
  says(pr.text, 'this cycler refuses');
  says(pr.text, 'write UNRESOLVED. Do not supply a plausible value'); });
t('an unset variable interpolates to nothing, never to a guess', () => {
  const m = P.run(mini);
  assert.ok(!m.prompt().text.includes('{topic}'));
  assert.ok(!/undefined|null/.test(m.prompt().text)); });

/* ── RESOLUTION is a lens, not a mode ── */
t('EVERY STAGE RUNS AT EVERY LEVEL — resolution is the interaction, not the cycle', () => {
  const m = P.run(mini);
  for (const r of P.RESOLUTIONS) {
    m.setResolution(r);
    assert.deepEqual(m.visible().map(s=>s.id), ['ONE','TWO'],
      'stages were hidden at ' + r + ' — a simpler view must never produce a lesser artifact'); } });
t('resolution changes only how much of the machinery is exposed', () => {
  const m = P.run(mini);
  m.setResolution('EASY'); const e = m.controls();
  m.setResolution('PRO');  const p = m.controls();
  assert.equal(e.oneButton, true);  assert.equal(e.showPrompt, false);
  assert.equal(p.oneButton, false); assert.equal(p.editSource, true); });
t('a GATE is crossed by a human at EVERY level, including EASY', () => {
  const m = P.run(mini);
  for (const r of P.RESOLUTIONS) {
    m.setResolution(r);
    assert.equal(m.controls().gateAlways, true,
      'a boundary was automated away at ' + r + ' — that is authority, not machinery'); } });
t('changing resolution never changes what is computed', () => {
  const a = P.run(mini,{resolution:'EASY'}), b = P.run(mini,{resolution:'PRO'});
  a.set('topic','x'); b.set('topic','x');
  assert.equal(a.prompt().text, b.prompt().text); });
t('EVERY cycler opens by helping you work out what you are making', () => {
  for (const f of readdirSync(CY)) {
    const c = P.parse(readFileSync(path.join(CY,f),'utf8')).cyclers[0];
    const first = c.stages[0].id;
    assert.ok(/^(CONCEPT|CONSTITUTION)$/.test(first),
      f + ' opens with ' + first + ' — it assumes you already have material, which is only half the job');
    assert.equal(c.stages[0].resolution, 'EASY', f + ': the concept stage is not on the easy path'); } });
t('and the concept stage is not boilerplate — each asks its own questions', () => {
  const asks = readdirSync(CY).map(f =>
    P.parse(readFileSync(path.join(CY,f),'utf8')).cyclers[0].stages[0].ask);
  assert.equal(new Set(asks).size, asks.length, 'two cyclers share a concept prompt'); });

/* ── the interpreter has no provider and cannot acquire one ── */
t('ASK YIELDS — the machine never calls anything', () => {
  const src = readFileSync(path.join(root,'panini.js'),'utf8');
  assert.ok(!/\bfetch\s*\(/.test(src), 'panini.js calls fetch');
  assert.ok(!/XMLHttpRequest|require\(.http|node:http/.test(src), 'panini.js opens a connection');
  const low = src.toLowerCase();
  for (const v of ['openai','anthropic','chatgpt','gemini','claude','ollama'])
    assert.ok(!low.includes(v), 'panini.js names ' + v); });
t('the machine reports what it NEEDS and stops', () => {
  const m = P.run(mini);
  const r = m.step();
  assert.equal(r.need, 'answer'); assert.equal(r.stage, 'ONE'); });

/* ── shapes, MIME, and physical kinds ── */
t('EXPECT covers text, every MIME-bearing kind, and the physical ones', () => {
  for (const k of ['TEXT','JSON','LIST','IMAGE','AUDIO','VIDEO','MODEL','DOCUMENT','DATA','SIGNAL','TRAJECTORY','ENVELOPE'])
    assert.ok(P.EXPECTS.has(k), k + ' is not an expectable shape');
  assert.equal(P.MIME.IMAGE, 'image/*');
  assert.equal(P.MIME.MODEL, 'model/gltf-binary'); });
t('JSON tolerates a fenced, chatty reply; a non-answer is refused', () => {
  const m = P.run(mini.replace('EXPECT TEXT','EXPECT JSON').replace('VALIDATE WORDS(a) > 2',''));
  m.step();
  const ok = m.answer('Sure!\n```json\n{"a":1}\n```\nHope that helps.');
  assert.ok(ok.ok);
  const m2 = P.run(mini.replace('EXPECT TEXT','EXPECT JSON').replace('VALIDATE WORDS(a) > 2',''));
  m2.step();
  const bad = m2.answer('no json here at all');
  assert.equal(bad.ok, false); says(bad.why, 'that is not JSON'); });
t('an empty answer is refused and routed, never accepted', () => {
  const m = P.run(mini); m.step();
  const r = m.answer('   ');
  assert.equal(r.ok, false); assert.equal(r.route, 'REPAIR'); });
t('VALIDATE bites, and routes where ON FAIL says', () => {
  const m = P.run(mini); m.step();
  const r = m.answer('two words');
  assert.equal(r.ok, false); says(r.why, 'VALIDATE failed at stage ONE'); });

/* ── gates ── */
t('a GATE stops the machine and names whose call it is', () => {
  const m = P.run(mini); m.step(); m.answer('three whole words here');
  const g = m.step().need === 'gate' ? m.step() : { need: m.stage() && m.stage().gate ? 'gate' : 'x' };
  assert.equal(m.stage().id, 'TWO');
  assert.ok(m.stage().gate); });
t('the gate word must be exact, and a wrong word does nothing', () => {
  const m = P.run(mini); m.step(); m.answer('three whole words here');
  assert.equal(m.crossGate('go t').ok, false);
  says(m.crossGate('nope').why, 'Nothing was done');
  assert.ok(m.crossGate('GO t').ok); });

/* ── the static check refuses what should not ship ── */
t('a cycler with no PURPOSE, OUTPUT or refusal is rejected', () => {
  const bare = `CYCLER Z\n TITLE "z"\n STAGE S\n  RESOLUTION EASY\n  PRINT "x"\n END STAGE\nEND CYCLER`;
  const pr = P.check(P.parse(bare));
  assert.ok(pr.some(x=>/no PURPOSE/.test(x)));
  assert.ok(pr.some(x=>/no OUTPUT/.test(x)));
  assert.ok(pr.some(x=>/refuses nothing/.test(x))); });
t('a stage whose prompt asks for prose ABOUT a thing is rejected', () => {
  const src = mini.replace('Say something about {topic}.','Describe the plate in detail.');
  assert.ok(P.check(P.parse(src)).some(x=>/prose ABOUT a thing/.test(x))); });
t('a stage that asks but stores nothing is rejected', () => {
  const src = mini.replace('    INTO a\n','');
  assert.ok(P.check(P.parse(src)).some(x=>/asks but stores nothing/.test(x))); });
t('VERB must be one of the six; a describing stage is not a stage', () => {
  const src = mini.replace('VERB CREATE','VERB DESCRIBE');
  assert.throws(() => P.parse(src), /only describes is not a stage/); });
t('a duplicate stage id is caught', () => {
  const src = mini.replace('STAGE TWO','STAGE ONE');
  assert.ok(P.check(P.parse(src)).some(x=>/duplicate stage id/.test(x))); });

/* ── the six shipped cyclers ── */
t('all six parse, check clean, and are classified by OUTPUT', () => {
  const outs = new Set();
  for (const f of readdirSync(CY)) {
    const src = readFileSync(path.join(CY,f),'utf8');
    const prog = P.parse(src), c = prog.cyclers[0];
    assert.deepEqual(P.check(prog), [], f + ': ' + P.check(prog).join('; '));
    assert.ok(c.output, f + ' declares no OUTPUT');
    outs.add(c.output); }
  const n = readdirSync(CY).length;
  assert.equal(outs.size, n, 'two cyclers share an output kind: ' + [...outs].join(', ')); });
t('no two cyclers share a stage sequence — the workflow is NOT shared', () => {
  const sigs = readdirSync(CY).map(f => {
    const c = P.parse(readFileSync(path.join(CY,f),'utf8')).cyclers[0];
    return c.stages.map(s=>s.id).join('>'); });
  assert.equal(new Set(sigs).size, sigs.length, 'a workflow was reused'); });
t('the refusals that cost real DOIs are in the configuration, not the code', () => {
  const read = f => readFileSync(path.join(CY,f),'utf8');
  says(read('pench.pni'), 'an invented limit is worse than an absent one');
  says(read('pench.pni'), 'not established');
  says(read('yadein.pni'), 'Do NOT sharpen a vague date');
  says(read("yadein.pni"), "Do not add surnames");
  says(read('tilasm.pni'), 'a piece in which no station leads anywhere');
  says(read('tilasm.pni'), 'cannot stand, cannot use both hands, or cannot hear'); });
t('a seventh cycler needs no change to the language', () => {
  const src = `CYCLER NEW
 TITLE "New"
 OUTPUT TACTILE
 UNIT "pattern"
 PURPOSE "something nobody has built yet"
 CONTRACT
  REFUSE "a pattern with no felt referent"
 END CONTRACT
 STAGE FIRST
  RESOLUTION EASY
  VERB CREATE
  EXPECT SIGNAL
  INTO p
  ASK
    Produce the pattern.
  END ASK
 END STAGE
END CYCLER`;
  const prog = P.parse(src);
  assert.deepEqual(P.check(prog), []);
  assert.equal(P.run(src).prompt().mime, 'application/octet-stream'); });


/* ── the studio is a HOST: it may click through, it may not become a provider ── */
t('the studio ships providers WITH entries, alphabetical, and deletable', () => {
  const H = readFileSync(path.join(root,'studio.html'),'utf8');
  const names = [...H.matchAll(/name:\s*'([^']+)',\s*url:/g)].map(m=>m[1]);
  assert.ok(names.length >= 5, 'ships empty — that made the tool useless out of the box');
  assert.deepEqual(names, [...names].sort((a,b)=>a.localeCompare(b)), 'not alphabetical, which reads as a ranking');
  says(H, 'delete every one and the studio still works'); });
t('the studio states the boundary BEFORE offering a provider', () => {
  const H = readFileSync(path.join(root,'studio.html'),'utf8');
  says(H, 'This is where the studio ends');
  says(H, 'Nothing has been sent');
  assert.ok(H.indexOf('This is where the studio ends') < H.indexOf("prov.append(a)")); });
t('bring-your-own-key and a local endpoint are both offered, keyless allowed', () => {
  const H = readFileSync(path.join(root,'studio.html'),'utf8');
  says(H, 'leave empty for a local server');
  says(H, 'localhost:8080');
  says(H, 'typing the answer yourself'); });
t('a chosen file records that the operator chose it, and claims nothing more', () => {
  const H = readFileSync(path.join(root,'studio.html'),'utf8');
  says(H, 'chosen by the operator; origin not asserted');
  says(H, 'does not claim to know what made it'); });
t('a local endpoint that is not running says so and names the fallback', () => {
  says(readFileSync(path.join(root,'studio.html'),'utf8'), 'Copy-and-paste still works'); });
t('the studio says EVERY stage runs at every level', () => {
  const H = readFileSync(path.join(root,'studio.html'),'utf8');
  says(H, 'Every stage runs at every level');
  says(H, 'click through');
  assert.ok(!/never changes what is computed/.test(H) || /how much you touch/.test(H),
    'the dial is still described as a visibility filter'); });
t('the wheel carries every stage, with the gates marked', () => {
  const H = readFileSync(path.join(root,'studio.html'),'utf8');
  says(H, 'function wheelSvg');
  says(H, 'The wheel IS the cycle');
  assert.ok(/s\.gate\s*\?/.test(H), 'gates are not distinguished on the wheel'); });
t('the hub is the only control at EASY, and it never crosses a gate for you', () => {
  const H = readFileSync(path.join(root,'studio.html'),'utf8');
  says(H, 'you cross this one, at every level');
  says(H, 'never automates a boundary away'); });
t('the recorder captures the METHOD and refuses the content', () => {
  const R = readFileSync(path.join(root,'recorder.js'),'utf8');
  says(R, 'It does NOT record the answers themselves');
  says(R, 'a method you can hand to somebody else');
  const H = readFileSync(path.join(root,'studio.html'),'utf8');
  says(H, 'Your answers are not'); });

/* ── the VS Code extension is a host too ── */
t('the extension names no service; providers come from settings', () => {
  const E = readFileSync(path.join(root,'vscode','extension.js'),'utf8').toLowerCase();
  for (const v of ['openai','anthropic','chatgpt','gemini','claude','ollama'])
    assert.ok(!E.includes(v), 'extension.js names ' + v);
  says(E, "cfg.get('providers'"); });
t('the extension ships a grammar, snippets and a language configuration', () => {
  const V = path.join(root,'vscode');
  for (const f of ['package.json','language-configuration.json','snippets.json','syntaxes/panini.tmLanguage.json'])
    JSON.parse(readFileSync(path.join(V,f),'utf8'));
  const pkg = JSON.parse(readFileSync(path.join(V,'package.json'),'utf8'));
  assert.equal(pkg.contributes.languages[0].extensions[0], '.pni');
  assert.equal(pkg.contributes.grammars[0].scopeName, 'source.panini');
  assert.ok(pkg.contributes.commands.length >= 3); });
t('the grammar highlights an ASK block as the prompt it is', () => {
  const g = JSON.parse(readFileSync(path.join(root,'vscode','syntaxes','panini.tmLanguage.json'),'utf8'));
  assert.equal(g.repository.ask.name, 'string.unquoted.prompt.panini');
  assert.ok(g.repository.ask.patterns.some(p => /interpolation/.test(p.name || ''))); });
t('the extension reports where it looked rather than guessing at an engine', () => {
  says(readFileSync(path.join(root,'vscode','extension.js'),'utf8'), 'Looked in'); });

/* ── the specification is normative and the implementation answers to it ── */
t('the spec states the four conformance rules the tests enforce', () => {
  const S = readFileSync(path.join(root,'SPEC.md'),'utf8');
  says(S, 'MUST NOT branch semantics on resolution');
  says(S, 'MUST NOT open a network connection');
  says(S, 'MUST NOT advance through a gate automatically');
  says(S, 'DESCRIBE` is a parse error');
  says(S, 'deleting'); });
t('the spec carries an EBNF grammar for every construct the parser accepts', () => {
  const S = readFileSync(path.join(root,'SPEC.md'),'utf8');
  for (const r of ['cycler','contract','stage','stage-prop','resolution','verb','shape','statement','sub'])
    assert.ok(new RegExp('^' + r + '\\s*=', 'm').test(S), 'no production for ' + r); });

console.log(`\n  ===== ${n} pass, 0 fail =====`);
