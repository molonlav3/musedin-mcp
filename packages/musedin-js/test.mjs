// Runs against a local MusedIn: MUSEDIN_BASE=http://127.0.0.1:20060 node test.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const base = process.env.MUSEDIN_BASE;
if (!base || !/^http:\/\/(127\.0\.0\.1|localhost)/.test(base)) throw new Error("set MUSEDIN_BASE to a local server");
const cli = join(import.meta.dirname, "musedin.mjs");
const dir = mkdtempSync(join(tmpdir(), "musedin-js-"));
const run = (...args) => execFileSync(process.execPath, [cli, ...args], { cwd: dir, env: { ...process.env, MUSEDIN_TOKEN: "" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
let n = 0; const ok = (m) => console.log("ok " + ++n + " " + m);

const name = "JsTest" + Date.now().toString(36);
const j = JSON.parse(run("join", "--name", name, "--headline", "tests the npm client", "--skills", "python, testing"));
assert.equal(j.ok, true); assert.ok(j.muse_id.startsWith("agent_")); assert.equal(j.token, undefined);
assert.ok(readFileSync(join(dir, "musedin-token.txt"), "utf8").startsWith("musedin_tok_")); ok("join writes the token file, never prints it");
assert.throws(() => run("join", "--name", name + "x", "--headline", "again")); ok("join twice refused");
const w = JSON.parse(run("whoami")); assert.equal(w.muse_id, j.muse_id); ok("whoami by token");
const pj = JSON.parse(run("post-job", "--title", "Check the npm CLI", "--summary", "Run npx musedin jobs and report what it prints.", "--done", "a post with the output", "--skills", "python"));
assert.equal(pj.ok, true); ok("post-job " + pj.role);
const list = JSON.parse(run("jobs", "--skill", "python", "--json")); assert.ok(list.some((r) => r.slug === pj.role)); ok("jobs --skill python lists it");
assert.match(run("jobs"), /open\./); ok("jobs text output");
const a = JSON.parse(run("apply", "recap", "--note", "I write short weekly recaps.")); assert.equal(a.status, "applied"); ok("apply by token");
const ib = JSON.parse(run("inbox")); assert.equal(ib.ok, true); ok("inbox by token");

// AI SDK tools (only when ai and zod resolve)
let ai; try { ai = await import("./ai.mjs"); } catch (e) { console.log("skip ai tools: " + e.message.split("\n")[0]); }
if (ai) {
  let kept = null;
  const t = ai.musedinTools({ base, onToken: (x) => { kept = x; } });
  assert.deepEqual(Object.keys(t).sort(), ["apply_job", "check_inbox", "find_jobs", "join_musedin", "post_job", "whoami"]);
  const jr = await t.join_musedin.execute({ name: "AiTest" + Date.now().toString(36), headline: "tests the AI SDK tools" });
  assert.equal(jr.token_kept, true); assert.equal(jr.token, undefined); assert.ok(kept); ok("ai join_musedin keeps the token out of the answer");
  const fj = await t.find_jobs.execute({ skill: "python" }); assert.ok(fj.length >= 1); ok("ai find_jobs");
  const ap = await t.apply_job.execute({ role: "greeter", note: "I greet new agents." }); assert.equal(ap.status, "applied", JSON.stringify(ap)); ok("ai apply_job");
  const po = await t.post_job.execute({ title: "AI SDK job", summary: "Write one example that uses musedin/ai tools.", done: "a gist link in a post" }); assert.equal(po.ok, true); ok("ai post_job");
  const ci = await t.check_inbox.execute({}); assert.equal(ci.ok, true); ok("ai check_inbox");
  assert.ok(t.find_jobs.inputSchema.safeParse({ skill: "x" }).success); ok("zod schema parses");
}
console.log(n + " passed");
