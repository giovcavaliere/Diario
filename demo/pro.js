
(function(){
'use strict';

const KEY='diario-pro-patient-main-v1';
const PROFILE_KEY='diario-pro-profile-main-v1';
const MEASURE_KEY='diario-pro-measures-main-v1';
const SETTINGS_KEY='diario-pro-settings-recovery-v1';
const APPT_KEY='diario-pro-appts-recovery-v1';
const NOTES_KEY='diario-pro-notes-recovery-v1';
const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
const DEMO_MEASURES_KEY='diario-pro-demo-measures-overrides-v1';
const DELETED_PATIENTS_KEY='diario-pro-deleted-patients-v1';
const LABS_KEY='diario-pro-labs-v1',PLAN_META_KEY='diario-pro-plan-meta-v1',PLAN_DB='diario-pro-documents-v1',PLAN_STORE='plans',ACCOUNT_KEY='diario-pro-accounts-v1',PRIVACY_META_KEY='diario-pro-privacy-meta-v1',PENDING_LABS_KEY='diario-pro-pending-labs-v1';

const el=id=>document.getElementById(id);
const load=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const fmt=d=>{
  if(!d)return '—';
  const m=String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?`${m[3]}-${m[2]}-${m[1]}`:String(d);
};
const parseIt=s=>{
  const m=String(s||'').trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if(!m)return '';
  const iso=`${m[3]}-${m[2]}-${m[1]}`;
  const d=new Date(iso+'T12:00:00');
  if(Number.isNaN(d.getTime()))return '';
  if(d.getFullYear()!=+m[3] || d.getMonth()+1!=+m[2] || d.getDate()!=+m[1])return '';
  return iso;
};
const bmi=(w,h)=>w&&h?Number(w)/Math.pow(Number(h)/100,2):null;

const SETTINGS_DEFAULT={name:'Dott.ssa Demo',first:60,control:30,dayStart:'08:00',dayEnd:'19:00',workDays:5};
const DEMOS=[
 {id:'laura',name:'Laura Bianchi',height:168,goal:62,weights:[['2026-07-10',74.2],['2026-08-10',70.8]],
  diary:[{date:'2026-08-10',breakfast:'Yogurt greco + frutta',lunch:'Farro con tonno e verdure',dinner:'Pollo + verdure'}],
  measures:[{date:'2026-08-07',waist:82,hips:101}]},
 {id:'marco',name:'Marco Russo',height:178,goal:88,weights:[['2026-06-30',111.5],['2026-08-10',105.2]],
  diary:[{date:'2026-08-10',breakfast:'Cappuccino + pane tostato',lunch:'Riso + pollo',dinner:'Bresaola + rucola'}],
  measures:[{date:'2026-08-04',waist:108,hips:110}]}
];

const APPT_DEFAULT=[
 {id:'h1',patientId:'main',date:'2026-06-10',time:'09:30',type:'first',duration:60,note:'Prima visita'},
 {id:'h2',patientId:'main',date:'2026-07-15',time:'09:30',type:'control',duration:30,note:'Controllo'},
 {id:'a1',patientId:'main',date:'2026-09-03',time:'09:00',type:'control',duration:30,note:'Controllo periodico'},
 {id:'a2',patientId:'laura',date:'2026-08-12',time:'10:30',type:'first',duration:60,note:''},
 {id:'a3',patientId:'marco',date:'2026-08-13',time:'15:00',type:'control',duration:30,note:''},
 {id:'p1',patientId:null,date:'2026-08-14',time:'12:30',type:'personal',duration:90,title:'Impegno personale',note:'Non disponibile'}
];

let proDiarySearch='';
let proDiaryDate='';
let view='dashboard';
let selected='main';
let selectedBmiCategory='';
let tab='summary';
let editing=null;
let eventReturnToPatient=false;
let weekDate=new Date(today()+'T12:00:00');


function proDateControl(id,isoValue=''){return `<div class="date-entry"><input id="${id}" inputmode="numeric" placeholder="GG-MM-AAAA" value="${isoValue?fmt(isoValue):''}"><label class="date-picker-btn">📅<input type="date" data-date-target="${id}" value="${isoValue||''}"></label></div>`}
function readProDate(id,required=false){const v=parseIt(el(id)?.value||'');if(required&&!v)alert('Inserisci una data valida nel formato GG-MM-AAAA.');return v}
function accountMapPro(){return load(ACCOUNT_KEY,{})}function accountFor(id){return accountMapPro()[id]||null}function saveAccountFor(id,v){const m=accountMapPro();if(v)m[id]=v;else delete m[id];save(ACCOUNT_KEY,m)}
function privacyMetaMap(){return load(PRIVACY_META_KEY,{})}function privacyMetaFor(id){return privacyMetaMap()[id]||null}function savePrivacyMeta(id,v){const m=privacyMetaMap();if(v)m[id]=v;else delete m[id];save(PRIVACY_META_KEY,m)}
function pendingLabs(){return load(PENDING_LABS_KEY,{})}function savePendingLabs(v){save(PENDING_LABS_KEY,v)}
function ageYears(birth){if(!birth)return null;const b=new Date(birth+'T12:00:00'),n=new Date();if(Number.isNaN(b.getTime()))return null;let a=n.getFullYear()-b.getFullYear();if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))a--;return a}
function currentPatientWeight(p){
 const items=(p.entries||p.diary||[]).filter(x=>x&&x.weight!==''&&x.weight!=null&&Number.isFinite(Number(x.weight))).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 if(items.length)return Number(items.at(-1).weight);
 if(Array.isArray(p.weights)&&p.weights.length)return Number(p.weights.at(-1)?.[1]);
 return p.last!=null?Number(p.last):null;
}
function bmrMifflin(p){const w=currentPatientWeight(p),h=Number(p.height),a=ageYears(p.birth);if(!w||!h||a==null||!['M','F'].includes(p.sex))return null;return 10*w+6.25*h-5*a+(p.sex==='M'?5:-161)}
function energyEstimate(p){const b=bmrMifflin(p),f=Number(p.activityFactor);return b&&f?b*f:null}

function settings(){return {...SETTINGS_DEFAULT,...load(SETTINGS_KEY,{})}}
function appointments(){
  let a=load(APPT_KEY,null);
  if(!Array.isArray(a)){a=JSON.parse(JSON.stringify(APPT_DEFAULT));save(APPT_KEY,a)}
  return a;
}

function labsFor(id){const m=load(LABS_KEY,{});return Array.isArray(m[id])?m[id]:[]}function saveLabsFor(id,r){const m=load(LABS_KEY,{});m[id]=r;save(LABS_KEY,m)}function planMetaFor(id){return load(PLAN_META_KEY,{})[id]||null}function savePlanMeta(id,v){const m=load(PLAN_META_KEY,{});if(v)m[id]=v;else delete m[id];save(PLAN_META_KEY,m)}function openPlanDb(){return new Promise((res,rej)=>{const r=indexedDB.open(PLAN_DB,2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(PLAN_STORE))r.result.createObjectStore(PLAN_STORE);if(!r.result.objectStoreNames.contains('privacy'))r.result.createObjectStore('privacy');if(!r.result.objectStoreNames.contains('labUploads'))r.result.createObjectStore('labUploads')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}async function writePlanPdf(id,b){const db=await openPlanDb();return new Promise((res,rej)=>{const tx=db.transaction(PLAN_STORE,'readwrite');tx.objectStore(PLAN_STORE).put(b,id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}async function readPlanPdf(id){const db=await openPlanDb();return new Promise((res,rej)=>{const r=db.transaction(PLAN_STORE,'readonly').objectStore(PLAN_STORE).get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}async function deletePlanPdf(id){const db=await openPlanDb();return new Promise((res,rej)=>{const tx=db.transaction(PLAN_STORE,'readwrite');tx.objectStore(PLAN_STORE).delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
function extraPatients(){
 return load(EXTRA_PATIENTS_KEY,[]);
}
function saveExtraPatients(v){
 save(EXTRA_PATIENTS_KEY,v);
}

function ensureImportedFriendPatient(){
 const id='patient-gianluca-real';
 const deleted=new Set(load(DELETED_PATIENTS_KEY,[]));
 if(deleted.has(id))return;
 const arr=extraPatients();
 if(arr.some(x=>x.id===id))return;
 arr.push({"id":"patient-gianluca-real","name":"Gianluca","firstName":"Gianluca","surname":"","birth":"1984-07-23","height":180,"sex":"M","goal":95,"nextVisit":"2026-09-09","minWeight":"","maxWeight":"","reasonableWeight":"","work":"","activity":"","smoking":"No","alcohol":"Raramente","weights":[["2026-01-22",124.5],["2026-02-26",120],["2026-04-16",114.5],["2026-06-18",110],["2026-08-10",110.5]],"diary":[{"date":"2026-01-22","weight":124.5,"coffee":0,"sweetener":"","breakfast":"","snack1":"","lunch":"","snack2":"","dinner":"","notes":""},{"date":"2026-02-26","weight":120,"coffee":0,"sweetener":"","breakfast":"","snack1":"","lunch":"","snack2":"","dinner":"","notes":""},{"date":"2026-04-16","weight":114.5,"coffee":0,"sweetener":"","breakfast":"","snack1":"","lunch":"","snack2":"","dinner":"","notes":""},{"date":"2026-06-18","weight":110,"coffee":0,"sweetener":"","breakfast":"","snack1":"","lunch":"","snack2":"","dinner":"","notes":""},{"date":"2026-08-10","weight":110.5,"coffee":0,"sweetener":"","breakfast":"Cereali 50\nZymil 225","snack1":"Barretta cereali","lunch":"Pasta 100 gr\nPasta pomodoro\nCirca 10 gr olio\n149 gr piselli","snack2":"Pezzo di crostata ciccolato","dinner":"3 fette di melone\n70 gr di prosciutto\n80 gr di pane","notes":""},{"date":"2026-08-11","weight":"","coffee":3,"sweetener":"","breakfast":"50 gr cereali\n225 gr zymil","snack1":"1 barretta","lunch":"1 barretta","snack2":"1 banana\n1 succo di frutta bricco","dinner":"","notes":""}],"measures":[],"real":true,"importedBackup":true});
 saveExtraPatients(arr);
}


function mainPatient(){
  const profile=load(PROFILE_KEY,{});
  const entries=load(KEY,[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const measures=load(MEASURE_KEY,[]);
  const weights=entries.filter(x=>x.weight!==''&&x.weight!=null).map(x=>[x.date,Number(x.weight)]);
  const first=weights[0]?.[1]??null,last=weights.at(-1)?.[1]??null;
  return {
   id:'main',
   name:[profile.name||'Giovanni',profile.surname||''].filter(Boolean).join(' '),
   firstName:profile.name||'Giovanni',
   surname:profile.surname||'',
   birth:profile.birth||'',
   sex:profile.sex||'',
   height:profile.height||'',
   goal:profile.goal||'',
   nextVisit:profile.nextVisit||'',
   minWeight:profile.minWeight||'',
   maxWeight:profile.maxWeight||'',
   reasonableWeight:profile.reasonableWeight||'',
   work:profile.work||'',
   activity:profile.activity||'',
   activityFactor:profile.activityFactor||'',
   smoking:profile.smoking||'',
   alcohol:profile.alcohol||'', diagnosis:profile.diagnosis||'', theoreticalWeight:profile.theoreticalWeight||'', bowel:profile.bowel||'', metabolism:profile.metabolism||'', feeg:profile.feeg||'', impedance:profile.impedance||'', famObesity:!!profile.famObesity, famDiabetes:!!profile.famDiabetes, famHypertension:!!profile.famHypertension, famCardiovascular:!!profile.famCardiovascular, famDyslipidemia:!!profile.famDyslipidemia, famThyroid:!!profile.famThyroid, famGestational:!!profile.famGestational, previousDiets:profile.previousDiets||'', allergies:profile.allergies||'', medications:profile.medications||'', giIssues:profile.giIssues||'', pastConditions:profile.pastConditions||'', observations:profile.observations||'', objectives:profile.objectives||'',
   entries,measures,weights,first,last,
   delta:first!=null&&last!=null?last-first:null,
   real:true
 };
}
function demoPatient(p){
  const first=p.weights[0]?.[1]??null,last=p.weights.at(-1)?.[1]??null;
  const overrides=load(DEMO_MEASURES_KEY,{});
  const measures=Array.isArray(overrides[p.id])?overrides[p.id]:(p.measures||[]);
  return {...p,measures,entries:p.diary||[],first,last,delta:first!=null&&last!=null?last-first:null,real:p.real===true};
}
function patients(){
 const deleted=new Set(load(DELETED_PATIENTS_KEY,[]));
 return [
   mainPatient(),
   ...DEMOS.filter(p=>!deleted.has(p.id)).map(demoPatient),
   ...extraPatients().filter(p=>!deleted.has(p.id)).map(p=>demoPatient({
     ...p,
     weights:Array.isArray(p.weights)?p.weights:[],
     diary:Array.isArray(p.diary)?p.diary:[],
     measures:Array.isArray(p.measures)?p.measures:[]
   }))
 ];
}
function patient(id){return patients().find(p=>p.id===id)}
function typeLabel(t){return t==='first'?'Prima visita':t==='control'?'Controllo':'Impegno personale'}
function typeClass(t){return t==='first'?'pro-first':t==='control'?'pro-control':'pro-personal'}
function timeMin(t){const [h,m]=String(t).split(':').map(Number);return h*60+m}
function minTime(m){return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
function getMonday(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);x.setHours(12,0,0,0);return x}
function addDays(d,n){
 const x=new Date(d);
 x.setDate(x.getDate()+n);
 x.setHours(12,0,0,0);
 return x;
}
function iso(d){
 if(!(d instanceof Date) || Number.isNaN(d.getTime()))return '';
 return d.toISOString().slice(0,10);
}

function top(title){
 return `<div class="pro3-top"><div><div class="eyebrow">AREA PROFESSIONISTA · DEMO</div><h1>${title}</h1></div><a href="./index.html" class="mini">Cambia area</a></div>`;
}
function nav(){
 return `<div class="pro3-nav">
  <button data-view="dashboard" class="${view==='dashboard'?'active':''}">Dashboard</button>
  <button data-view="patients" class="${view==='patients'?'active':''}">Pazienti</button>
  <button data-view="agenda" class="${view==='agenda'?'active':''}">Agenda</button>
  <button data-view="settings" class="${view==='settings'?'active':''}">Profilo professionista</button>
 </div>`;
}


function bmiCategoryFromValue(v){
 if(!Number.isFinite(v))return null;
 if(v<18.5)return 'Sottopeso';
 if(v<25)return 'Normopeso';
 if(v<30)return 'Sovrappeso';
 if(v<35)return 'Obesità I';
 if(v<40)return 'Obesità II';
 return 'Obesità III';
}

function bmiDashboardData(){
 const ps=patients();
 const categories=['Sottopeso','Normopeso','Sovrappeso','Obesità I','Obesità II','Obesità III'];
 const groups=Object.fromEntries(categories.map(c=>[c,[]]));
 const unavailable=[];

 ps.forEach(p=>{
   const w=p.last!=null?Number(p.last):null;
   const h=p.height?Number(p.height):null;
   const current=w&&h?bmi(w,h):null;
   const cat=bmiCategoryFromValue(current);
   if(cat)groups[cat].push({...p,currentBmi:current});
   else unavailable.push(p);
 });

 return {
   categories,
   groups,
   unavailable,
   total:categories.reduce((n,c)=>n+groups[c].length,0)
 };
}

function polarPoint(cx,cy,r,angle){
 const rad=(angle-90)*Math.PI/180;
 return {x:cx+r*Math.cos(rad),y:cy+r*Math.sin(rad)};
}
function pieSlicePath(cx,cy,r,startAngle,endAngle){
 const start=polarPoint(cx,cy,r,endAngle);
 const end=polarPoint(cx,cy,r,startAngle);
 const large=endAngle-startAngle<=180?0:1;
 return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y} Z`;
}

function bmiPieCard(){
 const data=bmiDashboardData();
 const palette=['#6aa8d8','#69b58a','#d9c85c','#e1a85b','#d98262','#b86a6a'];

 let angle=0;
 const slices=data.categories.filter(c=>data.groups[c].length>0).map(cat=>{
   const count=data.groups[cat].length;
   const pct=count/data.total;
   const start=angle;
   const end=angle+pct*360;
   angle=end;
   const color=palette[data.categories.indexOf(cat)];
   return `<path d="${pieSlicePath(50,50,42,start,end)}" fill="${color}" data-bmi-category="${cat}" style="cursor:pointer;stroke:#fff;stroke-width:1.2"></path>`;
 }).join('');

 const legend=data.categories.map((cat,i)=>{
   const count=data.groups[cat].length;
   const pct=data.total?Math.round(count/data.total*100):0;
   return `<button data-bmi-category="${cat}" style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;border:0;background:transparent;padding:6px 0;text-align:left;cursor:pointer">
     <span style="display:flex;align-items:center;gap:8px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${palette[i]}"></i>${cat}</span>
     <span style="font-size:12px;color:#6f7f86">${count} · ${pct}%</span>
   </button>`;
 }).join('');

 const patientList=selectedBmiCategory
 ? `<div style="margin-top:14px;border-top:1px solid #e6ecee;padding-top:12px">
      <div class="section-head"><h3 style="margin:0">${esc(selectedBmiCategory)}</h3><button class="mini" id="clearBmiFilter">Chiudi</button></div>
      ${(data.groups[selectedBmiCategory]||[]).map(p=>`
        <button class="pro3-patient" data-patient="${p.id}" style="width:100%;font-weight:400;margin-top:7px">
          <div class="patient-avatar">${p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
          <div>
            <span style="display:block;font-size:14px;font-weight:700;color:#34484f">${esc(p.name)}</span>
            <span style="display:block;font-size:12px;color:#7b898f;margin-top:2px">BMI ${p.currentBmi.toFixed(1).replace('.',',')}</span>
          </div>
          <span style="font-size:12px;color:#7b898f">${p.last!=null?p.last.toFixed(1).replace('.',',')+' kg':'—'}</span>
        </button>`).join('') || '<p class="muted">Nessun paziente in questa categoria.</p>'}
    </div>`
 : '';

 return `<section class="card" style="margin-top:12px">
   <div class="section-head"><h2>Distribuzione pazienti per BMI</h2><span class="pill">${data.total} con BMI</span></div>
   ${data.total?`
   <div style="display:grid;grid-template-columns:minmax(180px,240px) 1fr;gap:18px;align-items:center">
     <div style="position:relative;max-width:240px;margin:auto;width:100%">
       <svg viewBox="0 0 100 100" style="width:100%;height:auto;display:block">${slices}<circle cx="50" cy="50" r="21" fill="#fff"></circle></svg>
       <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;text-align:center">
         <div><b style="font-size:22px">${data.total}</b><small style="display:block;color:#74848b">pazienti</small></div>
       </div>
     </div>
     <div>${legend}</div>
   </div>`:'<p class="muted">Nessun BMI disponibile.</p>'}
   ${data.unavailable.length?`<p class="muted" style="margin-top:12px">${data.unavailable.length} pazient${data.unavailable.length===1?'e':'i'} senza BMI calcolabile.</p>`:''}
   ${patientList}
 </section>`;
}

function dashboard(){
 const ps=patients();
 const todays=appointments().filter(a=>a.date===today());
 const first=todays.filter(a=>a.type==='first').length;
 const controls=todays.filter(a=>a.type==='control').length;
 return `${top('Dashboard')}${nav()}
 <div class="pro3-kpis">
   <div><span>Pazienti attivi</span><b>${ps.length}</b></div>
   <div><span>Appuntamenti oggi</span><b>${todays.filter(a=>a.type!=='personal').length}</b></div>
   <div class="kpi-first"><span>Prime visite oggi</span><b>${first}</b></div>
   <div class="kpi-control"><span>Controlli oggi</span><b>${controls}</b></div>
 </div>
 <div class="pro3-two">
  <section class="card"><div class="section-head"><h2>Agenda di oggi</h2><button class="mini" id="goAgenda">Vedi agenda</button></div>
   ${todays.length?todays.map(eventRow).join(''):'<p class="muted">Nessun evento oggi.</p>'}
  </section>
  <section class="card"><div class="section-head"><h2>Riepilogo studio</h2><span class="pill">Settimana corrente</span></div>
   ${studioSummaryChart()}
  </section>
 </div>
 ${bmiPieCard()}
 ${(()=>{const q=Object.values(pendingLabs()).filter(x=>x.status==='Da verificare');return q.length?`<section class="card alert-card"><div class="section-head"><h2>Analisi da verificare</h2><span class="pill">${q.length}</span></div>${q.map(x=>{const pp=patient(x.patientId);return `<button class="pro3-patient" data-review-lab="${x.key}" style="width:100%;margin-top:7px"><div class="patient-avatar">🧪</div><div><b>${esc(pp?.name||'Paziente')}</b><span>${esc(x.filename||'Referto PDF')}</span></div><strong>Verifica</strong></button>`}).join('')}</section>`:''})()}`;
}
function eventRow(a){
 const p=a.patientId?patient(a.patientId):null;
 return `<button class="pro3-event ${typeClass(a.type)}" data-event="${a.id}">
  <b>${a.time}</b><span>${a.type==='personal'?esc(a.title||'Impegno personale'):esc(p?.name||'Paziente')} · ${typeLabel(a.type)} · ${a.duration} min</span>
 </button>`;
}


function studioSummaryChart(){
 const s=settings();
 const monday=getMonday(new Date(today()+'T12:00:00'));
 const count=Number(s.workDays)===6?6:5;
 const days=Array.from({length:count},(_,i)=>addDays(monday,i));
 const data=days.map(d=>{
   const date=iso(d);
   return {
     date,
     label:d.toLocaleDateString('it-IT',{weekday:'long'}),
     first:appointments().filter(a=>a.date===date&&a.type==='first').length,
     control:appointments().filter(a=>a.date===date&&a.type==='control').length
   };
 });
 const max=Math.max(1,...data.map(x=>x.first+x.control));
 const totalFirst=data.reduce((n,x)=>n+x.first,0);
 const totalControl=data.reduce((n,x)=>n+x.control,0);
 const cols=data.map(x=>{
   const fh=(x.first/max)*110, ch=(x.control/max)*110;
   return `<div style="flex:1;min-width:38px;text-align:center">
     <div style="height:120px;display:flex;align-items:flex-end;justify-content:center;gap:3px">
       <i title="Prime visite: ${x.first}" style="display:block;width:14px;height:${fh}px;min-height:${x.first?5:0}px;background:#e4b93f;border-radius:5px 5px 2px 2px"></i>
       <i title="Controlli: ${x.control}" style="display:block;width:14px;height:${ch}px;min-height:${x.control?5:0}px;background:#65a96a;border-radius:5px 5px 2px 2px"></i>
     </div>
     <b style="display:block;text-transform:capitalize;font-size:12px">${x.label}</b>
     <small style="color:#71818a">${x.first+x.control} visite</small>
   </div>`;
 }).join('');
 return `<div style="display:flex;gap:8px;align-items:flex-end;overflow-x:auto;padding:8px 0">${cols}</div>
 <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:#657780">
   <span><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#e4b93f;margin-right:5px"></i>Prime visite: <b>${totalFirst}</b></span>
   <span><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#65a96a;margin-right:5px"></i>Controlli: <b>${totalControl}</b></span>
 </div>
 <p class="muted">Si aggiorna automaticamente dagli appuntamenti dell'Agenda della settimana corrente.</p>`;
}

function patientsPage(){
 return `${top('Pazienti')}${nav()}
 <section class="card"><div class="section-head"><h2>Anagrafiche</h2><button class="mini" id="newPatient">＋ Nuovo paziente</button></div>
 <input id="searchPatient" type="search" placeholder="Cerca paziente...">
 <div class="pro3-patients">${patients().map(p=>{
   const delta=p.delta!=null?(p.delta>0?'+':'')+p.delta.toFixed(1).replace('.',',')+' kg':'—';
   return `<button data-patient="${p.id}" class="pro3-patient" style="font-weight:400">
     <div class="patient-avatar">${p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div>
     <div>
       <span style="display:block;font-size:15px;font-weight:700;color:#34484f">${esc(p.name)}</span>
       <span style="display:block;margin-top:3px;font-size:12px;color:#7b898f">${p.last!=null?'Ultimo peso '+p.last.toFixed(1).replace('.',',')+' kg':'Dati non disponibili'}</span>
     </div>
     <span style="font-size:12px;font-weight:600;color:${p.delta<0?'#3d8b69':p.delta>0?'#a66a45':'#7b898f'}">${delta}</span>
   </button>`;
 }).join('')}</div></section>`;
}



let proTrendDays=30;
let proBmiDays=30;
let proShowMovingAverage=true;

function proBmiLabel(v){
  if(!Number.isFinite(v))return '';
  if(v<18.5)return 'Sottopeso';
  if(v<25)return 'Normopeso';
  if(v<30)return 'Sovrappeso';
  if(v<35)return 'Obesità I';
  if(v<40)return 'Obesità II';
  return 'Obesità III';
}

function proFilteredByDays(items,days){
  let a=[...items];
  if(days&&a.length){
    const end=new Date(a.at(-1).date+'T12:00:00');
    const start=new Date(end); start.setDate(end.getDate()-(days-1));
    a=a.filter(x=>new Date(x.date+'T12:00:00')>=start);
  }
  return a;
}

function proMovingAverageSeries(items,windowSize=7){
  const w=items.filter(x=>x.weight!=='');
  return w.map((x,i)=>{
    const slice=w.slice(Math.max(0,i-windowSize+1),i+1);
    const avg=slice.reduce((s,r)=>s+Number(r.weight),0)/slice.length;
    return {...x,avg};
  });
}

function proWeightChart(items,days){
  let w=proFilteredByDays(items.filter(x=>x.weight!==''),days);
  if(!w.length)return '<p class="muted">Nessun peso registrato.</p>';

  const avgSeries=proMovingAverageSeries(items).filter(x=>w.some(y=>y.date===x.date));
  let vals=w.map(x=>+x.weight);
  if(proShowMovingAverage) vals.push(...avgSeries.map(x=>x.avg));
  let rawMin=Math.min(...vals),rawMax=Math.max(...vals);
  let pad=Math.max(.5,(rawMax-rawMin)*.12);
  let min=Math.floor((rawMin-pad)*2)/2;
  let max=Math.ceil((rawMax+pad)*2)/2;
  if(max===min)max=min+1;
  let range=max-min;

  const left=14,right=98,top=8,bottom=86;
  const xFor=(date)=>{
    const idx=w.findIndex(x=>x.date===date);
    return w.length===1?(left+right)/2:left+idx/(w.length-1)*(right-left);
  };
  const yFor=v=>bottom-((v-min)/range)*(bottom-top);
  const pts=w.map(x=>`${xFor(x.date).toFixed(2)},${yFor(+x.weight).toFixed(2)}`).join(' ');
  const avgPts=avgSeries.map(x=>`${xFor(x.date).toFixed(2)},${yFor(x.avg).toFixed(2)}`).join(' ');

  const tickCount=5;
  const ticks=Array.from({length:tickCount},(_,i)=>max-(range/(tickCount-1))*i);
  const grid=ticks.map(v=>{
    const y=yFor(v);
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid"/><text x="${left-2}" y="${y}" text-anchor="end" dominant-baseline="middle" class="chart-y-label">${v.toFixed(1).replace('.',',')}</text>`;
  }).join('');

  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 100 100" preserveAspectRatio="none">${grid}<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" class="chart-axis"/><line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="chart-axis"/><polyline points="${pts}" class="chart-line" fill="none" vector-effect="non-scaling-stroke"/>${w.map(x=>`<circle cx="${xFor(x.date)}" cy="${yFor(+x.weight)}" r="0.55" class="chart-point" vector-effect="non-scaling-stroke"/>`).join('')}${proShowMovingAverage&&avgPts?`<polyline points="${avgPts}" class="chart-average" fill="none" vector-effect="non-scaling-stroke"/>`:''}</svg><span class="chart-unit">kg</span></div><div class="chart-dates"><span>${fmt(w[0].date)}</span><span>${fmt(w.at(-1).date)}</span></div>`;
}

function proBmiChart(items,days,height){
  if(!height)return '<p class="muted">Inserisci l’altezza nel Profilo per calcolare il BMI.</p>';
  let data=items.filter(x=>x.weight!=='').map(x=>({...x,bmi:bmi(x.weight,height)})).filter(x=>Number.isFinite(x.bmi));
  data=proFilteredByDays(data,days);
  if(!data.length)return '<p class="muted">Nessun dato BMI disponibile.</p>';

  let vals=data.map(x=>x.bmi);
  let rawMin=Math.min(...vals),rawMax=Math.max(...vals);
  let pad=Math.max(.4,(rawMax-rawMin)*.12);
  let min=Math.floor((rawMin-pad)*2)/2;
  let max=Math.ceil((rawMax+pad)*2)/2;
  if(max===min)max=min+1;
  const range=max-min,left=14,right=98,top=8,bottom=86;
  const xFor=i=>data.length===1?(left+right)/2:left+i/(data.length-1)*(right-left);
  const yFor=v=>bottom-((v-min)/range)*(bottom-top);
  const pts=data.map((x,i)=>`${xFor(i).toFixed(2)},${yFor(x.bmi).toFixed(2)}`).join(' ');
  const ticks=Array.from({length:5},(_,i)=>max-(range/4)*i);
  const grid=ticks.map(v=>{
    const y=yFor(v);
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid"/><text x="${left-2}" y="${y}" text-anchor="end" dominant-baseline="middle" class="chart-y-label">${v.toFixed(1).replace('.',',')}</text>`;
  }).join('');

  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 100 100" preserveAspectRatio="none">${grid}<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" class="chart-axis"/><line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="chart-axis"/><polyline points="${pts}" class="chart-bmi-line" fill="none" vector-effect="non-scaling-stroke"/>${data.map((x,i)=>`<circle cx="${xFor(i)}" cy="${yFor(x.bmi)}" r="0.55" class="chart-bmi-point" vector-effect="non-scaling-stroke"/>`).join('')}</svg><span class="chart-unit">BMI</span></div><div class="chart-dates"><span>${fmt(data[0].date)}</span><span>${fmt(data.at(-1).date)}</span></div>`;
}

function proTrendContent(p){
  const all=(p.weights||[]).map(x=>({date:x[0],weight:Number(x[1])})).filter(x=>Number.isFinite(x.weight)).sort((a,b)=>a.date.localeCompare(b.date));
  const first=all[0],last=all.at(-1),delta=first&&last?last.weight-first.weight:null;
  const currentBmi=last&&p.height?bmi(last.weight,p.height):null;

  return `<section class="card chart-card"><div class="section-head"><h2>Peso</h2><label class="toggle"><input id="proMovingAverage" type="checkbox" ${proShowMovingAverage?'checked':''}><span>Media 7 gg</span></label></div><div class="tabs">${[[7,'7 giorni'],[30,'30 giorni'],[90,'3 mesi'],[0,'Tutto']].map(([n,l])=>`<button data-pro-trend="${n}" class="${proTrendDays===n?'active':''}">${l}</button>`).join('')}</div>${proWeightChart(all,proTrendDays)}</section>
  <section class="card summary"><div class="section-head"><h2>Riepilogo peso</h2><span class="pill">Totale</span></div>${first?`<div class="stats"><div><span>Peso iniziale</span><b>${first.weight.toFixed(1).replace('.',',')} kg</b></div><div><span>Ultimo peso</span><b>${last.weight.toFixed(1).replace('.',',')} kg</b></div><div><span>Variazione</span><b class="${delta<0?'good':delta>0?'up':''}">${delta>0?'+':''}${delta.toFixed(1).replace('.',',')} kg</b></div></div>`:'<p class="muted">Nessun dato.</p>'}</section>
  <section class="card chart-card"><div class="section-head"><h2>BMI</h2>${currentBmi?`<span class="pill">${currentBmi.toFixed(1).replace('.',',')} · ${proBmiLabel(currentBmi)}</span>`:'<span class="pill">Profilo</span>'}</div><div class="tabs">${[[7,'7 giorni'],[30,'30 giorni'],[90,'3 mesi'],[0,'Tutto']].map(([n,l])=>`<button data-pro-bmi="${n}" class="${proBmiDays===n?'active':''}">${l}</button>`).join('')}</div>${proBmiChart(all,proBmiDays,p.height)}</section>`;
}



function proAscii(s){
 return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x20-\x7E]/g,' ');
}
function proPdfEscape(s){
 return proAscii(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
}
function proWrapCell(text,maxChars){
 let t=proAscii(text).replace(/\s+/g,' ').trim();
 if(!t)return [''];
 let words=t.split(' '),lines=[],line='';
 words.forEach(w=>{
   let next=line?line+' '+w:w;
   if(next.length>maxChars&&line){lines.push(line);line=w}else line=next;
 });
 if(line)lines.push(line);
 return lines;
}
function proDiaryPdfRows(p){
 return (p.entries||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(x=>[
   fmt(x.date),
   x.weight===''||x.weight==null?'':Number(x.weight).toFixed(1).replace('.',','),
   x.coffee===''||x.coffee==null?'':String(x.coffee),
   x.sweetener||'',
   x.breakfast||'',
   x.snack1||'',
   x.lunch||'',
   x.snack2||'',
   x.dinner||'',
   x.notes||''
 ]);
}
function proDiaryPdfBlob(p){
 const rows=proDiaryPdfRows(p);
 const headers=['Data','Peso','Caffe','Zucchero / dolc.','Colazione','Spuntino mattina','Pranzo','Spuntino pomeriggio','Cena','Sport / Note'];
 const widths=[46,38,30,72,88,78,92,78,92,105];
 const x0=22,pageW=842,pageH=595,top=548,bottom=28;
 const fontSize=6.5,lineH=8,pad=3;
 let pages=[],current=[],y=top;

 function prepareRow(cells,isHeader=false){
   let wrapped=cells.map((c,i)=>proWrapCell(c,Math.max(4,Math.floor((widths[i]-pad*2)/(fontSize*.50)))));
   let lines=Math.max(...wrapped.map(a=>a.length));
   let h=Math.max(isHeader?22:18,lines*lineH+pad*2);
   return {wrapped,h,isHeader};
 }
 const head=prepareRow(headers,true);
 function newPage(){
   current=[];
   pages.push(current);
   y=top;
   current.push({...head,y:y-head.h});
   y-=head.h;
 }
 newPage();
 rows.forEach(row=>{
   let pr=prepareRow(row,false);
   if(y-pr.h<bottom)newPage();
   current.push({...pr,y:y-pr.h});
   y-=pr.h;
 });

 let objects=[];
 const add=o=>{objects.push(o);return objects.length};
 const fontRegular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 const fontBold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
 const pagesObj=add('PAGES_PLACEHOLDER');
 let pageIds=[];

 pages.forEach((items,pageIndex)=>{
   let stream='';
   const title=`Diario alimentare - ${p.name||'Paziente'} - ${rows.length?rows[0][0]+' / '+rows.at(-1)[0]:'Nessun dato'}`;
   stream+=`BT /F2 11 Tf 22 570 Td (${proPdfEscape(title)}) Tj ET\n`;
   items.forEach(item=>{
     let x=x0,yBottom=item.y;
     item.wrapped.forEach((cellLines,i)=>{
       let w=widths[i];
       if(item.isHeader)stream+=`0.91 0.96 0.96 rg ${x} ${yBottom} ${w} ${item.h} re f 0 0 0 rg\n`;
       stream+=`0.72 G 0.35 w ${x} ${yBottom} ${w} ${item.h} re S 0 G\n`;
       cellLines.forEach((line,li)=>{
         let ty=yBottom+item.h-pad-fontSize-li*lineH;
         if(ty>yBottom+1)stream+=`BT /${item.isHeader?'F2':'F1'} ${fontSize} Tf ${x+pad} ${ty} Td (${proPdfEscape(line)}) Tj ET\n`;
       });
       x+=w;
     });
   });
   stream+=`BT /F1 6 Tf 760 12 Td (Pagina ${pageIndex+1}/${pages.length}) Tj ET\n`;
   let contentId=add(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
   let pageId=add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`);
   pageIds.push(pageId);
 });

 objects[pagesObj-1]=`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] >>`;
 const catalog=add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
 let pdf='%PDF-1.4\n%Diary\n',offsets=[0];
 objects.forEach((obj,i)=>{offsets[i+1]=pdf.length;pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
 let xref=pdf.length;
 pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(let i=1;i<=objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return new Blob([pdf],{type:'application/pdf'});
}
function exportProDiaryPdf(){
 const p=patient(selected);
 if(!p || !(p.entries||[]).length)return alert('Non ci sono giornate da esportare.');
 const rows=proDiaryPdfRows(p);
 const blob=proDiaryPdfBlob(p),url=URL.createObjectURL(blob),a=document.createElement('a');
 const safeName=String(p.name||'Paziente').replace(/[^A-Za-z0-9_-]+/g,'_');
 a.href=url;
 a.download=`Diario_${safeName}_${rows[0][0].replace(/-/g,'')}_${rows.at(-1)[0].replace(/-/g,'')}.pdf`;
 document.body.appendChild(a);
 a.click();
 a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function proDiaryHistory(p){
 const q=proDiarySearch.trim().toLowerCase();
 const history=(p.entries||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).filter(x=>
   !q || [x.date,x.breakfast,x.snack1,x.lunch,x.snack2,x.dinner,x.notes,x.sweetener,String(x.weight),String(x.coffee)].join(' ').toLowerCase().includes(q)
 );

 return `<div class="section-head"><h2>Storico</h2><div class="head-actions"><button class="mini" id="exportProDiaryPdf">↓ Esporta PDF</button></div></div>
 <div class="search-wrap"><input id="proDiarySearch" type="search" placeholder="Cerca nello storico…" value="${esc(proDiarySearch)}"></div>
 ${history.map(x=>{
   const w=x.weight!==''&&x.weight!=null?Number(x.weight):null;
   const b=w!=null&&p.height?bmi(w,p.height):null;
   return `<div class="listitem" data-pro-diary-day="${x.date}" style="cursor:pointer">
     <span>
       <b>${fmt(x.date)}</b>
       <small>${new Date(x.date+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long'})}</small>
     </span>
     <div class="history-right">
       <b>${w!=null?w.toFixed(1).replace('.',',')+' kg':'—'}</b>
       ${b!=null?`<small>BMI ${b.toFixed(1).replace('.',',')}</small>`:''}
       ${(()=>{const ce=calorieEstimateDay(x);return ce.calculated?`<small>${ce.calories} kcal · stima ${ce.qualityLabel.toLowerCase()}</small>`:''})()}
     </div>
   </div>`;
 }).join('')||'<p class="muted">Nessuna giornata trovata.</p>'}`;
}


function proDiaryDayView(){
 const p=patient(selected);
 if(!p)return `${top('Paziente non trovato')}`;

 const d=(p.entries||[]).find(x=>x.date===proDiaryDate);
 if(!d)return `${top('Giornata non trovata')}<button class="pro3-back" id="backDiary">‹ Torna al diario</button>`;

 const weight=d.weight!==''&&d.weight!=null?Number(d.weight):null;
 const currentBmi=weight!=null&&p.height?bmi(weight,p.height):null;

 return `${top('Dettaglio diario')}
 <button class="pro3-back" id="backDiary">‹ Torna al diario</button>

 <section class="card">
   <div class="section-head">
     <div><div class="eyebrow">GIORNATA</div><h2>${fmt(d.date)}</h2></div>
     <span class="pill">Sola lettura</span>
   </div>
   <p class="muted">Il diario è compilato dal paziente. Il professionista può consultarlo ma non modificarlo.</p>

   <div class="pro3-detail">
     <div><span>Peso</span><b>${weight!=null?weight.toFixed(1).replace('.',',')+' kg':'—'}</b></div>
     <div><span>BMI</span><b>${currentBmi!=null?currentBmi.toFixed(1).replace('.',','):'—'}</b></div>
     <div><span>Caffè</span><b>${d.coffee!==''&&d.coffee!=null?esc(d.coffee):'—'}</b></div>
     <div><span>Zucchero / dolcificante</span><b>${esc(d.sweetener||'—')}</b></div>
     <div><span>Calorie stimate</span><b>${dayEstimatedCalories(d)?dayEstimatedCalories(d)+' kcal':'—'}</b><small>${calorieEstimateDay(d).calculated?'Stima '+calorieEstimateDay(d).qualityLabel.toLowerCase():''}</small></div>
   </div>
 </section>

 <section class="card">
   <h2>Alimentazione</h2>
   <div class="pro3-day">
     <p><strong>Colazione:</strong> ${esc(d.breakfast||'—')}</p>
     <p><strong>Spuntino mattina:</strong> ${esc(d.snack1||'—')}</p>
     <p><strong>Pranzo:</strong> ${esc(d.lunch||'—')}</p>
     <p><strong>Spuntino pomeriggio:</strong> ${esc(d.snack2||'—')}</p>
     <p><strong>Cena:</strong> ${esc(d.dinner||'—')}</p>
     <p><strong>Sport / Note:</strong> ${esc(d.notes||'—')}</p>
   </div>
 </section>`;
}

function details(){
 const p=patient(selected)||mainPatient();
 const b=p.last&&p.height?bmi(p.last,p.height):null;
 return `${top(esc(p.name))}<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><button class="pro3-back" id="backPatients" style="margin-bottom:0">‹ Torna ai pazienti</button>${p.id!=='main'?'<button class="mini" id="deletePatient" style="color:#9a4646">Elimina paziente</button>':''}</div>
 <div class="pro3-kpis">
  <div><span>Peso iniziale</span><b>${p.first!=null?p.first.toFixed(1).replace('.',',')+' kg':'—'}</b></div>
  <div><span>Ultimo peso</span><b>${p.last!=null?p.last.toFixed(1).replace('.',',')+' kg':'—'}</b></div>
  <div><span>Variazione</span><b>${p.delta!=null?(p.delta>0?'+':'')+p.delta.toFixed(1).replace('.',',')+' kg':'—'}</b></div>
  <div><span>BMI</span><b>${b?b.toFixed(1).replace('.',','):'—'}</b></div>
 </div>
 <section class="card"><div class="pro3-tabs">
  ${[['summary','Riepilogo'],['anamnesis','Anamnesi'],['labs','Esami'],['plan','Piano'],['privacy','Privacy'],['account','Account'],['diary','Diario'],['trend','Andamento'],['measures','Misure'],['visits','Visite'],['notes','Note']].map(([k,l])=>`<button data-tab="${k}" class="${tab===k?'active':''}">${l}</button>`).join('')}
 </div>${tabContent(p)}</section>`;
}
function ageFromBirth(b){if(!b)return '—';const d=new Date(b+'T12:00:00'),n=new Date();let a=n.getFullYear()-d.getFullYear();if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))a--;return a}function latestMeasure(p){return (p.measures||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1)||null}
const CALORIE_FOODS=[
 {names:['yogurt greco 0%','yogurt greco zero'],k100:59,portionKcal:74},
 {names:['yogurt greco'],k100:90,portionKcal:113,generic:{vasetto:125,vasetti:125}},
 {names:['yogurt bianco','yogurt'],k100:70,portionKcal:88,generic:{vasetto:125,vasetti:125}},
 {names:['latte scremato'],k100:35},
 {names:['latte parzialmente scremato','zymil'],k100:46},
 {names:['latte intero','latte'],k100:64},
 {names:['cappuccino'],portionKcal:70},
 {names:['mozzarella'],k100:250},
 {names:['ricotta'],k100:174},
 {names:['fiocchi di latte','fiocchi'],k100:100},
 {names:['parmigiano','grana padano','grana'],k100:398},

 {names:['pan bauletto'],k100:265,generic:{fetta:25,fette:25}},
 {names:['pane integrale'],k100:247,generic:{fetta:30,fette:30}},
 {names:['pane'],k100:265,generic:{fetta:30,fette:30}},
 {names:['pasta integrale'],k100:345},
 {names:['pasta'],k100:350},
 {names:['riso basmati'],k100:350},
 {names:['riso'],k100:360},
 {names:['cous cous','couscous'],k100:360},
 {names:['farro'],k100:335},
 {names:['orzo'],k100:354},
 {names:['avena'],k100:389},
 {names:['cereali'],k100:370},
 {names:['corn flakes','cornflakes'],k100:357},
 {names:['fette biscottate'],k100:410},
 {names:['crackers','cracker'],k100:430},
 {names:['grissini','grissino'],k100:430},
 {names:['piadina'],k100:330},

 {names:['gocciole'],k100:470},
 {names:['biscotti','biscotto'],k100:450},
 {names:['crostata'],k100:400},
 {names:['torta'],k100:360},
 {names:['cioccolato fondente'],k100:550},
 {names:['cioccolato al latte'],k100:535},
 {names:['cioccolato'],k100:540},
 {names:['barretta cereali','barretta ai cereali','barretta','barrette'],portionKcal:110},

 {names:['petto di pollo','pollo'],k100:165},
 {names:['petto di tacchino','tacchino'],k100:135},
 {names:['manzo magro','manzo'],k100:180},
 {names:['vitello'],k100:172},
 {names:['maiale'],k100:242},
 {names:['hamburger di manzo','hamburger'],k100:250},
 {names:['bresaola'],k100:150},
 {names:['prosciutto crudo'],k100:270},
 {names:['prosciutto cotto'],k100:215},
 {names:['prosciutto'],k100:220},
 {names:['mortadella'],k100:317},
 {names:['salame'],k100:400},

 {names:['sgombro al naturale','sgombro'],k100:205},
 {names:['tonno al naturale'],k100:116},
 {names:['tonno sott olio','tonno sottolio'],k100:190},
 {names:['tonno'],k100:190},
 {names:['salmone'],k100:210},
 {names:['merluzzo'],k100:82},
 {names:['orata'],k100:121},
 {names:['branzino','spigola'],k100:124},
 {names:['sogliola'],k100:86},
 {names:['gamberi','gambero'],k100:99},
 {names:['cozze'],k100:85},
 {names:['vongole'],k100:74},
 {names:['polpo'],k100:82},
 {names:['calamari','calamaro'],k100:92},

 {names:['uova','uovo'],portionKcal:78},

 {names:['piselli'],k100:81},
 {names:['ceci'],k100:164},
 {names:['lenticchie'],k100:116},
 {names:['fagioli cannellini','cannellini'],k100:90},
 {names:['fagioli borlotti','borlotti'],k100:102},
 {names:['fagioli'],k100:100},

 {names:['carote','carota'],k100:41},
 {names:['zucchine','zucchina'],k100:17},
 {names:['melanzane','melanzana'],k100:25},
 {names:['peperoni','peperone'],k100:31},
 {names:['broccoli','broccolo'],k100:34},
 {names:['cavolfiore'],k100:25},
 {names:['spinaci','spinacio'],k100:23},
 {names:['bietole','bietola'],k100:19},
 {names:['finocchi','finocchio'],k100:31},
 {names:['cetrioli','cetriolo'],k100:15},
 {names:['iceberg'],k100:14},
 {names:['lattuga'],k100:15},
 {names:['insalata'],k100:20},
 {names:['pomodorini','pomodoro','pomodori'],k100:18},
 {names:['funghi'],k100:22},
 {names:['patate lesse','patate bollite'],k100:87},
 {names:['patate al forno'],k100:149},
 {names:['patate'],k100:77},
 {names:['verdure'],k100:35},

 {names:['banana','banane'],portionKcal:90},
 {names:['mela','mele'],portionKcal:80},
 {names:['pera','pere'],portionKcal:85},
 {names:['arancia','arance'],portionKcal:70},
 {names:['kiwi'],portionKcal:45},
 {names:['fragole'],k100:32},
 {names:['anguria','cocomero'],k100:30},
 {names:['melone'],k100:34},
 {names:['pesca','pesche'],portionKcal:60},
 {names:['uva'],k100:69},
 {names:['ananas'],k100:50},

 {names:['mandorle'],k100:579},
 {names:['noci'],k100:654},
 {names:['nocciole'],k100:628},
 {names:['pistacchi'],k100:562},

 {names:['olio extravergine','olio evo','olio'],k100:884,generic:{cucchiaino:5,cucchiaini:5,cucchiaio:10,cucchiai:10}},
 {names:['burro'],k100:717},
 {names:['maionese'],k100:680},

 {names:['succo di frutta','succo'],portionKcal:90},
 {names:['birra'],k100:43},
 {names:['vino rosso','vino bianco','vino'],k100:83},

 {names:['pizza margherita','margherita'],k100:270},
 {names:['pizza'],k100:270}
,
 {names:["rucola", "ruchetta"],k100:28},
 {names:["albicocche", "albicocca"],k100:48,generic:{"pezzo": 35, "pezzi": 35}},
 {names:["skyr"],k100:63,portionKcal:79,generic:{"vasetto": 125, "vasetti": 125}},
 {names:["kefir"],k100:60,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["latte di soia"],k100:40,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["latte di mandorla"],k100:35,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["latte di avena"],k100:46,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["mozzarella di bufala"],k100:288},
 {names:["mozzarella light"],k100:180},
 {names:["ricotta di pecora"],k100:157},
 {names:["pecorino romano", "pecorino"],k100:387},
 {names:["gorgonzola"],k100:324},
 {names:["taleggio"],k100:315},
 {names:["fontina"],k100:389},
 {names:["asiago"],k100:356},
 {names:["provolone"],k100:351},
 {names:["scamorza"],k100:334},
 {names:["caciotta"],k100:363},
 {names:["stracchino", "crescenza"],k100:300},
 {names:["robiola"],k100:333},
 {names:["mascarpone"],k100:455},
 {names:["formaggio spalmabile", "philadelphia"],k100:250},
 {names:["feta"],k100:264},
 {names:["pane di segale"],k100:259,generic:{"fetta": 30, "fette": 30}},
 {names:["pane ai cereali"],k100:260,generic:{"fetta": 30, "fette": 30}},
 {names:["rosetta", "michetta"],k100:280},
 {names:["ciabatta"],k100:270},
 {names:["baguette"],k100:275},
 {names:["pane azzimo"],k100:377},
 {names:["pasta fresca"],k100:288},
 {names:["pasta all'uovo", "tagliatelle"],k100:370},
 {names:["spaghetti"],k100:350},
 {names:["penne"],k100:350},
 {names:["fusilli"],k100:350},
 {names:["riso integrale"],k100:337},
 {names:["riso parboiled"],k100:349},
 {names:["cous cous integrale", "couscous integrale"],k100:350},
 {names:["grano saraceno"],k100:343},
 {names:["quinoa"],k100:368},
 {names:["amaranto"],k100:371},
 {names:["bulgur"],k100:342},
 {names:["polenta", "farina di mais"],k100:350},
 {names:["semolino"],k100:360},
 {names:["gnocchi di patate", "gnocchi"],k100:150},
 {names:["tortellini"],k100:307},
 {names:["ravioli"],k100:270},
 {names:["corn flakes", "cornflakes"],k100:357},
 {names:["muesli"],k100:370},
 {names:["granola"],k100:470},
 {names:["fette biscottate integrali"],k100:390,generic:{"fetta": 10, "fette": 10}},
 {names:["wafer"],k100:520},
 {names:["merendina"],k100:420},
 {names:["croissant vuoto", "cornetto vuoto", "brioche vuota"],k100:400},
 {names:["croissant", "cornetto", "brioche"],k100:420},
 {names:["panettone"],k100:360},
 {names:["pandoro"],k100:410},
 {names:["colomba"],k100:390},
 {names:["savoiardi"],k100:390},
 {names:["gelato alla crema"],k100:220},
 {names:["gelato alla frutta"],k100:160},
 {names:["gelato"],k100:200},
 {names:["sorbetto"],k100:130},
 {names:["coscia di pollo"],k100:210},
 {names:["coniglio"],k100:173},
 {names:["manzo magro"],k100:180},
 {names:["manzo"],k100:220},
 {names:["lonza di maiale", "lonza"],k100:190},
 {names:["maiale magro"],k100:180},
 {names:["hamburger di manzo", "hamburger"],k100:250,generic:{"pezzo": 100, "pezzi": 100}},
 {names:["salsiccia"],k100:330},
 {names:["wurstel"],k100:300},
 {names:["agnello"],k100:294},
 {names:["cavallo"],k100:133},
 {names:["prosciutto crudo sgrassato"],k100:180},
 {names:["prosciutto cotto sgrassato"],k100:145},
 {names:["fesa di tacchino"],k100:110},
 {names:["speck"],k100:300},
 {names:["coppa"],k100:400},
 {names:["pancetta"],k100:450},
 {names:["salmone affumicato"],k100:180},
 {names:["nasello"],k100:71},
 {names:["trota"],k100:148},
 {names:["pesce spada"],k100:172},
 {names:["sardine", "sarde"],k100:208},
 {names:["acciughe", "alici"],k100:131},
 {names:["gamberetti"],k100:85},
 {names:["seppie", "seppia"],k100:79},
 {names:["baccalà"],k100:122},
 {names:["albume d'uovo", "albume", "albumi"],k100:52},
 {names:["tuorlo d'uovo", "tuorlo", "tuorli"],k100:322},
 {names:["fagioli rossi"],k100:127},
 {names:["fagioli neri"],k100:132},
 {names:["fave"],k100:88},
 {names:["lupini"],k100:114},
 {names:["soia edamame", "edamame"],k100:121},
 {names:["cavolo cappuccio"],k100:25},
 {names:["cavolo nero"],k100:49},
 {names:["verza"],k100:27},
 {names:["radicchio"],k100:23},
 {names:["indivia"],k100:17},
 {names:["scarola"],k100:17},
 {names:["lattuga romana"],k100:17},
 {names:["asparagi", "asparago"],k100:20},
 {names:["carciofi", "carciofo"],k100:47},
 {names:["cipolla rossa", "cipolla bianca", "cipolla", "cipolle"],k100:40},
 {names:["aglio"],k100:149},
 {names:["sedano"],k100:16},
 {names:["porro", "porri"],k100:61},
 {names:["rapa", "rape"],k100:28},
 {names:["barbabietola", "barbabietole"],k100:43},
 {names:["zucca"],k100:26},
 {names:["patate dolci", "batata"],k100:86},
 {names:["mais dolce", "mais"],k100:86},
 {names:["germogli di soia"],k100:30},
 {names:["verdure grigliate"],k100:60},
 {names:["mandarino", "mandarini"],portionKcal:45},
 {names:["clementina", "clementine"],portionKcal:35},
 {names:["pompelmo"],k100:42},
 {names:["limone", "limoni"],k100:29},
 {names:["lamponi", "lampone"],k100:52},
 {names:["mirtilli", "mirtillo"],k100:57},
 {names:["more", "mora"],k100:43},
 {names:["ribes"],k100:56},
 {names:["nettarina", "nettarine"],k100:44},
 {names:["prugna", "prugne"],k100:46},
 {names:["susina", "susine"],k100:46},
 {names:["ciliegie", "ciliegia"],k100:63},
 {names:["mango"],k100:60},
 {names:["papaya"],k100:43},
 {names:["avocado"],k100:160},
 {names:["fico", "fichi"],k100:74},
 {names:["melograno"],k100:83},
 {names:["cachi", "caco"],k100:70},
 {names:["datteri", "dattero"],k100:282},
 {names:["fichi secchi"],k100:249},
 {names:["uvetta", "uva passa"],k100:299},
 {names:["anacardi"],k100:553},
 {names:["arachidi"],k100:567},
 {names:["pinoli"],k100:673},
 {names:["semi di chia"],k100:486},
 {names:["semi di lino"],k100:534},
 {names:["semi di zucca"],k100:559},
 {names:["semi di girasole"],k100:584},
 {names:["margarina"],k100:717},
 {names:["maionese light"],k100:330,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["ketchup"],k100:112,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["senape"],k100:66,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["pesto genovese", "pesto"],k100:460,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["hummus"],k100:166,generic:{"cucchiaio": 20, "cucchiai": 20}},
 {names:["succo d'arancia", "succo arancia"],k100:45,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["spremuta d'arancia", "spremuta"],k100:45,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["coca cola zero", "cola zero"],k100:0,generic:{"lattina": 330, "lattine": 330}},
 {names:["coca cola", "cola"],k100:42,generic:{"lattina": 330, "lattine": 330}},
 {names:["tè freddo", "the freddo"],k100:35,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["birra analcolica"],k100:25,generic:{"bottiglia": 330, "bottiglie": 330}},
 {names:["prosecco"],k100:75,generic:{"bicchiere": 100, "bicchieri": 100}},
 {names:["pizza marinara", "marinara"],k100:240},
 {names:["pizza diavola", "diavola"],k100:300},
 {names:["pizza quattro formaggi"],k100:330},
 {names:["pizza capricciosa"],k100:290},
 {names:["pizza prosciutto e funghi"],k100:280},
 {names:["focaccia"],k100:300},
 {names:["bruschetta"],k100:250},
 {names:["pasta al pomodoro"],k100:145},
 {names:["pasta al pesto"],k100:220},
 {names:["pasta alla carbonara", "carbonara"],k100:300},
 {names:["pasta all'amatriciana", "amatriciana"],k100:240},
 {names:["pasta aglio olio e peperoncino"],k100:260},
 {names:["risotto ai funghi"],k100:160},
 {names:["risotto alla milanese"],k100:180},
 {names:["risotto"],k100:170},
 {names:["minestrone"],k100:55},
 {names:["passato di verdure"],k100:45},
 {names:["vellutata di verdure", "vellutata"],k100:70},
 {names:["insalata di riso"],k100:180},
 {names:["insalata di pollo"],k100:140},
 {names:["insalata caprese", "caprese"],k100:170},
 {names:["parmigiana di melanzane", "parmigiana"],k100:220},
 {names:["cotoletta alla milanese", "cotoletta"],k100:280},
 {names:["polpette"],k100:220},
 {names:["frittata"],k100:180},
 {names:["omelette"],k100:160},
 {names:["purè di patate", "pure di patate", "purè", "pure"],k100:110},
 {names:["patatine fritte"],k100:312},
 {names:["crocchette di patate", "crocchette"],k100:210},
 {names:["arancino", "arancina"],k100:250},
 {names:["supplì", "suppli"],k100:240},
 {names:["tofu"],k100:76},
 {names:["seitan"],k100:140},
 {names:["tempeh"],k100:193},
 {names:["proteine in polvere", "whey"],k100:390},
 {names:["miele"],k100:304,generic:{"cucchiaino": 7, "cucchiaini": 7, "cucchiaio": 20, "cucchiai": 20}},
 {names:["marmellata", "confettura"],k100:250,generic:{"cucchiaino": 10, "cucchiaini": 10, "cucchiaio": 20, "cucchiai": 20}},
 {names:["nutella", "crema spalmabile alle nocciole"],k100:539,generic:{"cucchiaino": 10, "cucchiaini": 10, "cucchiaio": 20, "cucchiai": 20}},
 {names:["zucchero"],k100:400,generic:{"cucchiaino": 5, "cucchiaini": 5, "cucchiaio": 12, "cucchiai": 12}},
 {names:["mela golden"],k100:57},
 {names:["mela granny smith"],k100:52},
 {names:["mela fuji"],k100:63},
 {names:["pera abate"],k100:57},
 {names:["pera williams"],k100:57},
 {names:["pesca noce"],k100:44},
 {names:["uva bianca"],k100:69},
 {names:["uva nera"],k100:69},
 {names:["frutti di bosco"],k100:45},
 {names:["mirtilli rossi", "cranberry"],k100:46},
 {names:["cocco fresco", "cocco"],k100:354},
 {names:["castagne"],k100:213},
 {names:["castagne bollite"],k100:120},
 {names:["nespole"],k100:47},
 {names:["litchi", "lychee"],k100:66},
 {names:["passion fruit", "frutto della passione"],k100:97},
 {names:["guava"],k100:68},
 {names:["pitaya", "dragon fruit"],k100:60},
 {names:["carambola"],k100:31},
 {names:["kumquat"],k100:71},
 {names:["banana essiccata"],k100:346},
 {names:["mela essiccata"],k100:243},
 {names:["prugne secche"],k100:240},
 {names:["albicocche secche"],k100:241},
 {names:["cicoria"],k100:23},
 {names:["catalogna"],k100:23},
 {names:["puntarelle"],k100:20},
 {names:["valeriana", "songino"],k100:21},
 {names:["misticanza"],k100:20},
 {names:["cime di rapa"],k100:32},
 {names:["friarielli"],k100:32},
 {names:["broccoletti"],k100:34},
 {names:["cavoletti di bruxelles"],k100:43},
 {names:["cavolo rosso"],k100:31},
 {names:["cavolo verza"],k100:27},
 {names:["cavolo cinese", "pak choi"],k100:13},
 {names:["cavolo rapa"],k100:27},
 {names:["rape rosse"],k100:43},
 {names:["ravanelli", "ravanello"],k100:16},
 {names:["topinambur"],k100:73},
 {names:["cardi", "cardo"],k100:17},
 {names:["okra"],k100:33},
 {names:["taccole"],k100:42},
 {names:["fagiolini"],k100:31},
 {names:["agretti", "barba di frate"],k100:17},
 {names:["fiori di zucca"],k100:12},
 {names:["pomodori secchi"],k100:258},
 {names:["pomodori pelati"],k100:24},
 {names:["pomodoro cuore di bue"],k100:18},
 {names:["pomodoro datterino", "datterini"],k100:20},
 {names:["cipollotto"],k100:32},
 {names:["scalogno"],k100:72},
 {names:["zenzero"],k100:80},
 {names:["rafano"],k100:48},
 {names:["finocchietto"],k100:31},
 {names:["prezzemolo"],k100:36},
 {names:["basilico"],k100:23},
 {names:["salvia"],k100:315},
 {names:["rosmarino"],k100:131},
 {names:["melanzane grigliate"],k100:35},
 {names:["zucchine grigliate"],k100:30},
 {names:["peperoni grigliati"],k100:40},
 {names:["spinaci cotti"],k100:23},
 {names:["broccoli cotti"],k100:35},
 {names:["cavolfiore cotto"],k100:23},
 {names:["ceci in scatola"],k100:120},
 {names:["lenticchie in scatola"],k100:92},
 {names:["fagioli cannellini"],k100:90},
 {names:["fagioli borlotti"],k100:102},
 {names:["fagioli azuki"],k100:128},
 {names:["cicerchie"],k100:315},
 {names:["piselli surgelati"],k100:72},
 {names:["lenticchie rosse"],k100:350},
 {names:["lenticchie verdi"],k100:350},
 {names:["farina di ceci"],k100:387},
 {names:["cernia"],k100:92},
 {names:["dentice"],k100:100},
 {names:["rombo"],k100:81},
 {names:["rana pescatrice", "coda di rospo"],k100:63},
 {names:["palombo"],k100:130},
 {names:["triglia"],k100:123},
 {names:["anguilla"],k100:184},
 {names:["aringa"],k100:158},
 {names:["sardine sott'olio"],k100:208},
 {names:["acciughe sott'olio"],k100:210},
 {names:["tonno fresco"],k100:144},
 {names:["salmone selvaggio"],k100:182},
 {names:["gamberoni"],k100:99},
 {names:["scampi"],k100:85},
 {names:["ostriche"],k100:68},
 {names:["capesante"],k100:88},
 {names:["surimi"],k100:99},
 {names:["pesce persico"],k100:91},
 {names:["tilapia"],k100:96},
 {names:["pangasio"],k100:92},
 {names:["pollo arrosto"],k100:190},
 {names:["pollo alla griglia"],k100:165},
 {names:["sovracoscia di pollo"],k100:209},
 {names:["ali di pollo"],k100:203},
 {names:["tacchino arrosto"],k100:160},
 {names:["macinato di manzo"],k100:250},
 {names:["filetto di manzo"],k100:190},
 {names:["roast beef"],k100:170},
 {names:["bistecca di manzo", "bistecca"],k100:230},
 {names:["fettina di vitello"],k100:170},
 {names:["arista di maiale", "arista"],k100:200},
 {names:["costine di maiale", "costine"],k100:290},
 {names:["braciola di maiale", "braciola"],k100:240},
 {names:["anatra"],k100:337},
 {names:["fegato di vitello"],k100:135},
 {names:["fegato di pollo"],k100:119},
 {names:["trippa"],k100:108},
 {names:["carne macinata"],k100:240},
 {names:["culatello"],k100:290},
 {names:["prosciutto di parma"],k100:270},
 {names:["prosciutto san daniele"],k100:270},
 {names:["salame ungherese"],k100:405},
 {names:["salame felino"],k100:420},
 {names:["soppressata"],k100:400},
 {names:["nduja", "'nduja"],k100:500},
 {names:["lardo"],k100:890},
 {names:["guanciale"],k100:655},
 {names:["porchetta"],k100:330},
 {names:["pancetta affumicata"],k100:460},
 {names:["burrata"],k100:330},
 {names:["stracciatella"],k100:300},
 {names:["bufala", "mozzarella bufala"],k100:288},
 {names:["emmental", "emmentaler"],k100:380},
 {names:["edamer"],k100:357},
 {names:["cheddar"],k100:403},
 {names:["brie"],k100:334},
 {names:["camembert"],k100:300},
 {names:["caprino"],k100:300},
 {names:["primo sale"],k100:250},
 {names:["quartirolo"],k100:300},
 {names:["montasio"],k100:371},
 {names:["bitto"],k100:410},
 {names:["casera"],k100:370},
 {names:["provola"],k100:350},
 {names:["formaggio light"],k100:180},
 {names:["yogurt alla frutta"],k100:95,generic:{"vasetto": 125, "vasetti": 125}},
 {names:["yogurt proteico"],k100:65,generic:{"vasetto": 150, "vasetti": 150}},
 {names:["budino proteico"],k100:80,generic:{"vasetto": 200, "vasetti": 200}},
 {names:["panna da cucina"],k100:292},
 {names:["panna montata"],k100:340},
 {names:["riso venere"],k100:360},
 {names:["riso rosso"],k100:350},
 {names:["riso jasmine"],k100:350},
 {names:["riso selvatico"],k100:357},
 {names:["riso soffiato"],k100:380},
 {names:["farina 00"],k100:364},
 {names:["farina 0"],k100:364},
 {names:["farina integrale"],k100:340},
 {names:["farina di avena"],k100:389},
 {names:["farina di riso"],k100:366},
 {names:["semola rimacinata"],k100:350},
 {names:["pane pugliese"],k100:270},
 {names:["pane di semola"],k100:270},
 {names:["pane toscano"],k100:265},
 {names:["pane carasau"],k100:380},
 {names:["pane arabo"],k100:275},
 {names:["pane pita", "pita"],k100:275},
 {names:["pane proteico"],k100:260},
 {names:["pane senza glutine"],k100:270},
 {names:["toast"],k100:270,generic:{"fetta": 25, "fette": 25}},
 {names:["pancarrè", "pan carre"],k100:270,generic:{"fetta": 25, "fette": 25}},
 {names:["frisella", "frisa"],k100:350},
 {names:["taralli"],k100:450},
 {names:["gallette di riso"],k100:387,generic:{"pezzo": 8, "pezzi": 8}},
 {names:["gallette di mais"],k100:380,generic:{"pezzo": 8, "pezzi": 8}},
 {names:["gallette"],k100:385,generic:{"pezzo": 8, "pezzi": 8}},
 {names:["wrap", "tortilla"],k100:310},
 {names:["pasta di legumi"],k100:340},
 {names:["pasta di ceci"],k100:350},
 {names:["pasta di lenticchie"],k100:340},
 {names:["pasta di piselli"],k100:340},
 {names:["pasta senza glutine"],k100:350},
 {names:["noodles"],k100:350},
 {names:["spaghetti di riso"],k100:360},
 {names:["udon"],k100:130},
 {names:["ramen"],k100:440},
 {names:["cannelloni"],k100:180},
 {names:["pasta ripiena"],k100:280},
 {names:["cappelletti"],k100:300},
 {names:["agnolotti"],k100:280},
 {names:["orecchiette"],k100:350},
 {names:["trofie"],k100:350},
 {names:["biscotti integrali"],k100:430,generic:{"biscotto": 10, "biscotti": 10}},
 {names:["biscotti digestive", "digestive"],k100:480,generic:{"biscotto": 14, "biscotti": 14}},
 {names:["biscotti frollini", "frollini"],k100:460,generic:{"biscotto": 10, "biscotti": 10}},
 {names:["biscotti al cioccolato"],k100:480,generic:{"biscotto": 12, "biscotti": 12}},
 {names:["biscotti senza zucchero"],k100:420,generic:{"biscotto": 10, "biscotti": 10}},
 {names:["pavesini"],k100:390,generic:{"biscotto": 2.2, "biscotti": 2.2}},
 {names:["oro saiwa"],k100:430,generic:{"biscotto": 7, "biscotti": 7}},
 {names:["plumcake"],k100:410},
 {names:["muffin"],k100:400},
 {names:["pancake"],k100:227},
 {names:["crepes", "crêpes"],k100:224},
 {names:["waffle"],k100:291},
 {names:["tiramisu", "tiramisù"],k100:300},
 {names:["panna cotta"],k100:240},
 {names:["cheesecake"],k100:320},
 {names:["cannolo siciliano", "cannolo"],k100:350},
 {names:["babà", "baba"],k100:250},
 {names:["sfogliatella"],k100:380},
 {names:["bignè", "bigne"],k100:300},
 {names:["millefoglie"],k100:350},
 {names:["profiteroles"],k100:330},
 {names:["amaretti"],k100:430},
 {names:["cantucci"],k100:440},
 {names:["torrone"],k100:480},
 {names:["burro di arachidi"],k100:588,generic:{"cucchiaino": 10, "cucchiaini": 10, "cucchiaio": 20, "cucchiai": 20}},
 {names:["burro di mandorle"],k100:614,generic:{"cucchiaino": 10, "cucchiaini": 10, "cucchiaio": 20, "cucchiai": 20}},
 {names:["crema di pistacchio"],k100:560},
 {names:["tahina", "tahin"],k100:595},
 {names:["noci pecan"],k100:691},
 {names:["noci brasiliane"],k100:659},
 {names:["macadamia"],k100:718},
 {names:["olio di semi"],k100:884,generic:{"cucchiaino": 5, "cucchiaini": 5, "cucchiaio": 10, "cucchiai": 10}},
 {names:["olio di cocco"],k100:892,generic:{"cucchiaino": 5, "cucchiaini": 5, "cucchiaio": 10, "cucchiai": 10}},
 {names:["aceto balsamico"],k100:88,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["aceto"],k100:18,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["salsa di soia"],k100:53,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["salsa barbecue"],k100:170,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["salsa yogurt"],k100:120,generic:{"cucchiaio": 15, "cucchiai": 15}},
 {names:["guacamole"],k100:150,generic:{"cucchiaio": 20, "cucchiai": 20}},
 {names:["caffè espresso", "caffe espresso", "espresso"],k100:2,generic:{"tazzina": 30, "tazzine": 30}},
 {names:["caffè americano", "caffe americano"],k100:2,generic:{"tazza": 240, "tazze": 240}},
 {names:["caffè macchiato", "caffe macchiato"],k100:20},
 {names:["latte macchiato"],k100:55,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["orzo solubile", "caffè d'orzo", "caffe d'orzo"],k100:20},
 {names:["cioccolata calda"],k100:90,generic:{"tazza": 200, "tazze": 200}},
 {names:["acqua di cocco"],k100:19,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["energy drink"],k100:45,generic:{"lattina": 250, "lattine": 250}},
 {names:["pasta cacio e pepe", "cacio e pepe"],k100:280},
 {names:["pasta alla norma", "pasta alla norma"],k100:190},
 {names:["pasta puttanesca", "puttanesca"],k100:190},
 {names:["pasta arrabbiata", "arrabbiata"],k100:170},
 {names:["pasta tonno e pomodoro"],k100:180},
 {names:["pasta e fagioli"],k100:130},
 {names:["pasta e ceci"],k100:140},
 {names:["pasta e lenticchie"],k100:135},
 {names:["pasta al ragù", "pasta al ragu"],k100:200},
 {names:["ragù alla bolognese", "ragu alla bolognese", "ragù", "ragu"],k100:150},
 {names:["lasagne al ragù", "lasagne al ragu"],k100:180},
 {names:["risotto alla zucca"],k100:150},
 {names:["risotto ai frutti di mare"],k100:160},
 {names:["riso alla cantonese"],k100:190},
 {names:["paella"],k100:180},
 {names:["cous cous di verdure"],k100:140},
 {names:["cous cous di pollo"],k100:170},
 {names:["polenta concia"],k100:250},
 {names:["polenta e funghi"],k100:140},
 {names:["gnocchi al pomodoro"],k100:140},
 {names:["gnocchi al pesto"],k100:210},
 {names:["gnocchi al ragù", "gnocchi al ragu"],k100:190},
 {names:["insalata greca"],k100:150},
 {names:["insalata nizzarda"],k100:140},
 {names:["panzanella"],k100:120},
 {names:["vitello tonnato"],k100:220},
 {names:["carpaccio di manzo"],k100:130},
 {names:["tartare di manzo"],k100:150},
 {names:["tartare di salmone"],k100:190},
 {names:["pollo al curry"],k100:160},
 {names:["pollo alla cacciatora"],k100:150},
 {names:["spezzatino di manzo"],k100:170},
 {names:["brasato"],k100:190},
 {names:["arrosto di vitello"],k100:180},
 {names:["melanzane alla parmigiana"],k100:220},
 {names:["zucchine ripiene"],k100:130},
 {names:["peperoni ripieni"],k100:150},
 {names:["pomodori ripieni"],k100:120},
 {names:["frittata di zucchine"],k100:160},
 {names:["frittata di patate"],k100:190},
 {names:["uova strapazzate"],k100:170},
 {names:["uovo alla coque"],portionKcal:78},
 {names:["uovo al tegamino"],portionKcal:90},
 {names:["toast prosciutto e formaggio"],k100:280},
 {names:["panino prosciutto"],k100:260},
 {names:["panino bresaola"],k100:230},
 {names:["panino tonno"],k100:250},
 {names:["hamburger completo"],k100:260},
 {names:["kebab"],k100:220},
 {names:["sushi"],k100:150},
 {names:["sashimi"],k100:130},
 {names:["poke"],k100:150},
 {names:["minestrone surgelato"],k100:40},
 {names:["verdure surgelate"],k100:35},
 {names:["spinaci surgelati"],k100:23},
 {names:["bastoncini di pesce"],k100:220},
 {names:["sofficini"],k100:230},
 {names:["pizza surgelata"],k100:240},
 {names:["patate surgelate"],k100:150},
 {names:["acerola"],k100:32},
 {names:["annona"],k100:75},
 {names:["bergamotto"],k100:36},
 {names:["cedro"],k100:32},
 {names:["fichi d'india", "fico d'india"],k100:41},
 {names:["giuggiole", "giuggiola"],k100:79},
 {names:["mangostano"],k100:73},
 {names:["rabarbaro"],k100:21},
 {names:["sambuco bacche"],k100:73},
 {names:["tamarindo"],k100:239},
 {names:["amarene", "amarena"],k100:50},
 {names:["visciole", "visciola"],k100:50},
 {names:["uva spina"],k100:44},
 {names:["cetriolini sottaceto", "cetriolini"],k100:12},
 {names:["cipolline sottaceto", "cipolline"],k100:30},
 {names:["crauti"],k100:19},
 {names:["kimchi"],k100:15},
 {names:["alghe wakame", "wakame"],k100:45},
 {names:["alghe nori", "nori"],k100:306},
 {names:["alghe kombu", "kombu"],k100:43},
 {names:["avocado hass"],k100:167},
 {names:["bambù", "germogli di bambù"],k100:27},
 {names:["crescione"],k100:32},
 {names:["dragoncello"],k100:295},
 {names:["erba cipollina"],k100:30},
 {names:["menta"],k100:44},
 {names:["origano fresco"],k100:45},
 {names:["peperoncino fresco"],k100:40},
 {names:["peperoncino secco"],k100:282},
 {names:["timo"],k100:101},
 {names:["curcuma fresca"],k100:65},
 {names:["zucca butternut"],k100:45},
 {names:["zucca delica"],k100:40},
 {names:["zucca mantovana"],k100:40},
 {names:["patata viola"],k100:80},
 {names:["patate novelle"],k100:70},
 {names:["funghi pleurotus", "pleurotus"],k100:33},
 {names:["funghi shiitake", "shiitake"],k100:34},
 {names:["funghi chiodini", "chiodini"],k100:22},
 {names:["funghi finferli", "finferli"],k100:38},
 {names:["fagioli mung"],k100:105},
 {names:["fagioli dall'occhio"],k100:116},
 {names:["piselli spezzati"],k100:341},
 {names:["soia gialla"],k100:446},
 {names:["soia verde"],k100:347},
 {names:["proteine di soia"],k100:330},
 {names:["miglio"],k100:378},
 {names:["teff"],k100:367},
 {names:["sorgo"],k100:329},
 {names:["kamut", "grano khorasan"],k100:337},
 {names:["grano duro"],k100:339},
 {names:["grano tenero"],k100:340},
 {names:["segale"],k100:338},
 {names:["crusca d'avena"],k100:246},
 {names:["crusca di frumento"],k100:216},
 {names:["fiocchi d'avena"],k100:370},
 {names:["fiocchi di farro"],k100:350},
 {names:["fiocchi di mais"],k100:357},
 {names:["fiocchi di riso"],k100:370},
 {names:["quinoa cotta"],k100:120},
 {names:["riso basmati cotto"],k100:121},
 {names:["riso bianco cotto"],k100:130},
 {names:["riso integrale cotto"],k100:123},
 {names:["farro cotto"],k100:127},
 {names:["orzo cotto"],k100:123},
 {names:["cous cous cotto", "couscous cotto"],k100:112},
 {names:["pane di altamura"],k100:270},
 {names:["pane di matera"],k100:270},
 {names:["pane cafone"],k100:270},
 {names:["pane casereccio"],k100:270},
 {names:["pane nero"],k100:250},
 {names:["pane multicereali"],k100:260},
 {names:["pane con semi"],k100:280},
 {names:["pane alle noci"],k100:320},
 {names:["pane all'olio"],k100:310},
 {names:["pane al latte"],k100:300},
 {names:["panino al latte"],k100:300},
 {names:["panino integrale"],k100:250},
 {names:["panino ai cereali"],k100:260},
 {names:["pane hamburger", "burger bun"],k100:280},
 {names:["hot dog bun", "pane hot dog"],k100:280},
 {names:["focaccia genovese"],k100:330},
 {names:["focaccia barese"],k100:280},
 {names:["schiacciata toscana"],k100:310},
 {names:["crescentina", "tigella"],k100:330},
 {names:["gnocco fritto"],k100:420},
 {names:["erbazzone"],k100:250},
 {names:["farinata di ceci", "farinata"],k100:210},
 {names:["panelle"],k100:250},
 {names:["pinsa romana", "pinsa"],k100:250},
 {names:["pizza bianca"],k100:300},
 {names:["pizza rossa"],k100:250},
 {names:["pizza napoletana"],k100:270},
 {names:["pizza ortolana"],k100:260},
 {names:["pizza tonno e cipolla"],k100:285},
 {names:["pizza wurstel"],k100:300},
 {names:["pizza prosciutto"],k100:280},
 {names:["pizza funghi"],k100:260},
 {names:["pizza bufala"],k100:290},
 {names:["pasta cotta"],k100:158},
 {names:["pasta integrale cotta"],k100:149},
 {names:["spaghetti cotti"],k100:158},
 {names:["pasta fresca ripiena"],k100:280},
 {names:["ravioli ricotta e spinaci"],k100:250},
 {names:["tortellini in brodo"],k100:110},
 {names:["tortelloni"],k100:280},
 {names:["pizzoccheri"],k100:340},
 {names:["strozzapreti"],k100:350},
 {names:["malloreddus"],k100:350},
 {names:["bucatini"],k100:350},
 {names:["linguine"],k100:350},
 {names:["paccheri"],k100:350},
 {names:["rigatoni"],k100:350},
 {names:["farfalle"],k100:350},
 {names:["conchiglie pasta"],k100:350},
 {names:["sugo al pomodoro", "sugo di pomodoro"],k100:50},
 {names:["sugo all'arrabbiata"],k100:70},
 {names:["sugo ai funghi"],k100:90},
 {names:["sugo alle olive"],k100:100},
 {names:["sugo tonno"],k100:110},
 {names:["besciamella"],k100:120},
 {names:["salsa tartara"],k100:520},
 {names:["salsa rosa"],k100:350},
 {names:["salsa tzatziki", "tzatziki"],k100:120},
 {names:["salsa teriyaki"],k100:90},
 {names:["salsa piccante"],k100:60},
 {names:["filetto di pollo"],k100:165},
 {names:["pollo lesso"],k100:170},
 {names:["pollo impanato"],k100:240},
 {names:["pollo fritto"],k100:260},
 {names:["pollo allo spiedo"],k100:200},
 {names:["tacchino alla griglia"],k100:135},
 {names:["fesa di tacchino arrosto"],k100:150},
 {names:["hamburger di pollo"],k100:200},
 {names:["hamburger di tacchino"],k100:180},
 {names:["hamburger vegetale"],k100:180},
 {names:["polpettone"],k100:220},
 {names:["polpette di pollo"],k100:190},
 {names:["polpette di tacchino"],k100:180},
 {names:["polpette al sugo"],k100:180},
 {names:["carne salada"],k100:140},
 {names:["tagliata di manzo"],k100:210},
 {names:["entrecote"],k100:250},
 {names:["controfiletto"],k100:220},
 {names:["fiorentina"],k100:250},
 {names:["scottona"],k100:240},
 {names:["bollito di manzo"],k100:210},
 {names:["lesso di manzo"],k100:210},
 {names:["ossobuco"],k100:180},
 {names:["stinco di maiale"],k100:240},
 {names:["stinco di vitello"],k100:190},
 {names:["coniglio arrosto"],k100:200},
 {names:["coniglio in umido"],k100:180},
 {names:["merluzzo surgelato"],k100:82},
 {names:["merluzzo al vapore"],k100:90},
 {names:["merluzzo impanato"],k100:200},
 {names:["salmone al forno"],k100:210},
 {names:["salmone alla griglia"],k100:210},
 {names:["orata al forno"],k100:130},
 {names:["branzino al forno"],k100:130},
 {names:["spigola al forno"],k100:130},
 {names:["trota salmonata"],k100:160},
 {names:["trota affumicata"],k100:180},
 {names:["tonno scottato"],k100:150},
 {names:["filetti di sgombro"],k100:205},
 {names:["filetti di alici"],k100:130},
 {names:["insalata di mare"],k100:100},
 {names:["fritto misto di pesce"],k100:250},
 {names:["calamari fritti"],k100:250},
 {names:["gamberi alla griglia"],k100:110},
 {names:["polpo con patate"],k100:120},
 {names:["polpo alla griglia"],k100:90},
 {names:["cozze alla marinara"],k100:90},
 {names:["impepata di cozze"],k100:90},
 {names:["latte senza lattosio"],k100:46,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["latte alta digeribilità"],k100:46,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["latte proteico"],k100:55,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["bevanda di riso", "latte di riso"],k100:47,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["bevanda di cocco", "latte di cocco bevanda"],k100:25,generic:{"bicchiere": 200, "bicchieri": 200}},
 {names:["latte condensato"],k100:321},
 {names:["yogurt senza lattosio"],k100:70,generic:{"vasetto": 125, "vasetti": 125}},
 {names:["yogurt di soia"],k100:55,generic:{"vasetto": 125, "vasetti": 125}},
 {names:["yogurt greco 2%"],k100:73,generic:{"vasetto": 150, "vasetti": 150}},
 {names:["yogurt greco 5%"],k100:97,generic:{"vasetto": 150, "vasetti": 150}},
 {names:["quark"],k100:70},
 {names:["quark magro"],k100:65},
 {names:["formaggio quark"],k100:70},
 {names:["ricotta light"],k100:130},
 {names:["mozzarella senza lattosio"],k100:250},
 {names:["mozzarella fior di latte", "fior di latte"],k100:250},
 {names:["caciocavallo"],k100:439},
 {names:["castelmagno"],k100:410},
 {names:["formaggio di capra"],k100:360},
 {names:["formaggio di pecora"],k100:380},
 {names:["formaggio di mucca"],k100:350},
 {names:["uova di quaglia", "uovo di quaglia"],k100:158},
 {names:["frittata di cipolle"],k100:170},
 {names:["frittata di spinaci"],k100:160},
 {names:["frittata di albumi"],k100:80},
 {names:["omelette prosciutto"],k100:190},
 {names:["omelette formaggio"],k100:220},
 {names:["uova in camicia", "uovo in camicia"],portionKcal:75},
 {names:["porridge"],k100:90},
 {names:["porridge proteico"],k100:110},
 {names:["overnight oats"],k100:120},
 {names:["cereali integrali"],k100:360},
 {names:["cereali fitness"],k100:370},
 {names:["cereali ripieni"],k100:430},
 {names:["riso soffiato al cioccolato"],k100:400},
 {names:["granola proteica"],k100:430},
 {names:["granola senza zucchero"],k100:400},
 {names:["barretta al cioccolato"],k100:480},
 {names:["barretta di frutta secca"],k100:450},
 {names:["barretta energetica"],k100:400},
 {names:["chips di patate", "patatine in busta"],k100:530},
 {names:["popcorn"],k100:387},
 {names:["popcorn al burro"],k100:500},
 {names:["nachos"],k100:500},
 {names:["salatini"],k100:450},
 {names:["pretzel"],k100:380},
 {names:["taralli integrali"],k100:430},
 {names:["grissini integrali"],k100:410},
 {names:["cracker senza sale"],k100:420},
 {names:["cracker di riso"],k100:400},
 {names:["cracker di segale"],k100:390},
 {names:["biscotti al burro"],k100:500},
 {names:["biscotti avena"],k100:450},
 {names:["biscotti di riso"],k100:420},
 {names:["biscotti senza glutine"],k100:450},
 {names:["biscotti proteici"],k100:400},
 {names:["biscotti ripieni"],k100:480},
 {names:["torta di mele"],k100:250},
 {names:["torta al cioccolato"],k100:390},
 {names:["torta della nonna"],k100:350},
 {names:["torta paradiso"],k100:410},
 {names:["torta sacher", "sacher"],k100:380},
 {names:["brownie"],k100:466},
 {names:["cookies", "cookie"],k100:480},
 {names:["donut", "ciambella americana"],k100:420},
 {names:["ciambellone"],k100:370},
 {names:["budino al cioccolato"],k100:120},
 {names:["budino alla vaniglia"],k100:110},
 {names:["crema pasticcera"],k100:180},
 {names:["zabaione"],k100:250},
 {names:["semifreddo"],k100:250},
 {names:["granita"],k100:100},
 {names:["ghiacciolo"],k100:80},
 {names:["gelato proteico"],k100:130},
 {names:["yogurt gelato", "frozen yogurt"],k100:160},
 {names:["zuppa di legumi"],k100:90},
 {names:["zuppa di ceci"],k100:100},
 {names:["zuppa di lenticchie"],k100:90},
 {names:["zuppa di fagioli"],k100:100},
 {names:["zuppa di farro"],k100:90},
 {names:["zuppa d'orzo"],k100:80},
 {names:["ribollita"],k100:90},
 {names:["acquacotta"],k100:70},
 {names:["pappa al pomodoro"],k100:100},
 {names:["stracciatella in brodo"],k100:70},
 {names:["brodo vegetale"],k100:15},
 {names:["brodo di carne"],k100:30},
 {names:["pastina in brodo"],k100:80},
 {names:["riso in bianco"],k100:130},
 {names:["pasta in bianco"],k100:190},
 {names:["pasta burro e parmigiano"],k100:230},
 {names:["pasta ricotta e spinaci"],k100:190},
 {names:["pasta zucchine"],k100:160},
 {names:["pasta broccoli"],k100:160},
 {names:["pasta salmone"],k100:220},
 {names:["pasta vongole", "spaghetti alle vongole"],k100:180},
 {names:["spaghetti allo scoglio"],k100:180},
 {names:["risotto al parmigiano"],k100:190},
 {names:["risotto ai porcini"],k100:170},
 {names:["risotto al radicchio"],k100:160},
 {names:["risotto agli asparagi"],k100:155},
 {names:["risotto al pesce"],k100:165},
 {names:["riso pollo e verdure"],k100:160},
 {names:["riso basmati pollo"],k100:170},
 {names:["riso tonno"],k100:160},
 {names:["riso e piselli", "risi e bisi"],k100:130},
 {names:["piadina prosciutto e formaggio"],k100:300},
 {names:["piadina bresaola"],k100:260},
 {names:["piadina crudo e squacquerone"],k100:320},
 {names:["cassone romagnolo", "crescione romagnolo"],k100:250},
 {names:["arancino al ragù", "arancino al ragu"],k100:260},
 {names:["arancino al burro"],k100:270},
 {names:["panzerotto"],k100:280},
 {names:["calzone"],k100:280},
 {names:["calzone fritto"],k100:350},
 {names:["mozzarella in carrozza"],k100:300},
 {names:["olive ascolane"],k100:250},
 {names:["fiori di zucca fritti"],k100:220},
 {names:["falafel"],k100:333},
 {names:["shawarma"],k100:220},
 {names:["hummus di ceci"],k100:166},
 {names:["guacamole avocado"],k100:150},
 {names:["chili con carne"],k100:150},
 {names:["burrito"],k100:200},
 {names:["tacos"],k100:220},
 {names:["quesadilla"],k100:300},
 {names:["curry di ceci"],k100:140},
 {names:["curry di lenticchie", "dhal", "dal"],k100:130},
 {names:["riso al curry"],k100:160},
 {names:["pad thai"],k100:190},
 {names:["riso cantonese"],k100:190},
 {names:["involtini primavera"],k100:220},
 {names:["gyoza"],k100:200},
 {names:["tempura"],k100:250},
 {names:["sushi nigiri"],k100:160},
 {names:["sushi maki"],k100:150},
 {names:["uramaki"],k100:180},
 {names:["sushi salmone"],k100:170},
 {names:["burger di soia"],k100:180},
 {names:["burger di ceci"],k100:170},
 {names:["burger di lenticchie"],k100:170},
 {names:["burger di verdure"],k100:150},
 {names:["polpette vegetali"],k100:170},
 {names:["tofu affumicato"],k100:150},
 {names:["tofu al naturale"],k100:76},
 {names:["seitan alla piastra"],k100:150},
 {names:["bevanda proteica"],k100:60},
 {names:["crema 100% arachidi"],k100:588},
 {names:["crema 100% mandorle"],k100:614},
 {names:["crema 100% nocciole"],k100:628},
 {names:["crema di nocciole"],k100:550},
 {names:["crema di mandorle"],k100:614},
 {names:["crema di anacardi"],k100:590},
 {names:["sciroppo d'acero"],k100:260},
 {names:["sciroppo d'agave"],k100:310},
 {names:["melassa"],k100:290},
 {names:["mostarda"],k100:200},
 {names:["salsa verde"],k100:250},
 {names:["salsa tonnata"],k100:350},
 {names:["tè verde", "te verde"],k100:1,generic:{"tazza": 240, "tazze": 240}},
 {names:["tè nero", "te nero"],k100:1,generic:{"tazza": 240, "tazze": 240}},
 {names:["tisana"],k100:1,generic:{"tazza": 240, "tazze": 240}},
 {names:["camomilla"],k100:1,generic:{"tazza": 240, "tazze": 240}},
 {names:["caffè decaffeinato", "caffe decaffeinato"],k100:2},
 {names:["ginseng bevanda"],k100:60},
 {names:["succo di mela"],k100:46},
 {names:["succo di ananas"],k100:53},
 {names:["succo ace"],k100:45},
 {names:["smoothie frutta"],k100:60},
 {names:["frullato di frutta"],k100:70},
 {names:["frappè", "frappe"],k100:120},
 {names:["bresaola di tacchino"],k100:120},
 {names:["prosciutto di tacchino"],k100:120},
 {names:["affettato di pollo"],k100:110},
 {names:["salmone in scatola"],k100:140},
 {names:["sgombro in scatola"],k100:200},
 {names:["sardine in scatola"],k100:200},
 {names:["uova strapazzate con burro"],k100:190},
 {names:["albumi pastorizzati"],k100:46}];


function calorieNormalize(s){
 return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
}
function calorieSegments(text){
 return String(text||'').replace(/\r/g,'').split(/\n|[;]+|\s+\+\s+/).map(x=>x.trim()).filter(Boolean);
}
function findCalorieFood(segment){
 const s=calorieNormalize(segment);
 let matches=[];
 for(const food of CALORIE_FOODS){
   for(const name of food.names){
     const idx=s.indexOf(name);
     if(idx>=0)matches.push({...food,matchedName:name,matchIndex:idx});
   }
 }
 if(!matches.length)return null;
 matches.sort((a,b)=>a.matchIndex-b.matchIndex || b.matchedName.length-a.matchedName.length);
 return matches[0];
}
function parseSegmentCalories(segment){
 const raw=calorieNormalize(segment),food=findCalorieFood(raw);
 if(!food)return {segment,status:'unknown',calories:0,label:segment};

 // Precise units: grams / ml
 let m=raw.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|grammi|ml)\b/i);
 if(m){
   const qty=Number(m[1].replace(',','.'));
   if(Number.isFinite(qty)&&qty>0&&food.k100)
     return {segment,status:'calculated',calories:Math.round(qty*food.k100/100),label:food.matchedName,quantity:`${qty} ${m[2]}`};
 }

 // Household/generic units: slices, spoons, jars...
 m=raw.match(/(\d+(?:[.,]\d+)?)\s*(fetta|fette|cucchiaino|cucchiaini|cucchiaio|cucchiai|vasetto|vasetti|porzione|porzioni|pezzo|pezzi|bicchiere|bicchieri|bottiglia|bottiglie|lattina|lattine|biscotto|biscotti|tazzina|tazzine|tazza|tazze)\b/i);
 if(m){
   const qty=Number(m[1].replace(',','.'));
   const unit=m[2].toLowerCase();
   if(Number.isFinite(qty)&&qty>0){
     if(food.generic && food.generic[unit] && food.k100){
       const grams=qty*food.generic[unit];
       return {
         segment,
         status:'genericQuantity',
         calories:Math.round(grams*food.k100/100),
         label:food.matchedName,
         quantity:`${qty} ${unit}`,
         assumedGrams:Math.round(grams)
       };
     }
     // Quantity exists but we do not know a safe conversion for this food.
     return {segment,status:'genericQuantityNoEstimate',calories:0,label:food.matchedName,quantity:`${qty} ${unit}`};
   }
 }

 // Countable foods such as 1 banana, 2 uova, 1 yogurt.
 m=raw.match(/^(\d+(?:[.,]\d+)?)\s+(?:di\s+)?/i);
 if(m&&!/\b(g|gr|grammi|ml)\b/i.test(raw)){
   const qty=Number(m[1].replace(',','.'));
   if(Number.isInteger(qty)&&qty>0&&qty<=10&&food.portionKcal)
     return {segment,status:'genericQuantity',calories:Math.round(qty*food.portionKcal),label:food.matchedName,quantity:`${qty} porz.`};
   if(qty>=10&&food.k100)
     return {segment,status:'calculated',calories:Math.round(qty*food.k100/100),label:food.matchedName,quantity:`${qty} g*`};
 }

 return {segment,status:'missingQuantity',calories:0,label:food.matchedName};
}
function calorieEstimateText(text){
 const items=calorieSegments(text).map(parseSegmentCalories);
 return {
   calories:items.reduce((s,x)=>s+x.calories,0),
   calculated:items.filter(x=>x.status==='calculated').length,
   genericQuantity:items.filter(x=>x.status==='genericQuantity').length,
   genericQuantityNoEstimate:items.filter(x=>x.status==='genericQuantityNoEstimate').length,
   missingQuantity:items.filter(x=>x.status==='missingQuantity').length,
   unknown:items.filter(x=>x.status==='unknown').length,
   total:items.length,
   items
 };
}
function calorieEstimateDay(entry){
 const results=['breakfast','snack1','lunch','snack2','dinner'].map(k=>calorieEstimateText(entry?.[k]||''));
 const r={
   calories:results.reduce((s,x)=>s+x.calories,0),
   calculated:results.reduce((s,x)=>s+x.calculated,0),
   genericQuantity:results.reduce((s,x)=>s+x.genericQuantity,0),
   genericQuantityNoEstimate:results.reduce((s,x)=>s+x.genericQuantityNoEstimate,0),
   missingQuantity:results.reduce((s,x)=>s+x.missingQuantity,0),
   unknown:results.reduce((s,x)=>s+x.unknown,0),
   total:results.reduce((s,x)=>s+x.total,0),
   items:results.flatMap(x=>x.items)
 };
 const usable=r.calculated+r.genericQuantity;
 if(!r.total||!usable){r.quality='none';r.qualityLabel='Non disponibile'}
 else if(r.unknown===0&&r.missingQuantity===0&&r.genericQuantity===0&&r.genericQuantityNoEstimate===0){r.quality='good';r.qualityLabel='Buona'}
 else{r.quality='partial';r.qualityLabel='Parziale'}
 return r;
}
function estimateDiaryCalories(entry){const r=calorieEstimateDay(entry);return (r.calculated+r.genericQuantity)?r.calories:null}
function dayEstimatedCalories(entry){return estimateDiaryCalories(entry)}
function latestDiaryCalories(p){
 const a=(p.entries||p.diary||[]).slice().sort((x,y)=>String(x.date).localeCompare(String(y.date)));
 for(let i=a.length-1;i>=0;i--){const r=calorieEstimateDay(a[i]);if(r.calculated)return {date:a[i].date,calories:r.calories,quality:r.quality,qualityLabel:r.qualityLabel}}
 return null;
}
function proSummary2(p){
 const m=latestMeasure(p),wh=m&&+m.waist&&+m.hips?+m.waist/+m.hips:null,bmrVal=bmrMifflin(p),daily=energyEstimate(p),food=latestDiaryCalories(p);
 return `<div class="section-head"><h2>Riepilogo clinico-nutrizionale</h2>${(p.id==='main'||p.id.startsWith('patient-'))?'<button class="mini" id="editPatientProfile">Modifica scheda</button>':''}</div>
 <div class="patient-summary-grid">
  <div class="summary-hero"><span>Paziente</span><b>${esc(p.name||'—')}</b><small>${p.birth?fmt(p.birth)+' · '+ageFromBirth(p.birth)+' anni':'Età non disponibile'}</small></div>
  <div><span>Diagnosi / motivo</span><b>${esc(p.diagnosis||'—')}</b></div>
  <div><span>Ultimo peso</span><b>${currentPatientWeight(p)!=null?currentPatientWeight(p).toFixed(1).replace('.',',')+' kg':'—'}</b></div>
  <div><span>BMI</span><b>${currentPatientWeight(p)&&p.height?bmi(currentPatientWeight(p),p.height).toFixed(1).replace('.',','):'—'}</b></div>
  <div><span>Obiettivo</span><b>${p.goal?p.goal+' kg':'—'}</b></div>
  <div><span>Vita / Fianchi</span><b>${m?`${m.waist||'—'} / ${m.hips||'—'} cm`:'—'}</b><small>${wh?'W/H '+wh.toFixed(2).replace('.',','):''}</small></div>
  <div><span>BMR stimato</span><b>${bmrVal?Math.round(bmrVal)+' kcal/giorno':'—'}</b><small>${bmrVal?'Metabolismo basale, senza attività':'Servono peso, altezza, nascita e sesso'}</small></div>
  <div><span>Dispendio giornaliero indicativo</span><b>${daily?Math.round(daily)+' kcal/giorno':'—'}</b><small>${daily?'BMR × livello di attività':p.activityFactor?'Completa i dati necessari al BMR':'Imposta il livello di attività'}</small></div>
  <div><span>Calorie stimate dal diario</span><b>${food?food.calories+' kcal':'—'}</b><small>${food?fmt(food.date)+' · stima '+food.qualityLabel.toLowerCase():'Nessun pasto interpretabile'}</small></div>
  <div><span>Piano alimentare</span><b>${planMetaFor(p.id)?'Disponibile':'Non caricato'}</b></div>
 </div>`;
}
function proAnamnesis(p){return `<div class="section-head"><h2>Anamnesi</h2>${(p.id==='main'||p.id.startsWith('patient-'))?'<button class="mini" id="editPatientProfile">Modifica scheda</button>':''}</div><details class="pro-accordion" open><summary>Dati e stile di vita</summary><div class="pro-read-grid"><div><span>Diagnosi / motivo</span><b>${esc(p.diagnosis||'—')}</b></div><div><span>Peso teorico</span><b>${p.theoreticalWeight?p.theoreticalWeight+' kg':'—'}</b></div><div><span>Lavoro</span><b>${esc(p.work||'—')}</b></div><div><span>Attività fisica</span><b>${esc(p.activity||'—')}</b></div><div><span>Alvo</span><b>${esc(p.bowel||'—')}</b></div><div><span>Fumo</span><b>${esc(p.smoking||'—')}</b></div><div><span>Alcol</span><b>${esc(p.alcohol||'—')}</b></div><div><span>Metabolismo basale</span><b>${esc(p.metabolism||'—')}</b></div><div><span>FEEG</span><b>${esc(p.feeg||'—')}</b></div><div><span>Impedenziometria</span><b>${esc(p.impedance||'—')}</b></div></div></details><details class="pro-accordion"><summary>Familiarità</summary><div class="pro-read-grid"><div><span>Obesità</span><b>${p.famObesity?'Sì':'No'}</b></div><div><span>Diabete</span><b>${p.famDiabetes?'Sì':'No'}</b></div><div><span>Ipertensione</span><b>${p.famHypertension?'Sì':'No'}</b></div><div><span>Cardiovascolare</span><b>${p.famCardiovascular?'Sì':'No'}</b></div><div><span>Dislipidemie</span><b>${p.famDyslipidemia?'Sì':'No'}</b></div><div><span>Tiroide</span><b>${p.famThyroid?'Sì':'No'}</b></div></div></details><details class="pro-accordion"><summary>Anamnesi patologica</summary><div class="pro-read-grid"><div><span>Diete pregresse</span><b>${esc(p.previousDiets||'—')}</b></div><div><span>Allergie</span><b>${esc(p.allergies||'—')}</b></div><div><span>Farmaci</span><b>${esc(p.medications||'—')}</b></div><div><span>Disturbi GI</span><b>${esc(p.giIssues||'—')}</b></div><div><span>Patologie / interventi</span><b>${esc(p.pastConditions||'—')}</b></div><div><span>Osservazioni</span><b>${esc(p.observations||'—')}</b></div><div><span>Obiettivi</span><b>${esc(p.objectives||'—')}</b></div></div></details>`}function proLabs(p){const r=labsFor(p.id),f=[['glucose','Glicemia'],['cholesterol','Colesterolo'],['hdl','HDL'],['ldl','LDL'],['triglycerides','Trigliceridi'],['got','GOT'],['gpt','GPT'],['uricAcid','Acido urico'],['creatinine','Creatinina'],['ggt','γGT']];return `<div class="section-head"><h2>Esami ematici</h2><button class="mini" id="newLab">＋ Aggiungi esami</button></div>${r.length?`<div class="labs-table-desktop"><table class="labs-table"><thead><tr><th>Data</th>${f.map(x=>`<th>${x[1]}</th>`).join('')}<th></th></tr></thead><tbody>${r.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<tr><td>${fmt(x.date)}</td>${f.map(y=>`<td>${esc(x[y[0]]||'—')}</td>`).join('')}<td><button class="mini" data-edit-lab="${x.id}">Modifica</button></td></tr>`).join('')}</tbody></table></div><div class="labs-cards-mobile">${r.map(x=>`<div class="lab-card"><div class="section-head"><b>${fmt(x.date)}</b><button class="mini" data-edit-lab="${x.id}">Modifica</button></div><div class="lab-values">${f.map(y=>`<div><span>${y[1]}</span><b>${esc(x[y[0]]||'—')}</b></div>`).join('')}</div></div>`).join('')}</div>`:'<p class="muted">Nessun esame registrato.</p>'}`}function proPlan(p){const m=planMetaFor(p.id);return `<div class="section-head"><h2>Piano alimentare</h2><span class="pill">${m?'Attivo':'Non caricato'}</span></div><div class="plan-pro-card">${m?`<b>${esc(m.filename)}</b><div class="plan-actions"><button class="secondary" id="openProPlan">Apri PDF</button><button class="mini" id="replacePlan">Sostituisci</button><button class="mini danger-text" id="deletePlan">Elimina</button></div>`:`<p class="muted">Il professionista carica il PDF; il paziente può solo consultarlo.</p><button class="primary" id="uploadPlan">Carica PDF dieta</button>`}<input id="planFile" type="file" accept=".pdf,application/pdf" style="display:none"><label>Data piano</label>${proDateControl('planDate',m?.planDate||today())}</div>`}

function proAccount(p){const a=accountFor(p.id);return `<div class="section-head"><h2>Account paziente</h2><span class="pill">${a?'Attivo':'Non attivo'}</span></div><p class="muted">Credenziali demo locali. Dopo averle salvate, vai in Area Paziente e premi <b>Esci</b>: comparirà la schermata login dove puoi provare username e password.</p><label>Username</label><input id="accUser" value="${esc(a?.username||'')}"><label>Password demo</label><input id="accPass" value="${esc(a?.password||'')}"><div class="pro3-actions"><button class="primary" id="savePatientAccount">${a?'Aggiorna account':'Crea account'}</button>${a?'<button class="secondary" id="deletePatientAccount">Disattiva account</button>':''}</div>`}
function privacyPdfBlob(p){const lines=['INFORMATIVA E CONSENSO - DEMO','',`Paziente: ${p.name||''}`,`Data di nascita: ${p.birth?fmt(p.birth):''}`,`Diagnosi/motivo: ${p.diagnosis||''}`,'','Modulo dimostrativo precompilato con i dati della scheda.','Il testo privacy definitivo dovra essere validato per il prodotto reale.','','Firma paziente: ______________________________','Data: __________________'];const ep=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,' ').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');let st='BT /F1 11 Tf 50 800 Td '+lines.map((l,i)=>`${i?'0 -24 Td ':''}(${ep(l)}) Tj`).join('\n')+' ET\n',o=['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];const add=x=>(o.push(x),o.length),pages=add('P'),content=add(`<< /Length ${st.length} >>\nstream\n${st}endstream`),page=add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 1 0 R >> >> /Contents ${content} 0 R >>`);o[pages-1]=`<< /Type /Pages /Count 1 /Kids [${page} 0 R] >>`;const cat=add(`<< /Type /Catalog /Pages ${pages} 0 R >>`);let pdf='%PDF-1.4\n',off=[0];o.forEach((x,i)=>{off[i+1]=pdf.length;pdf+=`${i+1} 0 obj\n${x}\nendobj\n`});const xr=pdf.length;pdf+=`xref\n0 ${o.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=o.length;i++)pdf+=String(off[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${o.length+1} /Root ${cat} 0 R >>\nstartxref\n${xr}\n%%EOF`;return new Blob([pdf],{type:'application/pdf'})}
async function storePrivacyPdf(id,b){const db=await openPlanDb();return new Promise((res,rej)=>{const tx=db.transaction('privacy','readwrite');tx.objectStore('privacy').put(b,id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function readPrivacyPdf(id){const db=await openPlanDb();return new Promise((res,rej)=>{const r=db.transaction('privacy','readonly').objectStore('privacy').get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
function proPrivacy(p){const m=privacyMetaFor(p.id);return `<div class="section-head"><h2>Privacy</h2><span class="pill">${m?'PDF firmato presente':'Da completare'}</span></div><div class="pro-read-grid"><div><span>Paziente</span><b>${esc(p.name||'—')}</b></div><div><span>Data di nascita</span><b>${p.birth?fmt(p.birth):'—'}</b></div><div><span>Diagnosi / motivo</span><b>${esc(p.diagnosis||'—')}</b></div></div><p class="muted">Modulo demo precompilato. Il testo legale definitivo dovrà essere validato.</p><div class="pro3-actions"><button class="secondary" id="downloadPrivacyForm">↓ Scarica modulo PDF</button><button class="secondary" id="uploadSignedPrivacy">↑ Carica PDF firmato</button>${m?'<button class="secondary" id="openSignedPrivacy">Apri firmato</button>':''}</div><input id="signedPrivacyFile" type="file" accept="application/pdf,.pdf" style="display:none">`}

async function readLabUploadPdf(key){const db=await openPlanDb();return new Promise((res,rej)=>{const r=db.transaction('labUploads','readonly').objectStore('labUploads').get(key);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
async function deleteLabUploadPdf(key){const db=await openPlanDb();return new Promise((res,rej)=>{const tx=db.transaction('labUploads','readwrite');tx.objectStore('labUploads').delete(key);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
function labReview(){const item=pendingLabs()[window.reviewLabKey];if(!item)return `${top('Referto non trovato')}`;const p=patient(item.patientId);selected=item.patientId;const f=(id,l)=>`<label>${l}<input id="rev${id}" value="${esc(item.values?.[id]||'')}"></label>`;return `${top('Verifica analisi')}<section class="card"><div class="section-head"><h2>${esc(p?.name||'Paziente')}</h2><span class="pill">Da verificare</span></div><p class="muted">${esc(item.filename||'')} · ${esc(item.note||'Controlla i valori estratti.')}</p><div class="form-grid"><label>Data${proDateControl('revDate',item.values?.date||today())}</label>${f('glucose','Glicemia')}${f('cholesterol','Colesterolo')}${f('hdl','HDL')}${f('ldl','LDL')}${f('triglycerides','Trigliceridi')}${f('got','GOT')}${f('gpt','GPT')}${f('uricAcid','Acido urico')}${f('creatinine','Creatinina')}${f('ggt','γGT')}</div><div class="pro3-actions lab-review-actions"><button class="secondary" id="openLabReviewPdf">Apri PDF</button><button class="danger-soft" id="deleteLabReview">Elimina</button><button class="secondary" id="cancelLabReview">Annulla</button><button class="primary" id="confirmLabReview">Conferma e inserisci</button></div></section>`}

function tabContent(p){
 if(tab==='summary')return proSummary2(p);
 if(tab==='anamnesis')return proAnamnesis(p);
 if(tab==='labs')return proLabs(p);
 if(tab==='plan')return proPlan(p);
 if(tab==='privacy')return proPrivacy(p);
 if(tab==='account')return proAccount(p);
 if(tab==='diary')return proDiaryHistory(p);
 if(tab==='trend')return proTrendContent(p);
 if(tab==='measures')return `<div class="section-head"><h2>Misure</h2><button class="mini" id="newPatientMeasure">＋ Aggiungi misura</button></div>
 <div class="measure-table-wrap"><table class="measure-table"><thead><tr><th>Data</th><th>Vita</th><th>Fianchi</th><th>Note</th><th></th></tr></thead><tbody>
 ${(p.measures||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(m=>`<tr>
   <td>${fmt(m.date)}</td><td>${m.waist!==''&&m.waist!=null?m.waist:'—'}</td><td>${m.hips!==''&&m.hips!=null?m.hips:'—'}</td><td>${esc(m.notes||'')}</td>
   <td><button class="mini" data-edit-measure="${m.date}">Modifica</button></td>
 </tr>`).join('')||'<tr><td colspan="5">Nessuna misura.</td></tr>'}
 </tbody></table></div>`;
 if(tab==='visits')return appointments().filter(a=>a.patientId===p.id&&a.type!=='personal').sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).map(a=>`<button class="pro3-event ${typeClass(a.type)} pro3-event-clickable" data-edit-visit="${a.id}"><b>${fmt(a.date)} · ${a.time}</b><span>${typeLabel(a.type)} · ${a.duration} min</span></button>`).join('')||'<p class="muted">Nessuna visita.</p>';
 const notes=load(NOTES_KEY,{});
 return `<textarea id="noteText" rows="7" placeholder="Note professionista">${esc(notes[p.id]||'')}</textarea><button class="primary" id="saveNote">Salva nota</button>`;
}



function newPatientForm(){
 return `${top('Nuovo paziente')}
 <section class="card">
   <h2>Dati personali</h2>
   <label>Nome</label>
   <input id="npName" type="text" placeholder="es. Mario">

   <label>Cognome</label>
   <input id="npSurname" type="text" placeholder="es. Rossi">

   <label>Data di nascita</label>
   ${proDateControl('npBirth','')}

   <label>Sesso</label>
   <select id="npSex">
     <option value="">Non specificato</option>
     <option value="M">Maschile</option>
     <option value="F">Femminile</option>
     <option value="X">Altro / preferisco non specificare</option>
   </select>

   <label>Altezza (cm)</label>
   <input id="npHeight" type="number" min="80" max="250" step="1" placeholder="es. 175">

   <label>Peso obiettivo (kg)</label>
   <input id="npGoal" type="number" min="30" max="300" step="0.1" placeholder="Facoltativo">

   <label>Data prossima visita</label>
   ${proDateControl('npNextVisit','')}

   <h2 style="margin-top:22px">Storia del peso</h2>
   <label>Peso minimo storico (kg)</label>
   <input id="npMinWeight" type="number" min="30" max="300" step="0.1" placeholder="Facoltativo">

   <label>Peso massimo storico (kg)</label>
   <input id="npMaxWeight" type="number" min="30" max="300" step="0.1" placeholder="Facoltativo">

   <label>Peso ragionevole / concordato (kg)</label>
   <input id="npReasonableWeight" type="number" min="30" max="300" step="0.1" placeholder="Facoltativo">

   <h2 style="margin-top:22px">Stile di vita</h2>
   <label>Attività lavorativa</label>
   <textarea id="npWork" rows="2" placeholder="Campo libero"></textarea>

   <label>Attività fisica abituale</label>
   <textarea id="npActivity" rows="2" placeholder="es. camminate, palestra, sport"></textarea>
   <label>Livello attività per stima energetica</label><select id="npActivityFactor"><option value="">Non impostato</option><option value="1.2">Sedentario</option><option value="1.375">Leggermente attivo</option><option value="1.55">Moderatamente attivo</option><option value="1.725">Molto attivo</option><option value="1.9">Estremamente attivo</option></select>

   <label>Fumo</label>
   <input id="npSmoking" type="text" placeholder="Campo libero">

   <label>Alcol</label>
   <input id="npAlcohol" type="text" placeholder="Campo libero">

<details class="pro-accordion"><summary>Dati clinici aggiuntivi</summary><label>Diagnosi / motivo</label><textarea id="npDiagnosis"></textarea><label>Peso teorico (kg)</label><input id="npTheoreticalWeight" type="number" step="0.1"><label>Alvo</label><input id="npBowel"><label>Metabolismo basale</label><input id="npMetabolism"><label>FEEG / fabbisogno</label><input id="npFeeg"><label>Impedenziometria</label><input id="npImpedance"></details><details class="pro-accordion"><summary>Familiarità</summary><div class="check-grid"><label><input id="npFamObesity" type="checkbox"> Obesità</label><label><input id="npFamDiabetes" type="checkbox"> Diabete</label><label><input id="npFamHypertension" type="checkbox"> Ipertensione</label><label><input id="npFamCardiovascular" type="checkbox"> Cardiovascolare</label><label><input id="npFamDyslipidemia" type="checkbox"> Dislipidemie</label><label><input id="npFamThyroid" type="checkbox"> Tiroide</label></div></details><details class="pro-accordion"><summary>Anamnesi patologica e obiettivi</summary><label>Diete pregresse</label><textarea id="npPreviousDiets"></textarea><label>Allergie / intolleranze</label><textarea id="npAllergies"></textarea><label>Farmaci</label><textarea id="npMedications"></textarea><label>Disturbi gastrointestinali</label><textarea id="npGiIssues"></textarea><label>Patologie / interventi pregressi</label><textarea id="npPastConditions"></textarea><label>Osservazioni</label><textarea id="npObservations"></textarea><label>Obiettivi</label><textarea id="npObjectives"></textarea></details>   <div class="pro3-actions">
     <button class="secondary" id="cancelNewPatient">Annulla</button>
     <button class="primary" id="saveNewPatient">Salva paziente</button>
   </div>
 </section>`;
}

function saveNewPatient(){
 const name=(el('npName')?.value||'').trim();
 const surname=(el('npSurname')?.value||'').trim();
 if(!name || !surname)return alert('Inserisci nome e cognome.');

 const num=id=>{
   const v=(el(id)?.value||'').trim().replace(',','.');
   return v===''?'':Number(v);
 };

 const height=num('npHeight');
 const goal=num('npGoal');
 const minWeight=num('npMinWeight');
 const maxWeight=num('npMaxWeight');
 const reasonableWeight=num('npReasonableWeight');

 if(height!=='' && (!Number.isFinite(height) || height<80 || height>250))return alert('Controlla l’altezza inserita.');
 for(const v of [goal,minWeight,maxWeight,reasonableWeight]){
   if(v!=='' && (!Number.isFinite(v) || v<30 || v>300))return alert('Controlla i valori di peso inseriti.');
 }

 const arr=extraPatients();
 const id='patient-'+Date.now();
 arr.push({
   id,
   name:`${name} ${surname}`,
   firstName:name,
   surname,
   birth:readProDate('npBirth')||'',
   sex:el('npSex')?.value||'',
   height,
   goal,
   nextVisit:readProDate('npNextVisit')||'',
   minWeight,
   maxWeight,
   reasonableWeight,
   work:(el('npWork')?.value||'').trim(),
   activity:(el('npActivity')?.value||'').trim(),activityFactor:el('npActivityFactor')?.value||'',
   smoking:(el('npSmoking')?.value||'').trim(),
   alcohol:(el('npAlcohol')?.value||'').trim(), diagnosis:(el('npDiagnosis')?.value||'').trim(), theoreticalWeight:num('npTheoreticalWeight'), bowel:(el('npBowel')?.value||'').trim(), metabolism:(el('npMetabolism')?.value||'').trim(), feeg:(el('npFeeg')?.value||'').trim(), impedance:(el('npImpedance')?.value||'').trim(), famObesity:!!el('npFamObesity')?.checked, famDiabetes:!!el('npFamDiabetes')?.checked, famHypertension:!!el('npFamHypertension')?.checked, famCardiovascular:!!el('npFamCardiovascular')?.checked, famDyslipidemia:!!el('npFamDyslipidemia')?.checked, famThyroid:!!el('npFamThyroid')?.checked, previousDiets:(el('npPreviousDiets')?.value||'').trim(), allergies:(el('npAllergies')?.value||'').trim(), medications:(el('npMedications')?.value||'').trim(), giIssues:(el('npGiIssues')?.value||'').trim(), pastConditions:(el('npPastConditions')?.value||'').trim(), observations:(el('npObservations')?.value||'').trim(), objectives:(el('npObjectives')?.value||'').trim(),
   weights:[],
   diary:[],
   measures:[]
 });
 saveExtraPatients(arr);

 selected=id;
 tab='summary';
 view='details';
 render();
}



function editPatientProfileForm(){
 const p=patient(selected);
 if(!p)return `${top('Paziente non trovato')}`;

 let first=p.firstName||'', surname=p.surname||'';
 if(!first && p.name){
   const parts=String(p.name).trim().split(/\s+/);
   first=parts.shift()||'';
   if(!surname)surname=parts.join(' ');
 }

 return `${top('Modifica profilo paziente')}
 <section class="card">
   <h2>Dati personali</h2>
   <label>Nome</label><input id="epName" value="${esc(first)}">
   <label>Cognome</label><input id="epSurname" value="${esc(surname)}">
   <label>Data di nascita</label>${proDateControl('epBirth',p.birth||'')}
   <label>Sesso</label>
   <select id="epSex">
     <option value="" ${!p.sex?'selected':''}>Non specificato</option>
     <option value="M" ${p.sex==='M'?'selected':''}>Maschile</option>
     <option value="F" ${p.sex==='F'?'selected':''}>Femminile</option>
     <option value="X" ${p.sex==='X'?'selected':''}>Altro / preferisco non specificare</option>
   </select>
   <label>Altezza (cm)</label><input id="epHeight" type="number" min="80" max="250" step="1" value="${p.height||''}">
   <label>Peso obiettivo (kg)</label><input id="epGoal" type="number" min="30" max="300" step="0.1" value="${p.goal||''}">
   <label>Data prossima visita</label>${proDateControl('epNextVisit',p.nextVisit||'')}

   <h2 style="margin-top:22px">Storia del peso</h2>
   <label>Peso minimo storico (kg)</label><input id="epMinWeight" type="number" min="30" max="300" step="0.1" value="${p.minWeight||''}">
   <label>Peso massimo storico (kg)</label><input id="epMaxWeight" type="number" min="30" max="300" step="0.1" value="${p.maxWeight||''}">
   <label>Peso ragionevole / concordato (kg)</label><input id="epReasonableWeight" type="number" min="30" max="300" step="0.1" value="${p.reasonableWeight||''}">

   <h2 style="margin-top:22px">Stile di vita</h2>
   <label>Attività lavorativa</label><textarea id="epWork" rows="2">${esc(p.work||'')}</textarea>
   <label>Attività fisica abituale</label><textarea id="epActivity" rows="2">${esc(p.activity||'')}</textarea><label>Livello attività per stima energetica</label><select id="epActivityFactor"><option value="">Non impostato</option><option value="1.2" ${String(p.activityFactor)==='1.2'?'selected':''}>Sedentario</option><option value="1.375" ${String(p.activityFactor)==='1.375'?'selected':''}>Leggermente attivo</option><option value="1.55" ${String(p.activityFactor)==='1.55'?'selected':''}>Moderatamente attivo</option><option value="1.725" ${String(p.activityFactor)==='1.725'?'selected':''}>Molto attivo</option><option value="1.9" ${String(p.activityFactor)==='1.9'?'selected':''}>Estremamente attivo</option></select>
   <label>Fumo</label><input id="epSmoking" value="${esc(p.smoking||'')}">
   <label>Alcol</label><input id="epAlcohol" value="${esc(p.alcohol||'')}">

<details class="pro-accordion"><summary>Dati clinici aggiuntivi</summary><label>Diagnosi / motivo</label><textarea id="epDiagnosis"></textarea><label>Peso teorico (kg)</label><input id="epTheoreticalWeight" type="number" step="0.1"><label>Alvo</label><input id="epBowel"><label>Metabolismo basale</label><input id="epMetabolism"><label>FEEG / fabbisogno</label><input id="epFeeg"><label>Impedenziometria</label><input id="epImpedance"></details><details class="pro-accordion"><summary>Familiarità</summary><div class="check-grid"><label><input id="epFamObesity" type="checkbox"> Obesità</label><label><input id="epFamDiabetes" type="checkbox"> Diabete</label><label><input id="epFamHypertension" type="checkbox"> Ipertensione</label><label><input id="epFamCardiovascular" type="checkbox"> Cardiovascolare</label><label><input id="epFamDyslipidemia" type="checkbox"> Dislipidemie</label><label><input id="epFamThyroid" type="checkbox"> Tiroide</label></div></details><details class="pro-accordion"><summary>Anamnesi patologica e obiettivi</summary><label>Diete pregresse</label><textarea id="epPreviousDiets"></textarea><label>Allergie / intolleranze</label><textarea id="epAllergies"></textarea><label>Farmaci</label><textarea id="epMedications"></textarea><label>Disturbi gastrointestinali</label><textarea id="epGiIssues"></textarea><label>Patologie / interventi pregressi</label><textarea id="epPastConditions"></textarea><label>Osservazioni</label><textarea id="epObservations"></textarea><label>Obiettivi</label><textarea id="epObjectives"></textarea></details>   <div class="pro3-actions">
     <button class="secondary" id="cancelEditProfile">Annulla</button>
     <button class="primary" id="saveEditProfile">Salva modifiche</button>
   </div>
 </section>`;
}

function saveEditedPatientProfile(){
 const p=patient(selected);
 if(!p)return;

 const first=(el('epName')?.value||'').trim();
 const surname=(el('epSurname')?.value||'').trim();
 if(!first || !surname)return alert('Inserisci nome e cognome.');

 const num=id=>{
   const v=(el(id)?.value||'').trim().replace(',','.');
   return v===''?'':Number(v);
 };

 const height=num('epHeight');
 const goal=num('epGoal');
 const minWeight=num('epMinWeight');
 const maxWeight=num('epMaxWeight');
 const reasonableWeight=num('epReasonableWeight');

 if(height!=='' && (!Number.isFinite(height) || height<80 || height>250))return alert('Controlla l’altezza inserita.');
 for(const v of [goal,minWeight,maxWeight,reasonableWeight]){
   if(v!=='' && (!Number.isFinite(v) || v<30 || v>300))return alert('Controlla i valori di peso inseriti.');
 }

 const patch={
   name:first,
   surname,
   birth:readProDate('epBirth')||'',
   sex:el('epSex')?.value||'',
   height,
   goal,
   nextVisit:readProDate('epNextVisit')||'',
   minWeight,
   maxWeight,
   reasonableWeight,
   work:(el('epWork')?.value||'').trim(),
   activity:(el('epActivity')?.value||'').trim(),activityFactor:el('epActivityFactor')?.value||'',
   smoking:(el('epSmoking')?.value||'').trim(),
   alcohol:(el('epAlcohol')?.value||'').trim(), diagnosis:(el('epDiagnosis')?.value||'').trim(), theoreticalWeight:num('epTheoreticalWeight'), bowel:(el('epBowel')?.value||'').trim(), metabolism:(el('epMetabolism')?.value||'').trim(), feeg:(el('epFeeg')?.value||'').trim(), impedance:(el('epImpedance')?.value||'').trim(), famObesity:!!el('epFamObesity')?.checked, famDiabetes:!!el('epFamDiabetes')?.checked, famHypertension:!!el('epFamHypertension')?.checked, famCardiovascular:!!el('epFamCardiovascular')?.checked, famDyslipidemia:!!el('epFamDyslipidemia')?.checked, famThyroid:!!el('epFamThyroid')?.checked, previousDiets:(el('epPreviousDiets')?.value||'').trim(), allergies:(el('epAllergies')?.value||'').trim(), medications:(el('epMedications')?.value||'').trim(), giIssues:(el('epGiIssues')?.value||'').trim(), pastConditions:(el('epPastConditions')?.value||'').trim(), observations:(el('epObservations')?.value||'').trim(), objectives:(el('epObjectives')?.value||'').trim()
 };

 if(selected==='main'){
   const current=load(PROFILE_KEY,{});
   save(PROFILE_KEY,{...current,...patch});
 }else{
   const arr=extraPatients();
   const i=arr.findIndex(x=>x.id===selected);
   if(i<0)return alert('Questo paziente demo non è modificabile.');
   arr[i]={...arr[i],...patch,firstName:first,name:`${first} ${surname}`};
   saveExtraPatients(arr);
 }

 tab='summary';
 view='details';
 render();
}


function labForm(){const p=patient(selected),r=labsFor(p.id),x=window.editLabId?r.find(y=>y.id===window.editLabId):null,f=(id,l)=>`<label>${l}<input id="lab${id}" value="${esc(x?.[id]||'')}"></label>`;return `${top(x?'Modifica esami':'Nuovi esami')}<section class="card"><div class="form-grid"><label>Data${proDateControl('labDate',x?.date||today())}</label>${f('glucose','Glicemia')}${f('cholesterol','Colesterolo')}${f('hdl','HDL')}${f('ldl','LDL')}${f('triglycerides','Trigliceridi')}${f('got','GOT')}${f('gpt','GPT')}${f('uricAcid','Acido urico')}${f('creatinine','Creatinina')}${f('ggt','γGT')}</div><div class="pro3-actions">${x?'<button class="mini danger-text" id="deleteLab">Elimina</button>':''}<button class="secondary" id="cancelLab">Annulla</button><button class="primary" id="saveLab">Salva</button></div></section>`}function saveLab(){const p=patient(selected),o={id:window.editLabId||'lab-'+Date.now(),date:readProDate('labDate')||today()};['glucose','cholesterol','hdl','ldl','triglycerides','got','gpt','uricAcid','creatinine','ggt'].forEach(k=>o[k]=(el('lab'+k)?.value||'').trim());let r=labsFor(p.id),i=r.findIndex(x=>x.id===o.id);if(i>=0)r[i]=o;else r.push(o);saveLabsFor(p.id,r);window.editLabId='';tab='labs';view='details';render()}function deleteLab(){const p=patient(selected);if(!confirm('Eliminare questi esami?'))return;saveLabsFor(p.id,labsFor(p.id).filter(x=>x.id!==window.editLabId));window.editLabId='';tab='labs';view='details';render()}
function patientMeasureForm(){
 const p=patient(selected);
 if(!p)return `${top('Paziente non trovato')}`;
 const existing=window.editMeasureDate?(p.measures||[]).find(x=>x.date===window.editMeasureDate):null;
 return `${top(existing?'Modifica misurazione':'Nuova misurazione')}
 <section class="card">
   <label>Data</label>${proDateControl('pmDate',existing?.date||today())}
   <label>Circonferenza vita (cm)</label><input id="pmWaist" type="number" min="20" max="300" step="0.1" value="${existing?.waist??''}">
   <label>Circonferenza fianchi (cm)</label><input id="pmHips" type="number" min="20" max="300" step="0.1" value="${existing?.hips??''}">
   <label>Note</label><textarea id="pmNotes" rows="3">${esc(existing?.notes||'')}</textarea>
   <div class="pro3-actions"><button class="secondary" id="cancelPatientMeasure">Annulla</button><button class="primary" id="savePatientMeasure">${existing?'Salva modifiche':'Salva misura'}</button></div>
 </section>`;
}
function savePatientMeasure(){
 const p=patient(selected); if(!p)return;
 const date=readProDate('pmDate',true); if(!date)return;
 const num=id=>{const v=(el(id)?.value||'').trim().replace(',','.');return v===''?'':Number(v)};
 const waist=num('pmWaist'),hips=num('pmHips');
 for(const [label,v] of [['vita',waist],['fianchi',hips]])if(v!==''&&(!Number.isFinite(v)||v<20||v>300))return alert(`Controlla il valore ${label}.`);
 const obj={date,waist,hips,notes:(el('pmNotes')?.value||'').trim()};
 const oldDate=window.editMeasureDate;

 if(selected==='main'){
   let arr=load(MEASURE_KEY,[]);
   if(oldDate&&oldDate!==date)arr=arr.filter(x=>x.date!==oldDate);
   const i=arr.findIndex(x=>x.date===date); if(i>=0)arr[i]=obj; else arr.push(obj);
   save(MEASURE_KEY,arr);
 }else{
   const extra=extraPatients(),ei=extra.findIndex(x=>x.id===selected);
   if(ei>=0){
     let ms=Array.isArray(extra[ei].measures)?extra[ei].measures:[];
     if(oldDate&&oldDate!==date)ms=ms.filter(x=>x.date!==oldDate);
     const i=ms.findIndex(x=>x.date===date); if(i>=0)ms[i]=obj; else ms.push(obj);
     extra[ei]={...extra[ei],measures:ms}; saveExtraPatients(extra);
   }else{
     const ov=load(DEMO_MEASURES_KEY,{});
     let ms=Array.isArray(ov[selected])?ov[selected]:((p.measures||[]).map(x=>({...x})));
     if(oldDate&&oldDate!==date)ms=ms.filter(x=>x.date!==oldDate);
     const i=ms.findIndex(x=>x.date===date); if(i>=0)ms[i]=obj; else ms.push(obj);
     ov[selected]=ms; save(DEMO_MEASURES_KEY,ov);
   }
 }
 window.editMeasureDate=null; tab='measures'; view='details'; render();
}


function deleteSelectedPatient(){
 const p=patient(selected);
 if(!p || p.id==='main')return;
 if(!confirm(`Vuoi eliminare il paziente ${p.name}?`))return;

 // Remove manually-created patient if present.
 const extras=extraPatients();
 const remaining=extras.filter(x=>x.id!==p.id);
 if(remaining.length!==extras.length)saveExtraPatients(remaining);

 // Mark as deleted so built-in demo patients can also disappear persistently.
 const deleted=new Set(load(DELETED_PATIENTS_KEY,[]));
 deleted.add(p.id);
 save(DELETED_PATIENTS_KEY,[...deleted]);

 // Remove linked demo-local information.
 save(APPT_KEY,appointments().filter(a=>a.patientId!==p.id));

 const notes=load(NOTES_KEY,{});
 if(Object.prototype.hasOwnProperty.call(notes,p.id)){
   delete notes[p.id];
   save(NOTES_KEY,notes);
 }

 const demoMeasures=load(DEMO_MEASURES_KEY,{});
 if(Object.prototype.hasOwnProperty.call(demoMeasures,p.id)){
   delete demoMeasures[p.id];
   save(DEMO_MEASURES_KEY,demoMeasures);
 }

 selected='main';
 tab='summary';
 view='patients';
 render();
}

function agenda(){
 if(!(weekDate instanceof Date) || Number.isNaN(weekDate.getTime())){
   weekDate=new Date(today()+'T12:00:00');
 }
 const monday=getMonday(weekDate),s=settings(),dayCount=Number(s.workDays)===6?6:5,days=Array.from({length:dayCount},(_,i)=>addDays(monday,i));
 const start=timeMin(s.dayStart),end=timeMin(s.dayEnd),step=30,slots=[];
 for(let m=start;m<end;m+=step)slots.push(m);

 const evs=appointments().filter(a=>days.some(d=>iso(d)===a.date));
 let grid=`<div class="pro3-calendar" style="grid-template-columns:55px repeat(${days.length},minmax(135px,1fr));grid-template-rows:42px repeat(${slots.length},32px)">`;
 grid+=`<div></div>`;
 days.forEach((d,i)=>grid+=`<div class="pro3-dayhead" style="grid-column:${i+2};grid-row:1"><b>${d.toLocaleDateString('it-IT',{weekday:'short'})}</b><span>${d.getDate()}</span></div>`);
 slots.forEach((m,i)=>grid+=`<div class="pro3-time" style="grid-column:1;grid-row:${i+2}">${minTime(m)}</div>`);
 days.forEach((d,di)=>slots.forEach((m,si)=>grid+=`<button class="pro3-slot" data-date="${iso(d)}" data-time="${minTime(m)}" style="grid-column:${di+2};grid-row:${si+2}"></button>`));
 evs.forEach(a=>{
   const di=days.findIndex(d=>iso(d)===a.date),si=Math.max(0,Math.round((timeMin(a.time)-start)/step)),span=Math.max(1,Math.ceil(a.duration/step));
   const p=a.patientId?patient(a.patientId):null;
   grid+=`<button class="pro3-cal-event ${typeClass(a.type)}" data-event="${a.id}" style="grid-column:${di+2};grid-row:${si+2}/span ${span}"><b>${a.time}</b><span>${a.type==='personal'?esc(a.title||'Impegno personale'):esc(p?.name||'Paziente')}</span></button>`;
 });
 grid+='</div>';
 return `${top('Agenda')}${nav()}
 <section class="card pro3-agenda-tools"><button class="mini" id="prevWeek">‹</button><button class="mini" id="todayWeek">Oggi</button><button class="mini" id="nextWeek">›</button><span>${fmt(iso(days[0]))} — ${fmt(iso(days[days.length-1]))}</span><button class="primary" id="newEvent">＋ Nuovo evento</button></section>
 <section class="card"><div class="pro3-legend"><span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#fff4bf;border-left:4px solid #e4b93f;margin-right:5px;vertical-align:-2px"></i>Prima visita</span><span>🟩 Controllo</span><span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#eceff1;border-left:4px solid #8b969c;margin-right:5px;vertical-align:-2px"></i>Impegno personale</span></div></section>
 <section class="card pro3-calendar-wrap">${grid}</section>`;
}


function proBackupData(){
 return {
   app:'Diario Pro Demo',
   version:1,
   exportedAt:new Date().toISOString(),
   data:{
     mainProfile:load(PROFILE_KEY,{}),
     mainEntries:load(KEY,[]),
     mainMeasures:load(MEASURE_KEY,[]),
     extraPatients:load(EXTRA_PATIENTS_KEY,[]),
     demoMeasures:load(DEMO_MEASURES_KEY,{}),
     deletedPatients:load(DELETED_PATIENTS_KEY,[]),
     labs:load(LABS_KEY,{}),
     notes:load(NOTES_KEY,{}),
     appointments:load(APPT_KEY,[]),
     settings:load(SETTINGS_KEY,{}),accounts:load(ACCOUNT_KEY,{}),privacyMeta:load(PRIVACY_META_KEY,{}),pendingLabs:load(PENDING_LABS_KEY,{})
   }
 };
}
function downloadProBackup(){
 const payload=proBackupData();
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`diario-pro-backup-${today()}.json`;
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function validateProBackup(obj){
 return obj&&obj.app==='Diario Pro Demo'&&obj.data&&typeof obj.data==='object';
}
async function importProBackupFile(file){
 let obj;
 try{obj=JSON.parse(await file.text())}catch(e){return alert('Il file selezionato non è un JSON valido.')}
 if(!validateProBackup(obj))return alert('Il file non è un backup valido di Diario Pro Demo.');
 if(!confirm('Caricare questo backup? I dati locali dei pazienti della demo verranno sostituiti.'))return;
 const d=obj.data;
 save(PROFILE_KEY,d.mainProfile||{});
 save(KEY,Array.isArray(d.mainEntries)?d.mainEntries:[]);
 save(MEASURE_KEY,Array.isArray(d.mainMeasures)?d.mainMeasures:[]);
 save(EXTRA_PATIENTS_KEY,Array.isArray(d.extraPatients)?d.extraPatients:[]);
 save(DEMO_MEASURES_KEY,d.demoMeasures&&typeof d.demoMeasures==='object'?d.demoMeasures:{});
 save(DELETED_PATIENTS_KEY,Array.isArray(d.deletedPatients)?d.deletedPatients:[]);
 save(LABS_KEY,d.labs&&typeof d.labs==='object'?d.labs:{});
 save(NOTES_KEY,d.notes&&typeof d.notes==='object'?d.notes:{});
 save(APPT_KEY,Array.isArray(d.appointments)?d.appointments:[]);
 save(SETTINGS_KEY,d.settings&&typeof d.settings==='object'?d.settings:{});save(ACCOUNT_KEY,d.accounts&&typeof d.accounts==='object'?d.accounts:{});save(PRIVACY_META_KEY,d.privacyMeta&&typeof d.privacyMeta==='object'?d.privacyMeta:{});save(PENDING_LABS_KEY,d.pendingLabs&&typeof d.pendingLabs==='object'?d.pendingLabs:{});
 selected='main';tab='summary';view='dashboard';
 alert('Backup caricato correttamente.');
 render();
}

function settingsPage(){
 const s=settings();
 return `${top('Profilo professionista')}${nav()}<section class="card">
 <label>Nome professionista</label><input id="sName" value="${esc(s.name)}">
 <label>Durata predefinita prima visita</label><input id="sFirst" type="number" step="5" value="${s.first}">
 <label>Durata predefinita controllo</label><input id="sControl" type="number" step="5" value="${s.control}">
 <label>Inizio agenda</label><input id="sStart" type="time" value="${s.dayStart}">
 <label>Fine agenda</label><input id="sEnd" type="time" value="${s.dayEnd}">
 <label>Settimana lavorativa</label>
 <select id="sWorkDays">
   <option value="5" ${Number(s.workDays)===5?'selected':''}>Da lunedì a venerdì</option>
   <option value="6" ${Number(s.workDays)===6?'selected':''}>Da lunedì a sabato</option>
 </select>
 <p class="muted">L'Agenda mostrerà solo i giorni lavorativi selezionati.</p>
 <button class="primary" id="saveSettings">Salva impostazioni</button></section>
 <section class="card"><div class="section-head"><h2>Backup pazienti</h2><span class="pill">JSON</span></div>
 <p class="muted">Scarica una copia dei dati locali della demo oppure ripristina un backup precedente. I PDF dei piani alimentari non sono inclusi.</p>
 <div class="pro3-actions"><button class="secondary" id="downloadProBackup">↓ Scarica backup</button><button class="secondary" id="uploadProBackup">↑ Carica backup</button></div>
 <input id="proBackupFile" type="file" accept="application/json,.json" style="display:none">
 </section>`;
}

function eventForm(prefill){
 const s=settings();
 const a=editing||{type:'control',patientId:'main',date:prefill?.date||today(),time:prefill?.time||'09:00',duration:s.control,title:'Impegno personale',note:''};
 return `${top(editing?'Modifica evento':'Nuovo evento')}<section class="card">
 <label>Tipo evento</label><select id="eType"><option value="first" ${a.type==='first'?'selected':''}>Prima visita</option><option value="control" ${a.type==='control'?'selected':''}>Controllo</option><option value="personal" ${a.type==='personal'?'selected':''}>Impegno personale</option></select>
 <div id="patientBox" style="${a.type==='personal'?'display:none':''}"><label>Paziente</label><select id="ePatient">${patients().map(p=>`<option value="${p.id}" ${p.id===a.patientId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div>
 <div id="titleBox" style="${a.type==='personal'?'':'display:none'}"><label>Titolo</label><input id="eTitle" value="${esc(a.title||'Impegno personale')}"></div>
 <label>Data</label>${proDateControl('eDate',a.date)}
 <label>Ora</label><input id="eTime" type="time" value="${a.time}">
 <label>Durata</label><input id="eDuration" type="number" step="5" value="${a.duration}">
 <label>Note</label><textarea id="eNote" rows="3">${esc(a.note||'')}</textarea>
 <div class="pro3-actions">${editing?'<button class="secondary" id="deleteEvent">Elimina appuntamento</button>':''}<button class="secondary" id="cancelEvent">Annulla</button><button class="primary" id="saveEvent">${editing?'Salva modifiche':'Salva'}</button></div>
 </section>`;
}

function conflict(obj){
 const s=timeMin(obj.time),e=s+Number(obj.duration);
 return appointments().find(a=>{
  if(a.id===obj.id||a.date!==obj.date)return false;
  const as=timeMin(a.time),ae=as+Number(a.duration);
  return s<ae&&e>as;
 });
}

function render(){
 try{
  let html=view==='dashboard'?dashboard():view==='patients'?patientsPage():view==='agenda'?agenda():view==='settings'?settingsPage():view==='details'?details():view==='newPatient'?newPatientForm():view==='editProfile'?editPatientProfileForm():view==='patientMeasure'?patientMeasureForm():view==='labForm'?labForm():view==='labReview'?labReview():view==='diaryDay'?proDiaryDayView():eventForm(window.prefill||null);
  el('proApp').innerHTML=html; bind();
 }catch(err){
  console.error(err);
  el('proApp').innerHTML=`<section class="card"><h1>Errore Area Professionista</h1><p>${esc(err.message||err)}</p><a href="./index.html">Torna alla scelta area</a></section>`;
 }
}

function bind(){
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;render()});
 document.querySelectorAll('[data-patient]').forEach(b=>b.onclick=()=>{selected=b.dataset.patient;tab='summary';view='details';render()});
 document.querySelectorAll('[data-bmi-category]').forEach(b=>b.addEventListener('click',()=>{
   selectedBmiCategory=b.dataset.bmiCategory;
   render();
 }));
 el('clearBmiFilter')?.addEventListener('click',()=>{
   selectedBmiCategory='';
   render();
 });
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});
 document.querySelectorAll('[data-pro-trend]').forEach(b=>b.addEventListener('click',()=>{proTrendDays=Number(b.dataset.proTrend);render()}));
 document.querySelectorAll('[data-pro-bmi]').forEach(b=>b.addEventListener('click',()=>{proBmiDays=Number(b.dataset.proBmi);render()}));
 el('proMovingAverage')?.addEventListener('change',e=>{proShowMovingAverage=e.target.checked;render()});
 document.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>{editing=appointments().find(a=>a.id===b.dataset.event)||null;window.prefill=null;view='event';render()});
 document.querySelectorAll('.pro3-slot').forEach(b=>b.onclick=()=>{editing=null;window.prefill={date:b.dataset.date,time:b.dataset.time};view='event';render()});
 el('goAgenda')?.addEventListener('click',()=>{view='agenda';render()});
 el('newPatient')?.addEventListener('click',()=>{view='newPatient';render()});
 el('editPatientProfile')?.addEventListener('click',()=>{view='editProfile';render()});
 el('cancelEditProfile')?.addEventListener('click',()=>{view='details';tab='summary';render()});
 el('saveEditProfile')?.addEventListener('click',saveEditedPatientProfile);if(view==='editProfile'){const p=patient(selected),m={Diagnosis:p.diagnosis,TheoreticalWeight:p.theoreticalWeight,Bowel:p.bowel,Metabolism:p.metabolism,Feeg:p.feeg,Impedance:p.impedance,PreviousDiets:p.previousDiets,Allergies:p.allergies,Medications:p.medications,GiIssues:p.giIssues,PastConditions:p.pastConditions,Observations:p.observations,Objectives:p.objectives};Object.entries(m).forEach(([k,v])=>{const x=el('ep'+k);if(x)x.value=v||''});[['FamObesity','famObesity'],['FamDiabetes','famDiabetes'],['FamHypertension','famHypertension'],['FamCardiovascular','famCardiovascular'],['FamDyslipidemia','famDyslipidemia'],['FamThyroid','famThyroid']].forEach(([id,k])=>{const x=el('ep'+id);if(x)x.checked=!!p[k]})}
 el('newPatientMeasure')?.addEventListener('click',()=>{window.editMeasureDate=null;view='patientMeasure';render()});
 document.querySelectorAll('[data-edit-measure]').forEach(b=>b.addEventListener('click',()=>{window.editMeasureDate=b.dataset.editMeasure;view='patientMeasure';render()}));
 el('cancelPatientMeasure')?.addEventListener('click',()=>{window.editMeasureDate=null;view='details';tab='measures';render()});
 el('savePatientMeasure')?.addEventListener('click',savePatientMeasure);
 document.querySelectorAll('[data-date-target]').forEach(p=>p.addEventListener('change',()=>{const t=el(p.dataset.dateTarget);if(t)t.value=fmt(p.value)}));
 el('savePatientAccount')?.addEventListener('click',()=>{const u=(el('accUser')?.value||'').trim(),pw=el('accPass')?.value||'';if(!u||!pw)return alert('Inserisci username e password.');saveAccountFor(selected,{username:u,password:pw,active:true});alert('Account demo salvato.');render()});
 el('deletePatientAccount')?.addEventListener('click',()=>{saveAccountFor(selected,null);alert('Account demo disattivato.');render()});
 el('downloadPrivacyForm')?.addEventListener('click',()=>{const p=patient(selected),blob=privacyPdfBlob(p),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`Privacy_${String(p.name||'Paziente').replace(/\s+/g,'_')}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)});
 el('uploadSignedPrivacy')?.addEventListener('click',()=>el('signedPrivacyFile')?.click());
 el('signedPrivacyFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;if(f.type!=='application/pdf'&&!f.name.toLowerCase().endsWith('.pdf'))return alert('Seleziona un PDF.');await storePrivacyPdf(selected,await f.arrayBuffer());savePrivacyMeta(selected,{filename:f.name,uploadedAt:new Date().toISOString()});render()});
 el('openSignedPrivacy')?.addEventListener('click',async()=>{const d=await readPrivacyPdf(selected);if(!d)return alert('PDF firmato non disponibile.');const w=window.open('about:blank','_blank'),u=URL.createObjectURL(new Blob([d],{type:'application/pdf'}));if(w)w.location.href=u;else location.href=u;setTimeout(()=>URL.revokeObjectURL(u),60000)});
 document.querySelectorAll('[data-review-lab]').forEach(b=>b.addEventListener('click',()=>{window.reviewLabKey=b.dataset.reviewLab;view='labReview';render()}));
 el('openLabReviewPdf')?.addEventListener('click',async()=>{const item=pendingLabs()[window.reviewLabKey];if(!item)return;try{const d=await readLabUploadPdf(item.key);if(!d)return alert('PDF non disponibile.');const w=window.open('about:blank','_blank'),u=URL.createObjectURL(new Blob([d],{type:'application/pdf'}));if(w)w.location.href=u;else location.href=u;setTimeout(()=>URL.revokeObjectURL(u),60000)}catch(e){alert('Non riesco ad aprire il PDF.')}});
 el('cancelLabReview')?.addEventListener('click',()=>{view='dashboard';render()});
 el('deleteLabReview')?.addEventListener('click',async()=>{
 const item=pendingLabs()[window.reviewLabKey];
 if(!item)return;
 if(!confirm(`Eliminare le analisi "${item.filename}"?\n\nIl file verrà rimosso anche dall'attesa del paziente.`))return;
 try{await deleteLabUploadPdf(item.key)}catch(e){console.warn('PDF cleanup',e)}
 const m=pendingLabs();
 delete m[window.reviewLabKey];
 savePendingLabs(m);
 window.reviewLabKey='';
 view='dashboard';
 render();
});
 el('confirmLabReview')?.addEventListener('click',()=>{const item=pendingLabs()[window.reviewLabKey];if(!item)return;const ids=['glucose','cholesterol','hdl','ldl','triglycerides','got','gpt','uricAcid','creatinine','ggt'],obj={id:'lab-'+Date.now(),date:readProDate('revDate')||today()};ids.forEach(k=>obj[k]=(el('rev'+k)?.value||'').trim());const rows=labsFor(item.patientId);rows.push(obj);saveLabsFor(item.patientId,rows);const m=pendingLabs();m[window.reviewLabKey]={...item,status:'Confermato'};savePendingLabs(m);selected=item.patientId;tab='labs';view='details';render()});
el('newLab')?.addEventListener('click',()=>{window.editLabId='';view='labForm';render()});document.querySelectorAll('[data-edit-lab]').forEach(b=>b.addEventListener('click',()=>{window.editLabId=b.dataset.editLab;view='labForm';render()}));el('cancelLab')?.addEventListener('click',()=>{view='details';tab='labs';render()});el('saveLab')?.addEventListener('click',saveLab);el('deleteLab')?.addEventListener('click',deleteLab);const upload=()=>el('planFile')?.click();el('uploadPlan')?.addEventListener('click',upload);el('replacePlan')?.addEventListener('click',upload);el('planFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;if(!f.name.toLowerCase().endsWith('.pdf'))return alert('Seleziona un PDF.');if(f.size>8*1024*1024)return alert('Per la demo usa un PDF inferiore a 8 MB.');await writePlanPdf(selected,await f.arrayBuffer());savePlanMeta(selected,{filename:f.name,planDate:readProDate('planDate')||today()});render()});el('openProPlan')?.addEventListener('click',async()=>{const d=await readPlanPdf(selected);if(!d)return alert('PDF non disponibile.');const u=URL.createObjectURL(new Blob([d],{type:'application/pdf'}));window.open(u,'_blank');setTimeout(()=>URL.revokeObjectURL(u),60000)});el('deletePlan')?.addEventListener('click',async()=>{if(!confirm('Eliminare il piano alimentare?'))return;await deletePlanPdf(selected);savePlanMeta(selected,null);render()});
 el('exportProDiaryPdf')?.addEventListener('click',exportProDiaryPdf);
 document.querySelectorAll('[data-pro-diary-day]').forEach(b=>b.addEventListener('click',()=>{
   proDiaryDate=b.dataset.proDiaryDay;
   view='diaryDay';
   render();
   window.scrollTo(0,0);
 }));
 el('backDiary')?.addEventListener('click',()=>{
   view='details';
   tab='diary';
   render();
 });
 el('proDiarySearch')?.addEventListener('input',e=>{
   proDiarySearch=e.target.value;
   const pos=document.scrollingElement?.scrollTop||0;
   render();
   requestAnimationFrame(()=>{
     window.scrollTo(0,pos);
     const s=el('proDiarySearch');
     if(s){s.focus();s.setSelectionRange(s.value.length,s.value.length)}
   });
 });
 el('cancelNewPatient')?.addEventListener('click',()=>{view='patients';render()});
 el('saveNewPatient')?.addEventListener('click',saveNewPatient);
 el('newEvent')?.addEventListener('click',()=>{editing=null;window.prefill=null;view='event';render()});
 el('prevWeek')?.addEventListener('click',()=>{weekDate=addDays(weekDate,-7);render()});
 el('nextWeek')?.addEventListener('click',()=>{weekDate=addDays(weekDate,7);render()});
 el('todayWeek')?.addEventListener('click',()=>{weekDate=new Date(today()+'T12:00:00');render()});
 el('backPatients')?.addEventListener('click',()=>{view='patients';render()});
 document.querySelectorAll('[data-edit-visit]').forEach(b=>b.addEventListener('click',()=>{
   const appt=appointments().find(a=>a.id===b.dataset.editVisit);
   if(!appt)return;
   editing={...appt};
   eventReturnToPatient=true;
   view='event';
   render();
 }));

 el('deletePatient')?.addEventListener('click',deleteSelectedPatient);
 el('searchPatient')?.addEventListener('input',e=>document.querySelectorAll('.pro3-patient').forEach(x=>x.style.display=x.innerText.toLowerCase().includes(e.target.value.toLowerCase())?'grid':'none'));
 el('saveSettings')?.addEventListener('click',()=>{save(SETTINGS_KEY,{name:el('sName').value,first:+el('sFirst').value||60,control:+el('sControl').value||30,dayStart:el('sStart').value||'08:00',dayEnd:el('sEnd').value||'19:00',workDays:+el('sWorkDays').value||5});alert('Impostazioni salvate')});
 el('downloadProBackup')?.addEventListener('click',downloadProBackup);
 el('uploadProBackup')?.addEventListener('click',()=>el('proBackupFile')?.click());
 el('proBackupFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importProBackupFile(f)});

 el('saveNote')?.addEventListener('click',()=>{const n=load(NOTES_KEY,{});n[selected]=el('noteText').value;save(NOTES_KEY,n);alert('Nota salvata')});
 el('eType')?.addEventListener('change',()=>{const t=el('eType').value,s=settings();el('patientBox').style.display=t==='personal'?'none':'block';el('titleBox').style.display=t==='personal'?'block':'none';if(t==='first')el('eDuration').value=s.first;if(t==='control')el('eDuration').value=s.control});
 el('cancelEvent')?.addEventListener('click',()=>{
   editing=null;window.prefill=null;
   if(eventReturnToPatient){eventReturnToPatient=false;view='details';tab='visits';}
   else view='agenda';
   render();
 });
 el('deleteEvent')?.addEventListener('click',()=>{
   if(!editing)return;
   if(!confirm('Vuoi eliminare questo appuntamento?'))return;
   save(APPT_KEY,appointments().filter(a=>a.id!==editing.id));
   editing=null;
   window.prefill=null;
   if(eventReturnToPatient){eventReturnToPatient=false;view='details';tab='visits';}
   else view='agenda';
   render();
 });
 el('saveEvent')?.addEventListener('click',()=>{
   const date=parseIt(el('eDate').value);if(!date)return alert('Inserisci la data nel formato gg-mm-aaaa');
   const type=el('eType').value;
   const obj={id:editing?.id||'e'+Date.now(),type,patientId:type==='personal'?null:el('ePatient').value,date,time:el('eTime').value,duration:+el('eDuration').value||30,title:type==='personal'?(el('eTitle').value||'Impegno personale'):'',note:el('eNote').value};
   const c=conflict(obj);if(c)return alert(`Orario già occupato: ${fmt(c.date)} alle ${c.time}. Appuntamento già fissato.`);
   let arr=appointments();const i=arr.findIndex(a=>a.id===obj.id);if(i>=0)arr[i]=obj;else arr.push(obj);save(APPT_KEY,arr);editing=null;window.prefill=null;
   if(eventReturnToPatient){eventReturnToPatient=false;view='details';tab='visits';}
   else view='agenda';
   render();
 });
}

ensureImportedFriendPatient();
render();
})();
