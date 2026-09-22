import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
const root = process.cwd();
mkdirSync('.artifacts', { recursive: true });
const children = [];
try {
 for (const [service, entry, port] of [['task-service','src/server.js',14000],['analytics-service','src/server.js',15000],['frontend-service','src.js',13000]]) {
  const log = openSync(`.artifacts/${service}.log`, 'w');
  children.push(spawn(process.execPath, [entry], { cwd: path.join(root,service), env: {...process.env, PORT:String(port), MONGO_URI:'mongodb://localhost:27017/cloudtask_audit', TASK_SERVICE_URL:'http://localhost:14000', ANALYTICS_SERVICE_URL:'http://localhost:15000'}, stdio:['ignore',log,log] }));
 }
 const base='http://localhost:13000';
 for (const port of [14000,15000,13000]) { let ready=false; for(let i=0;i<40;i++){try{if((await fetch(`http://localhost:${port}/health`)).ok){ready=true;break;}}catch{} await delay(500);} assert.ok(ready,`service ${port} healthy`); }
 const call=async(url,method='GET',body,expected=200)=>{const res=await fetch(base+url,{method,headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(res.status,expected,`${method} ${url}`);return res.status===204?null:res.json();};
 const smoke = spawn('powershell.exe', ['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/smoke-test.ps1','-BaseUrl',base], {stdio:'inherit'});
 const smokeExit = await new Promise(resolve => smoke.on('exit',resolve));
 assert.equal(smokeExit,0,'PowerShell smoke test');
 const ids=[];
 try {
  await call('/api/tasks','POST',{},400);
  await call('/api/tasks','POST',{title:'x',dueDate:123},400);
  await call('/api/tasks?limit=oops','GET',undefined,400);
  await call('/api/tasks/bad','GET',undefined,400);
  await call('/api/tasks/000000000000000000000000','GET',undefined,404);
  const malformed=await fetch(base+'/api/tasks',{method:'POST',headers:{'content-type':'application/json'},body:'{'});assert.equal(malformed.status,400);
  const oversized=await fetch(base+'/api/tasks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'x'.repeat(40000)})});assert.equal(oversized.status,413);
  for(let i=0;i<3;i++)ids.push((await call('/api/tasks','POST',{title:`Audit ${i}`,status:i===0?'completed':'pending'},201))._id);
  assert.equal((await call('/api/tasks/'+ids[0])).title,'Audit 0');
  assert.equal((await call('/api/tasks/'+ids[1],'PATCH',{title:'Edited',status:'in-progress'})).title,'Edited');
  const first=await call('/api/tasks?limit=1');assert.ok(first.nextCursor);
  const second=await call('/api/tasks?limit=1&before='+first.nextCursor);assert.notEqual(first.tasks[0]._id,second.tasks[0]._id);
  const stats=await call('/api/analytics');assert.equal(stats.total,3);assert.equal(stats.completionRate,33);
  const { default: mongoose } = await import('../task-service/node_modules/mongoose/index.js');
  await mongoose.connect('mongodb://localhost:27017/cloudtask_audit');
  const bulk = await mongoose.connection.collection('tasks').insertMany(Array.from({length:1001},(_,i)=>({title:`Bulk audit ${i}`,status:'pending',priority:'low'})));
  try { assert.equal((await call('/api/analytics')).total,1004); console.log('PASS: analytics counts more than 1000 tasks across REST pages'); }
  finally { await mongoose.connection.collection('tasks').deleteMany({_id:{$in:Object.values(bulk.insertedIds)}}); await mongoose.disconnect(); }
  console.log('PASS: real MongoDB CRUD, validation, malformed/oversized JSON, pagination, analytics and proxy');
  const { chromium }=await import('../frontend-service/node_modules/playwright/index.mjs');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
   const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base);await page.getByText('Services online',{exact:true}).waitFor();
   await page.locator('#title').fill('Browser audit task');await page.getByRole('button',{name:'Create task',exact:true}).click();
   let card=page.locator('article.task-card').filter({has:page.getByRole('heading',{name:'Browser audit task',exact:true})});await card.waitFor();
   await card.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('button',{name:'Save changes'}).waitFor();await page.locator('#title').fill('Browser edited task');await page.getByRole('button',{name:'Save changes'}).click();
   card=page.locator('article.task-card').filter({has:page.getByRole('heading',{name:'Browser edited task',exact:true})});await card.waitFor();await card.getByRole('button',{name:'Mark complete'}).click();await card.getByRole('button',{name:'Reopen'}).waitFor();
   await page.screenshot({path:'.artifacts/browser.png',fullPage:true});await card.getByRole('button',{name:'Delete',exact:true}).click();await card.waitFor({state:'detached'});assert.deepEqual(errors,[]);console.log('PASS: Chrome browser create, edit, complete, delete; no JavaScript errors');
  }finally{await browser.close();}
 }finally{for(const id of ids)await call('/api/tasks/'+id,'DELETE',undefined,204);}
 children[0].kill();await delay(500);await call('/api/analytics','GET',undefined,503);console.log('PASS: downstream outage returns 503');
}finally{for(const child of children)child.kill();}
