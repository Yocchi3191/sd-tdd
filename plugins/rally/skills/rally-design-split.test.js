// plugins/rally/skills/rally-design-split.test.js
// issue-103: rally:design を spec-interview（要件・仕様）と design（設計・ADR、新設）に分割する
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILLS_DIR = __dirname;
const skillPath = (name) => path.join(SKILLS_DIR, name, 'SKILL.md');
const skillExists = (name) => fs.existsSync(skillPath(name));
const readSkill = (name) => (skillExists(name) ? fs.readFileSync(skillPath(name), 'utf8') : '');

// SKILL.mdは変更しない前提で1回だけ読み、各testはこのキャッシュを参照する
const specInterviewBody = readSkill('spec-interview');
const designBody = readSkill('design');
const tddBody = readSkill('tdd');
const taskFilingBody = readSkill('task-filing');
const submitBody = readSkill('submit');
const prTemplateBody = fs.readFileSync(path.join(SKILLS_DIR, 'submit', 'pr-template.md'), 'utf8');
const pairingBody = fs.readFileSync(path.join(SKILLS_DIR, '..', 'references', 'pairing.md'), 'utf8');

test('issue-103_REQ-1_designディレクトリがspec-interviewにリネームされている', () => {
  assert.equal(skillExists('spec-interview'), true, 'skills/spec-interview/SKILL.md が存在すること');
  assert.match(specInterviewBody, /^---[\s\S]*name:\s*spec-interview[\s\S]*---/m);
});

test('issue-103_REQ-2_spec-interviewは要件仕様REQ台帳作成のみを担当し設計への言及が無い', () => {
  assert.doesNotMatch(specInterviewBody, /仕様が固まったら設計へ/);
  assert.match(specInterviewBody, /要件定義/);
  assert.match(specInterviewBody, /仕様策定|仕様決定|機能仕様検討/);
  assert.match(specInterviewBody, /REQ台帳/);
});

test('issue-103_REQ-3_spec-interviewの記録後の案内先がrally:designになっている', () => {
  assert.doesNotMatch(specInterviewBody, /記録したら実装へ渡す（rally:tdd）/);
  assert.match(specInterviewBody, /rally:design/);
});

test('issue-103_REQ-4_designが設計とADR作成を担う新規skillとして存在する', () => {
  assert.equal(skillExists('design'), true, 'skills/design/SKILL.md が存在すること');
  assert.match(designBody, /^---[\s\S]*name:\s*design[\s\S]*---/m);
  assert.match(designBody, /ADR/);
  assert.match(designBody, /設計/);
});

test('issue-103_REQ-5_designはreferences/pairing.mdの詰めルールに従う', () => {
  assert.match(designBody, /references\/pairing\.md/);
});

test('issue-103_REQ-6_designは設計フェーズで呼ばれ軽微なら短く終える', () => {
  assert.match(designBody, /設計フェーズ/);
  assert.match(designBody, /パッチ相当.*一言で終える/);
});

test('issue-103_REQ-7_designは決定を3点でまとめる', () => {
  assert.match(designBody, /決定内容/);
  assert.match(designBody, /検討した代替案/);
  assert.match(designBody, /却下理由/);
});

test('issue-103_REQ-8_designはREQ追加が必要ならtask-filingの追記操作でissueを更新する', () => {
  assert.match(designBody, /task-filing/);
  assert.match(designBody, /(既存タスクへ追記|追記操作|REQ.*追加)/);
});

test('issue-103_REQ-9_designはissueにADRを書かず一時markdownファイルに書き溜める', () => {
  assert.doesNotMatch(designBody, /issue(本文|コメント)に.*(ADR|決定).*書く/);
  assert.match(designBody, /issue本文にもissueコメントにも.*書かない|issueには.*書き込まない/);
  assert.match(designBody, /\.rally\/adr\.md/);
});

test('issue-103_REQ-10_designはworktreeを自分で作成しない', () => {
  assert.match(designBody, /worktreeを(自分で)?作成しない/);
  assert.match(designBody, /rally:tdd/);
});

test('issue-103_REQ-11_designは決定がまとまったらrally:tddに引き渡す', () => {
  assert.match(designBody, /rally:tdd/);
  assert.match(designBody, /(引き渡|次は.*tdd|tddを呼ぶ)/);
});

test('issue-103_REQ-12_tddの説明が新しい呼び出し順を前提にしている', () => {
  assert.doesNotMatch(tddBody, /rally:design\s*で設計が固まった後の実装フェーズで使う/);
});

test('issue-103_REQ-13_task-filingの決定事項の扱いが要件仕様レベルに限定されている', () => {
  assert.match(taskFilingBody, /spec-interview/);
  assert.match(taskFilingBody, /要件・仕様レベル/);
});

test('issue-103_REQ-14_pr-templateに任意の決定事項ADRセクションがある', () => {
  assert.match(prTemplateBody, /##\s*決定事項（ADR）/);
});

test('issue-103_REQ-15_submitがADR一時ファイルを展開して削除する', () => {
  assert.match(submitBody, /\.rally\/adr\.md/);
  assert.match(submitBody, /決定事項（ADR）/);
  assert.match(submitBody, /削除/);
});

test('issue-103_REQ-16_pairing.mdがspec-interview design tddの3skill共通の規約になっている', () => {
  assert.match(pairingBody, /spec-interview/);
  assert.match(pairingBody, /design/);
  assert.match(pairingBody, /tdd/);
  assert.doesNotMatch(pairingBody, /「案出して」\s*—\s*design\s*で/);
});
