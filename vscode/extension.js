/* extension.js — PANINI in VS Code.
 *
 * Three things and no more: check on save, an outline by resolution, and a runner that hands the
 * prompt to whichever AI the operator uses. The extension is a HOST — it never becomes a provider,
 * and every provider in the list comes from settings the operator edits.
 */
const vscode = require('vscode');
const path = require('path');

let P = null, diag = null;

async function panini() {
  if (P) return P;
  const ws = vscode.workspace.workspaceFolders;
  const tries = [];
  for (const f of ws || []) {
    tries.push(path.join(f.uri.fsPath, 'panini.js'));
    tries.push(path.join(f.uri.fsPath, 'src', 'panini.js'));
  }
  tries.push(path.join(__dirname, 'panini.js'), path.join(__dirname, '..', 'panini.js'));
  for (const t of tries) {
    try { P = await import('file://' + t); return P; } catch (e) { /* keep looking */ }
  }
  /* Say where it looked. A tool that cannot find its own engine must not guess at one. */
  vscode.window.showErrorMessage(
    'PANINI: panini.js not found. Looked in:\n  ' + tries.join('\n  '));
  return null;
}

function severity(problem) {
  return /refuses nothing|no PURPOSE|no OUTPUT|prose ABOUT/.test(problem)
    ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;
}

async function check(doc) {
  if (!doc || doc.languageId !== 'panini') return;
  const p = await panini(); if (!p) return;
  const out = [];
  try {
    const prog = p.parse(doc.getText());
    for (const problem of p.check(prog)) {
      /* point at the stage the problem names, if it names one */
      const m = problem.match(/^[A-Za-z0-9_]+\/([A-Za-z0-9_]+):/);
      let line = 0;
      if (m) {
        const re = new RegExp('^\\s*STAGE\\s+' + m[1] + '\\b', 'i');
        for (let i = 0; i < doc.lineCount; i++) if (re.test(doc.lineAt(i).text)) { line = i; break; }
      }
      out.push(new vscode.Diagnostic(doc.lineAt(line).range, problem, severity(problem)));
    }
  } catch (e) {
    const ln = Math.max(0, (e.line || 1) - 1);
    out.push(new vscode.Diagnostic(doc.lineAt(Math.min(ln, doc.lineCount - 1)).range,
      e.message, vscode.DiagnosticSeverity.Error));
  }
  diag.set(doc.uri, out);
}

/** The outline shows what a person SEES at each resolution — never what runs differently. */
async function outline(editor) {
  const p = await panini(); if (!p) return;
  let m;
  try { m = p.run(editor.document.getText()); }
  catch (e) { return vscode.window.showErrorMessage('PANINI: ' + e.message); }
  const res = vscode.workspace.getConfiguration('panini').get('resolution', 'MID');
  const lines = [];
  for (const r of ['EASY', 'MID', 'PRO']) {
    const v = m.visible(r);
    lines.push(`${r === res ? '▸' : ' '} ${r.padEnd(5)} ${String(v.length).padStart(2)} stages   ` +
               v.map(s => s.id).join('  '));
  }
  lines.push('', 'Resolution changes what you see. It never changes what is computed.');
  vscode.window.showInformationMessage(lines.join('\n'), { modal: true });
}

async function run(editor) {
  const p = await panini(); if (!p) return;
  const cfg = vscode.workspace.getConfiguration('panini');
  let m;
  try { m = p.run(editor.document.getText(), { resolution: cfg.get('resolution', 'MID') }); }
  catch (e) { return vscode.window.showErrorMessage('PANINI: ' + e.message); }

  const chan = vscode.window.createOutputChannel('PANINI');
  chan.show(true);
  chan.appendLine(`${m.cycler.title} — ${m.cycler.purpose}`);
  chan.appendLine('');

  for (;;) {
    const need = m.step();
    for (const l of need.out || []) chan.appendLine('  ' + l);

    if (need.need === 'done') { chan.appendLine('\nThe cycle is complete.'); break; }

    if (need.need === 'gate') {
      chan.appendLine(`\nGATE — ${need.why}`);
      const word = await vscode.window.showInputBox({
        prompt: `Type exactly:  ${need.word}`,
        placeHolder: 'anything else does nothing'
      });
      const r = m.crossGate(word || '');
      chan.appendLine('  ' + r.why);
      if (!r.ok) break;
      continue;
    }

    /* need === 'answer'. THE HOST decides where the prompt goes. */
    chan.appendLine(`\n── ${need.stage} ──`);
    chan.appendLine(need.prompt.text);
    chan.appendLine(`\n(expects ${need.prompt.expect} · ${need.prompt.mime})`);
    await vscode.env.clipboard.writeText(need.prompt.text);

    const providers = cfg.get('providers', []) || [];
    const local = cfg.get('localEndpoint', '');
    const picks = [
      { label: '$(clippy) Prompt copied — paste the answer back', id: 'paste' },
      ...providers.map(x => ({ label: '$(link-external) Open ' + (x.name || x), id: 'open', url: x.url || x })),
      ...(local ? [{ label: '$(server) Answer on this machine', id: 'local' }] : []),
      { label: '$(edit) I will type the answer myself', id: 'paste' },
      { label: '$(x) Stop here', id: 'stop' }
    ];
    const pick = await vscode.window.showQuickPick(picks, {
      title: `${need.stage} — the prompt is on your clipboard`,
      placeHolder: 'Nothing has been sent anywhere.'
    });
    if (!pick || pick.id === 'stop') { chan.appendLine('\nStopped. Nothing was sent.'); break; }
    if (pick.id === 'open') await vscode.env.openExternal(vscode.Uri.parse(pick.url));

    const answer = await vscode.window.showInputBox({
      prompt: `Paste what came back (${need.prompt.expect})`,
      placeHolder: need.optional ? 'leave empty to skip — this stage is optional' : ''
    });
    if (answer === undefined) { chan.appendLine('\nStopped.'); break; }
    const r = m.answer(answer);
    if (!r.ok) {
      chan.appendLine(`  refused: ${r.why}  →  ${r.route}`);
      const again = await vscode.window.showWarningMessage(r.why, 'Try again', 'Stop');
      if (again !== 'Try again') break;
    } else if (r.note) chan.appendLine('  ' + r.note);
  }
}

function activate(ctx) {
  diag = vscode.languages.createDiagnosticCollection('panini');
  ctx.subscriptions.push(diag);
  ctx.subscriptions.push(
    vscode.commands.registerCommand('panini.check', () =>
      check(vscode.window.activeTextEditor && vscode.window.activeTextEditor.document)),
    vscode.commands.registerCommand('panini.outline', () => {
      const e = vscode.window.activeTextEditor; if (e) outline(e); }),
    vscode.commands.registerCommand('panini.run', () => {
      const e = vscode.window.activeTextEditor; if (e) run(e); }),
    vscode.workspace.onDidSaveTextDocument(d => {
      if (vscode.workspace.getConfiguration('panini').get('checkOnSave', true)) check(d); }),
    vscode.workspace.onDidOpenTextDocument(check)
  );
  if (vscode.window.activeTextEditor) check(vscode.window.activeTextEditor.document);
}

function deactivate() { if (diag) diag.dispose(); }
module.exports = { activate, deactivate };
