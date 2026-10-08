import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createLoader } from "./load-ts.mjs";

process.env.SUPABASE_URL = "https://test.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.OSLO_SESSION_SECRET = "test-secret";
let cookie = "";
let unavailable = false;
const db = {
  students: [], invites: [], sessions: [], attendance_marks: [], postpone_requests: [],
  custom_groups: [], blocked_emails: [], staff_credentials: [], login_events: [],
};
globalThis.fetch = async (url, init = {}) => {
  if (unavailable) throw new Error("Simulated database outage");
  const u = new URL(url);
  const name = u.pathname.split("/").at(-1);
  const rows = db[name];
  if (!rows) throw new Error("Unexpected API call: " + name);
  if (init.method === "POST" && name === "login_events") {
    rows.push(JSON.parse(init.body));
    return new Response(null, { status: 201 });
  }
  const filtered = rows.filter(row => [...u.searchParams].every(([key,value]) => {
    if (["select","order","limit","offset"].includes(key)) return true;
    if (value === "is.null") return row[key] == null;
    if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
    return true;
  }));
  const offset = Number(u.searchParams.get("offset") ?? 0);
  const limit = Number(u.searchParams.get("limit") ?? 500);
  return Response.json(filtered.slice(offset, offset + limit));
};
const load = createLoader({
  "next/headers": { cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }) },
});
const passwords = load("src/lib/server/staff-credentials.ts");
const tokens = load("src/lib/server/session-token.ts");
const auth = load("src/lib/server/session.ts");
const studentRoute = load("src/app/api/auth/student/route.ts");
const staffRoute = load("src/app/api/auth/staff/route.ts");
const sessionRoute = load("src/app/api/auth/session/route.ts");
const studioRoute = load("src/app/api/studio/route.ts");
const inviteStore = load("src/lib/server/invite-store.ts");
const hash = await passwords.hashPassword("test-pass");
const future = new Date(Date.now() + 86400000).toISOString();
db.students.push({
  id:"student-1", name:"Test student", email:"current@example.invalid",
  account_status:"active", session_version:0, archived_at:null,
  package:{startDate:"2026-01-01",endDate:"2026-12-31",totalSessions:4,remainingSessions:4},
});
db.invites.push({
  student_id:"student-1",token:"token-1",password:hash,activated_at:new Date().toISOString(),
  student:{id:"student-1",name:"Stale name",email:"old@example.invalid"},sessions:[],expires_at:future,
});
db.students.push({
  id:"student-2",name:"Invited",email:"invited@example.invalid",account_status:"invited",
  invite_expires_at:future,package:{},session_version:0,
});
db.invites.push({student_id:"student-2",password:null,activated_at:null,student:{email:"invited@example.invalid"}});
db.students.push({
  id:"student-3",name:"Expired",email:"expired@example.invalid",account_status:"invited",
  invite_expires_at:"2020-01-01",package:{},session_version:0,
});
const request = (path, body) => new Request("https://test.invalid" + path, {
  method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),
});
let count=0;
const test=async (name,fn) => {
  await fn(); count++; console.log("PASS " + name);
};
await test("password hash verifies actual password only", async () => {
  assert.equal(await passwords.verifyPassword("test-pass",hash),true);
  assert.equal(await passwords.verifyPassword("wrong",hash),false);
  assert.equal(await passwords.verifyPassword("", ""),false);
  assert.equal(await passwords.verifyPassword("x","scrypt$broken"),false);
});
await test("student login uses current DB email, not stale invite email",async () => {
  const response=await studentRoute.POST(request("/api/auth/student",{email:" CURRENT@EXAMPLE.INVALID ",password:"test-pass"}));
  assert.equal(response.status,200);
  assert.equal((await response.json()).student.email,"current@example.invalid");
  cookie=response.cookies.get("oslo_session").value;
  assert.equal(response.cookies.get("oslo_session").maxAge,tokens.SESSION_SECONDS);
  assert.equal((await auth.getSessionUser()).id,"student-1");
});
await test("old email no longer authenticates",async () => {
  assert.equal((await studentRoute.POST(request("/",{email:"old@example.invalid",password:"test-pass"}))).status,401);
});
await test("wrong password never creates a session",async () => {
  const response=await studentRoute.POST(request("/",{email:"current@example.invalid",password:"wrong"}));
  assert.equal(response.status,401);
  assert.equal(response.cookies.get("oslo_session"),undefined);
});
await test("remember off creates browser-session cookie",async () => {
  const response=await studentRoute.POST(request("/",{email:"current@example.invalid",password:"test-pass",rememberMe:false}));
  assert.equal(response.status,200);
  assert.equal(response.cookies.get("oslo_session").maxAge,undefined);
});
await test("valid invite gives an actionable activation message",async () => {
  const response=await studentRoute.POST(request("/",{email:"invited@example.invalid",password:"anything"}));
  assert.equal(response.status,403);
  assert.match((await response.json()).error,/davet bağlantısından/);
});
await test("expired invite gives renewal guidance",async () => {
  const response=await studentRoute.POST(request("/",{email:"expired@example.invalid",password:"anything"}));
  assert.equal(response.status,403);
  assert.match((await response.json()).error,/süresi dolmuş/);
});
await test("invalid JSON and wrong field types do not crash login",async () => {
  assert.equal((await studentRoute.POST(request("/",{email:42,password:{}}))).status,400);
  const bad=new Request("https://test.invalid/",{method:"POST",body:"{"});
  assert.equal((await studentRoute.POST(bad)).status,400);
});
await test("current user name is read from DB",async () => {
  db.students[0].name="Updated name";
  assert.equal((await auth.getSessionUser()).name,"Updated name");
});
await test("inactive account invalidates existing signed cookie",async () => {
  db.students[0].account_status="invited";
  assert.equal(await auth.getSessionUser(),null);
  const response=await sessionRoute.GET();
  assert.equal((await response.json()).user,null);
  assert.equal(response.cookies.get("oslo_session").maxAge,0);
  db.students[0].account_status="active";
});
await test("archived account cannot use old cookie or log in",async () => {
  db.students[0].archived_at=new Date().toISOString();
  assert.equal(await auth.getSessionUser(),null);
  assert.equal((await studentRoute.POST(request("/",{email:"current@example.invalid",password:"test-pass"}))).status,401);
  db.students[0].archived_at=null;
});
await test("password change invalidates old session",async () => {
  db.invites[0].password=await passwords.hashPassword("changed-pass");
  assert.equal(await auth.getSessionUser(),null);
  db.invites[0].password=hash;
});
await test("account version change invalidates old session",async () => {
  db.students[0].session_version++;
  assert.equal(await auth.getSessionUser(),null);
  db.students[0].session_version=0;
});
await test("credential race cannot issue session for changed password",async () => {
  await assert.rejects(auth.sessionCookie({id:"student-1",role:"student"},true,"outdated-password-hash"));
});
await test("legacy, tampered and expired cookies are rejected",async () => {
  const valid=cookie;
  cookie=valid+"x";
  assert.equal(await auth.getSessionUser(),null);
  const body=Buffer.from(JSON.stringify({id:"student-1",role:"student",exp:Math.floor(Date.now()/1000)+100})).toString("base64url");
  cookie=body+"."+createHmac("sha256","test-secret").update(body).digest("base64url");
  assert.equal(await auth.getSessionUser(),null);
  const payload=tokens.decodeSession(valid,"test-secret");
  const expired=Buffer.from(JSON.stringify({...payload,exp:1})).toString("base64url");
  cookie=expired+"."+createHmac("sha256","test-secret").update(expired).digest("base64url");
  assert.equal(await auth.getSessionUser(),null);
  cookie=valid;
});
await test("student cannot read another student's data",async () => {
  const response=await studioRoute.GET();
  const data=(await response.json()).data;
  assert.equal(data.students.length,1);
  assert.equal(data.students[0].id,"student-1");
});
await test("invalid session cannot read studio data",async () => {
  const valid=cookie;cookie="";
  assert.equal((await studioRoute.GET()).status,401);
  cookie=valid;
});
await test("DB outage returns service error, not incorrect-password error",async () => {
  unavailable=true;
  const response=await studentRoute.POST(request("/",{email:"current@example.invalid",password:"test-pass"}));
  assert.equal(response.status,503);
  assert.doesNotMatch((await response.json()).error,/şifre hatalı/);
  assert.equal((await sessionRoute.GET()).status,503);
  unavailable=false;
});
await test("password-reset lookup uses current email",async () => {
  assert.equal((await inviteStore.findActivatedInviteByEmail("current@example.invalid")).student.id,"student-1");
  assert.equal(await inviteStore.findActivatedInviteByEmail("old@example.invalid"),null);
});
await test("staff login uses stored hash and validates every session",async () => {
  db.staff_credentials.push({staff_id:"staff-ece",password_hash:hash});
  const response=await staffRoute.POST(request("/",{email:"ecenazkara@hotmail.com",password:"test-pass"}));
  assert.equal(response.status,200);
  cookie=response.cookies.get("oslo_session").value;
  assert.equal((await auth.getSessionUser()).role,"super_admin");
  db.staff_credentials[0].password_hash=await passwords.hashPassword("staff-new");
  assert.equal(await auth.getSessionUser(),null);
  db.staff_credentials[0].password_hash=hash;
});
await test("missing staff DB credentials never fall back to source password",async () => {
  const response=await staffRoute.POST(request("/",{email:"elifbeytas86@gmail.com",password:"anything"}));
  assert.equal(response.status,503);
});
await test("all session pages are read beyond the first 500 rows",async () => {
  db.sessions=Array.from({length:1050},(_,i)=>({
    id:"se-"+i,student_id:"student-1",group_id:"g",session_date:"2026-02-01",status:"upcoming",archived_at:null,
  }));
  const rest=load("src/lib/server/supabase-rest.ts");
  const data=await rest.readSupabaseStudioData();
  assert.equal(data.sessions.length,1050);
});
await test("successful and failed authentication are audited",async () => {
  assert.ok(db.login_events.some(x=>x.outcome==="success"));
  assert.ok(db.login_events.some(x=>x.outcome==="invalid_credentials"));
  assert.ok(db.login_events.some(x=>x.outcome==="expired_invite"));
  assert.ok(db.login_events.every(x=>!Object.hasOwn(x,"password")));
});
await test("logout clears session cookie",async () => {
  assert.equal((await sessionRoute.DELETE()).cookies.get("oslo_session").maxAge,0);
});
await test("successful write immediately updates the client edit timestamp from DB", async () => {
  const store=load("src/lib/store.ts");
  const client=load("src/lib/studio-client.ts");
  store.setStudioState({...store.getServerStudioState(),user:{id:"staff-ece",role:"super_admin"},
    students:[{id:"student-1",updatedAt:"old"}]});
  const previousFetch=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({student:{id:"student-1",updatedAt:"new",package:{remainingSessions:2}}});
  try{
    await client.studioMutation("/api/sessions/status",{method:"POST"});
    assert.equal(store.getStudioState().students[0].updatedAt,"new");
    assert.equal(store.getStudioState().students[0].package.remainingSessions,2);
  }finally{globalThis.fetch=previousFetch;}
});
await test("unauthorized write clears user and student data", async () => {
  const store=load("src/lib/store.ts");
  const client=load("src/lib/studio-client.ts");
  const previousFetch=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({error:"Oturum gerekli."},{status:401});
  try{
    await client.studioMutation("/api/students",{method:"POST"});
    assert.equal(store.getStudioState().user,null);
    assert.equal(store.getStudioState().students.length,0);
  }finally{globalThis.fetch=previousFetch;}
});
console.log("All " + count + " actual-module auth/HTTP contract tests PASS");
