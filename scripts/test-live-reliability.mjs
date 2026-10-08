import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createLoader } from "./load-ts.mjs";

const testStudentEmail=process.env.OSLO_TEST_STUDENT_EMAIL;
const testStudentPassword=process.env.OSLO_TEST_STUDENT_PASSWORD;
const testInvitedEmail=process.env.OSLO_TEST_INVITED_EMAIL;
const testStaffPassword=process.env.OSLO_TEST_STAFF_PASSWORD;
if (!testStudentEmail || !testStudentPassword || !testInvitedEmail || !testStaffPassword) {
  throw new Error("Set OSLO_TEST_STUDENT_EMAIL, OSLO_TEST_STUDENT_PASSWORD, OSLO_TEST_INVITED_EMAIL and OSLO_TEST_STAFF_PASSWORD for the real-account checks.");
}

const keys=["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","OSLO_SESSION_SECRET"];
const env={...process.env,NETLIFY_CLI_TELEMETRY_DISABLED:"1",CI:"1",OSLO_TEST_RUN:"1"};
for (const key of keys) {
  const result=spawnSync("cmd.exe",["/d","/s","/c",`netlify.cmd env:get ${key} --context production --scope functions --json`],
    {cwd:process.cwd(),encoding:"utf8",windowsHide:true,timeout:45000,env});
  if (result.status!==0) throw new Error("Could not read runtime setting " + key);
  const value=JSON.parse(result.stdout)[key];
  if (typeof value!=="string" || !value) throw new Error("Missing runtime setting " + key);
  env[key]=value;
}
const port=3109+Math.floor(Math.random()*1000);
const base="http://127.0.0.1:"+port;
const child=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port",String(port)],
  {cwd:process.cwd(),env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
let logs="";
child.stdout.on("data",chunk=>{logs+=chunk;});
child.stderr.on("data",chunk=>{logs+=chunk;});
const id="test-reliability-"+randomUUID();
const email=id+"@example.invalid";
const inviteToken=randomUUID();
const groupIds=new Set();
const resetTokens=[];
let created=false;
let count=0;
const load=createLoader();
const staffPassword=testStaffPassword;
const {getClassGroupById}=load("src/data/groups.ts");
const {buildSessionsForStudent}=load("src/data/seed.ts");
const {todayISO}=load("src/lib/dates.ts");
const today=todayISO();
const dateAfter=(n)=>{const d=new Date(today+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
async function api(path,method="GET",body,jar) {
  const response=await fetch(base+path,{method,headers:{
    ...(body?{"Content-Type":"application/json"}:{}),...(jar?.cookie?{Cookie:jar.cookie}:{})
  },...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
  const cookie=response.headers.get("set-cookie");
  if(cookie && jar) jar.cookie=cookie.split(";")[0];
  const text=await response.text();
  let data;try{data=JSON.parse(text);}catch{data={error:"Non-JSON response"};}
  return {status:response.status,data,cookie};
}
async function rest(path,method="GET",body) {
  const response=await fetch(env.SUPABASE_URL+"/rest/v1/"+path,{
    method,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:"Bearer "+env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type":"application/json",Prefer:"return=minimal"},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)
  });
  if(!response.ok) throw new Error("Test database request failed: "+response.status);
  const text=await response.text();return text?JSON.parse(text):null;
}
async function check(name,fn){await fn();count++;console.log("PASS "+name);}
const admin={cookie:""};
const studentJar={cookie:""};
let student={
  id,name:"Isolated reliability test",email,phone:"—",groupId:"sal-per-1000",instructorId:"staff-ece",
  packageType:"group_5",note:"Temporary automated test",measurements:{},monthlyPostponeLimit:1,
  accountStatus:"invited",inviteToken,inviteExpiresAt:new Date(Date.now()+86400000).toISOString(),
  invitedAt:new Date().toISOString(),package:{
    totalSessions:2,remainingSessions:2,startDate:today,endDate:dateAfter(14),paymentStatus:"paid",
  }
};
function programme(row,group) {
  const sessions=buildSessionsForStudent(row,{fromPackageStart:true,group});
  row.package.endDate=sessions.at(-1).date;
  return sessions;
}
let sessions=programme(student,getClassGroupById(student.groupId));
async function getStudent(){
  const result=await api("/api/studio","GET",undefined,admin);
  assert.equal(result.status,200);
  return result.data.data.students.find(s=>s.id===id);
}
async function saveEdit(row,customGroup) {
  const generated=programme(row,customGroup??getClassGroupById(row.groupId));
  const result=await api("/api/students","POST",{action:"save",mode:"update",student:row,sessions:generated,customGroup},admin);
  assert.equal(result.status,200,result.data.error);
  student=result.data.student;sessions=generated;return student;
}
try {
  let ready=false;
  for(let n=0;n<80;n++){
    try{const r=await fetch(base+"/giris",{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.equal(ready,true,"Test server did not start: "+logs.split("\n").slice(0,5).join(" "));
  await check("Ece signs in against actual Supabase credentials",async()=>{
    const result=await api("/api/auth/staff","POST",{email:"ecenazkara@hotmail.com",password:staffPassword},admin);
    assert.equal(result.status,200,result.data.error);
    assert.match(result.cookie,/HttpOnly/i);assert.match(result.cookie,/Secure/i);assert.match(result.cookie,/Max-Age=1209600/);
  });
  await check("configured real account signs in and reads its own DB data",async()=>{
    const jar={cookie:""};
    const result=await api("/api/auth/student","POST",{email:testStudentEmail,password:testStudentPassword},jar);
    assert.equal(result.status,200,result.data.error);
    const data=await api("/api/studio","GET",undefined,jar);
    assert.equal(data.status,200);
    assert.equal(data.data.data.students.length,1);
    assert.equal(data.data.data.students[0].email,testStudentEmail.trim().toLowerCase());
  });
  await check("configured expired invite account receives actionable guidance",async()=>{
    const result=await api("/api/auth/student","POST",{email:testInvitedEmail,password:"not-a-real-password"});
    assert.equal(result.status,403);assert.match(result.data.error,/süresi dolmuş/);
  });
  await check("isolated mock student is created and committed",async()=>{
    const result=await api("/api/students","POST",{action:"save",mode:"create",student,sessions},admin);
    assert.equal(result.status,200,result.data.error);created=true;student=result.data.student;
    const persisted=await getStudent();assert.equal(persisted.email,email);assert.equal(persisted.package.paymentStatus,"paid");
  });
  await check("duplicate email is rejected",async()=>{
    const duplicate={...student,id:id+"-duplicate"};
    const result=await api("/api/students","POST",{
      action:"save",mode:"create",student:duplicate,sessions:sessions.map(s=>({...s,id:s.id+"-dup",studentId:duplicate.id}))
    },admin);
    assert.equal(result.status,409);
  });
  await check("invite is saved without sending any email",async()=>{
    const result=await api("/api/invite","POST",{
      name:student.name,email:student.email,inviteUrl:base+"/davet?token="+inviteToken,
      student,sessions,expiresAt:student.inviteExpiresAt,sendEmail:false
    },admin);assert.equal(result.status,200,result.data.error);
  });
  await check("invite activation and password persist atomically",async()=>{
    const result=await api("/api/invite/activate","POST",{
      token:inviteToken,password:"MockPass123!",confirmPassword:"MockPass123!"
    },studentJar);assert.equal(result.status,200,result.data.error);
    student=await getStudent();assert.equal(student.accountStatus,"active");
  });
  await check("activation link cannot be reused",async()=>{
    const result=await api("/api/invite/activate","POST",{
      token:inviteToken,password:"OtherPass123!",confirmPassword:"OtherPass123!"
    });assert.equal(result.status,409);
  });
  await check("mock student can authenticate and read DB programme",async()=>{
    assert.equal((await api("/api/auth/student","POST",{email,password:"MockPass123!"},studentJar)).status,200);
    const result=await api("/api/studio","GET",undefined,studentJar);
    assert.equal(result.status,200);assert.equal(result.data.data.sessions.length,2);
  });
  await check("student attendance reaches teacher approval and updates counter",async()=>{
    const target=sessions.find(s=>s.date===today);assert.ok(target);
    const mark={sessionId:target.id,studentId:id,date:target.date,groupId:target.groupId,status:"attend_pending"};
    assert.equal((await api("/api/attendance","POST",mark,studentJar)).status,200);
    let state=await api("/api/studio","GET",undefined,admin);
    assert.equal(state.data.data.sessions.find(s=>s.id===target.id).status,"attend_pending");
    assert.equal((await api("/api/attendance","POST",{...mark,status:"attended"},admin)).status,200);
    student=await getStudent();assert.equal(student.package.remainingSessions,1);
    state=await api("/api/studio","GET",undefined,studentJar);
    assert.equal(state.data.data.sessions.find(s=>s.id===target.id).status,"attended");
  });
  await check("manual undo and missed outcome update canonical count",async()=>{
    const target=sessions.find(s=>s.date===today);
    assert.equal((await api("/api/sessions/status","POST",{sessionId:target.id,status:"upcoming"},admin)).status,200);
    assert.equal((await getStudent()).package.remainingSessions,2);
    assert.equal((await api("/api/sessions/status","POST",{sessionId:target.id,status:"missed"},admin)).status,200);
    assert.equal((await getStudent()).package.remainingSessions,1);
    await api("/api/sessions/status","POST",{sessionId:target.id,status:"upcoming"},admin);
  });
  await check("pending postpone can be sent and physically withdrawn",async()=>{
    const target=sessions.find(s=>s.date>today);assert.ok(target);
    assert.equal((await api("/api/sessions/status","POST",{sessionId:target.id,status:"postpone_pending"},studentJar)).status,200);
    let state=await api("/api/studio","GET",undefined,studentJar);
    assert.ok(state.data.data.postponeRequests.some(r=>r.sessionId===target.id&&r.status==="pending"));
    assert.equal((await api("/api/sessions/status","POST",{sessionId:target.id,status:"upcoming"},studentJar)).status,200);
    state=await api("/api/studio","GET",undefined,studentJar);
    assert.equal(state.data.data.postponeRequests.some(r=>r.sessionId===target.id),false);
  });
  await check("postpone approval and undo stay consistent",async()=>{
    const target=sessions.find(s=>s.date>today);
    assert.equal((await api("/api/sessions/status","POST",{sessionId:target.id,status:"postpone_pending"},studentJar)).status,200);
    assert.equal((await api("/api/sessions/status","POST",{sessionId:target.id,status:"postponed"},admin)).status,200);
    let state=await api("/api/studio","GET",undefined,studentJar);
    assert.equal(state.data.data.sessions.find(s=>s.id===target.id).status,"postponed");
    assert.equal((await api("/api/sessions/status","POST",{sessionId:target.id,status:"upcoming"},admin)).status,200);
    state=await api("/api/studio","GET",undefined,studentJar);
    assert.equal(state.data.data.sessions.find(s=>s.id===target.id).status,"upcoming");
  });
  await check("repeated student edits persist name and payment status",async()=>{
    for(let n=0;n<3;n++){
      const row=await getStudent();row.name="Isolated test edit "+n;row.package.paymentStatus=n%2?"paid":"pending";
      await saveEdit(row);const saved=await getStudent();
      assert.equal(saved.name,row.name);assert.equal(saved.package.paymentStatus,row.package.paymentStatus);
    }
  });
  await check("stale update cannot revert new values",async()=>{
    const stale=await getStudent();
    await saveEdit({...stale,name:"Latest mock name"});
    const result=await api("/api/students","POST",{action:"save",mode:"update",student:{...stale,name:"Stale name"},sessions},admin);
    assert.equal(result.status,409);assert.equal((await getStudent()).name,"Latest mock name");
  });
  await check("group to private programme replaces old days",async()=>{
    const row=await getStudent();row.groupId=id+"-thu";row.packageType="private";
    row.package.customSchedule={days:["thursday"],time:"20.00"};
    const group={id:row.groupId,days:["thursday"],time:"20.00",capacity:1,label:"Test Thursday"};
    groupIds.add(group.id);await saveEdit(row,group);
    const state=await api("/api/studio","GET",undefined,admin);
    const active=state.data.data.sessions.filter(s=>s.studentId===id);
    assert.equal(active.length,2);assert.ok(active.every(s=>new Date(s.date+"T12:00:00Z").getUTCDay()===4));
  });
  await check("private to private updates day, time and instructor",async()=>{
    const row=await getStudent();row.groupId=id+"-fri";row.instructorId="staff-elif";
    row.package.customSchedule={days:["friday"],time:"19.00"};
    const group={id:row.groupId,days:["friday"],time:"19.00",capacity:1,label:"Test Friday"};
    groupIds.add(group.id);await saveEdit(row,group);
    const saved=await getStudent();assert.equal(saved.instructorId,"staff-elif");assert.equal(saved.package.customSchedule.time,"19.00");
  });
  await check("private to ready group removes all stale special days",async()=>{
    const row=await getStudent();row.groupId="pzt-car-1200";row.packageType="group_5";
    delete row.package.customSchedule;await saveEdit(row);
    const state=await api("/api/studio","GET",undefined,admin);
    const active=state.data.data.sessions.filter(s=>s.studentId===id);
    assert.ok(active.every(s=>[1,3].includes(new Date(s.date+"T12:00:00Z").getUTCDay())));
    assert.equal((await getStudent()).package.customSchedule,undefined);
  });
  await check("package renewal shows only new period sessions",async()=>{
    const row=await getStudent();row.package.startDate=dateAfter(21);row.package.totalSessions=2;row.package.remainingSessions=2;
    await saveEdit(row);
    const state=await api("/api/studio","GET",undefined,admin);
    assert.ok(state.data.data.sessions.filter(s=>s.studentId===id).every(s=>s.date>=row.package.startDate));
  });
  await check("email change preserves password and revokes old session",async()=>{
    const row=await getStudent();row.email=id+"-renamed@example.invalid";
    await saveEdit(row);
    assert.equal((await api("/api/auth/session","GET",undefined,studentJar)).data.user,null);
    assert.equal((await api("/api/auth/student","POST",{email,password:"MockPass123!"})).status,401);
    assert.equal((await api("/api/auth/student","POST",{email:row.email,password:"MockPass123!"},studentJar)).status,200);
  });
  await check("password reset is single use and revokes prior sessions",async()=>{
    const row=await getStudent();const token=randomUUID();resetTokens.push(token);
    await rest("password_reset_tokens","POST",{
      token,kind:"student",account_id:id,email:row.email,expires_at:new Date(Date.now()+3600000).toISOString()
    });
    const body={token,password:"ResetMock123!",confirmPassword:"ResetMock123!"};
    assert.equal((await api("/api/auth/student/reset","POST",body)).status,200);
    assert.equal((await api("/api/auth/student/reset","POST",body)).status,400);
    assert.equal((await api("/api/auth/session","GET",undefined,studentJar)).data.user,null);
    assert.equal((await api("/api/auth/student","POST",{email:row.email,password:"ResetMock123!"},studentJar)).status,200);
  });
  await check("archiving revokes student access",async()=>{
    assert.equal((await api("/api/students","PATCH",{action:"archive",studentId:id},admin)).status,200);
    assert.equal((await api("/api/auth/session","GET",undefined,studentJar)).data.user,null);
    assert.equal((await api("/api/auth/student","POST",{email:student.email,password:"ResetMock123!"})).status,401);
  });
  await check("permanent deletion removes mock student and its lesson relationships",async()=>{
    assert.equal((await api("/api/students","DELETE",{studentId:id},admin)).status,200);
    created=false;
    const rows=await rest("students?id=eq."+encodeURIComponent(id)+"&select=id");
    assert.equal(rows.length,0);
  });
  console.log("All "+count+" real Next.js + Supabase HTTP tests PASS");
} finally {
  try {
  // Exact test IDs only. Never target real student rows or programmes.
  if(created){
    await rest("attendance_marks?student_id=eq."+encodeURIComponent(id),"DELETE");
    await rest("postpone_requests?student_id=eq."+encodeURIComponent(id),"DELETE");
    await rest("sessions?student_id=eq."+encodeURIComponent(id),"DELETE");
    await rest("invites?student_id=eq."+encodeURIComponent(id),"DELETE");
    await rest("students?id=eq."+encodeURIComponent(id),"DELETE");
  }
  for(const groupId of groupIds) await rest("custom_groups?id=eq."+encodeURIComponent(groupId),"DELETE");
  for(const token of resetTokens) await rest("password_reset_tokens?token=eq."+encodeURIComponent(token),"DELETE");
  } finally {
    child.kill();
  }
}
