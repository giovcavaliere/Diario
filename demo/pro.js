
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
const LABS_KEY='diario-pro-labs-v1',PLAN_META_KEY='diario-pro-plan-meta-v1',PLAN_DB='diario-pro-documents-v1',PLAN_STORE='plans';

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
let weekDate=new Date(today()+'T12:00:00');

function settings(){return {...SETTINGS_DEFAULT,...load(SETTINGS_KEY,{})}}
function appointments(){
  let a=load(APPT_KEY,null);
  if(!Array.isArray(a)){a=JSON.parse(JSON.stringify(APPT_DEFAULT));save(APPT_KEY,a)}
  return a;
}

function labsFor(id){const m=load(LABS_KEY,{});return Array.isArray(m[id])?m[id]:[]}function saveLabsFor(id,r){const m=load(LABS_KEY,{});m[id]=r;save(LABS_KEY,m)}function planMetaFor(id){return load(PLAN_META_KEY,{})[id]||null}function savePlanMeta(id,v){const m=load(PLAN_META_KEY,{});if(v)m[id]=v;else delete m[id];save(PLAN_META_KEY,m)}function openPlanDb(){return new Promise((res,rej)=>{const r=indexedDB.open(PLAN_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(PLAN_STORE))r.result.createObjectStore(PLAN_STORE)};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}async function writePlanPdf(id,b){const db=await openPlanDb();return new Promise((res,rej)=>{const tx=db.transaction(PLAN_STORE,'readwrite');tx.objectStore(PLAN_STORE).put(b,id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}async function readPlanPdf(id){const db=await openPlanDb();return new Promise((res,rej)=>{const r=db.transaction(PLAN_STORE,'readonly').objectStore(PLAN_STORE).get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}async function deletePlanPdf(id){const db=await openPlanDb();return new Promise((res,rej)=>{const tx=db.transaction(PLAN_STORE,'readwrite');tx.objectStore(PLAN_STORE).delete(id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
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
 ${bmiPieCard()}`;
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
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid"/><text x="${left-2}" y="${y+1.5}" text-anchor="end" class="chart-y-label">${v.toFixed(1).replace('.',',')}</text>`;
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
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid"/><text x="${left-2}" y="${y+1.5}" text-anchor="end" class="chart-y-label">${v.toFixed(1).replace('.',',')}</text>`;
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
     <div><span>Caffè</span><b>${d.coffee!==''&&d.coffee!=null?esc(d.coffee):'—'}</b></div><div><span>Zucchero / dolcificante</span><b>${esc(d.sweetener||'—')}</b></div>
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
  ${[['summary','Riepilogo'],['anamnesis','Anamnesi'],['labs','Esami'],['plan','Piano'],['diary','Diario'],['trend','Andamento'],['measures','Misure'],['visits','Visite'],['notes','Note']].map(([k,l])=>`<button data-tab="${k}" class="${tab===k?'active':''}">${l}</button>`).join('')}
 </div>${tabContent(p)}</section>`;
}
function ageFromBirth(b){if(!b)return '—';const d=new Date(b+'T12:00:00'),n=new Date();let a=n.getFullYear()-d.getFullYear();if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))a--;return a}function latestMeasure(p){return (p.measures||[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).at(-1)||null}function proSummary2(p){const m=latestMeasure(p),wh=m&&+m.waist&&+m.hips?+m.waist/+m.hips:null;return `<div class="section-head"><h2>Riepilogo clinico-nutrizionale</h2>${(p.id==='main'||p.id.startsWith('patient-'))?'<button class="mini" id="editPatientProfile">Modifica scheda</button>':''}</div><div class="patient-summary-grid"><div class="summary-hero"><span>Paziente</span><b>${esc(p.name||'—')}</b><small>${p.birth?fmt(p.birth)+' · '+ageFromBirth(p.birth)+' anni':'Età non disponibile'}</small></div><div><span>Diagnosi / motivo</span><b>${esc(p.diagnosis||'—')}</b></div><div><span>Ultimo peso</span><b>${p.last!=null?p.last.toFixed(1).replace('.',',')+' kg':'—'}</b></div><div><span>BMI</span><b>${p.last&&p.height?bmi(p.last,p.height).toFixed(1).replace('.',','):'—'}</b></div><div><span>Obiettivo</span><b>${p.goal?p.goal+' kg':'—'}</b></div><div><span>Vita / Fianchi</span><b>${m?`${m.waist||'—'} / ${m.hips||'—'} cm`:'—'}</b><small>${wh?'W/H '+wh.toFixed(2).replace('.',','):''}</small></div><div><span>Piano alimentare</span><b>${planMetaFor(p.id)?'Disponibile':'Non caricato'}</b></div></div>`}function proAnamnesis(p){return `<div class="section-head"><h2>Anamnesi</h2>${(p.id==='main'||p.id.startsWith('patient-'))?'<button class="mini" id="editPatientProfile">Modifica scheda</button>':''}</div><details class="pro-accordion" open><summary>Dati e stile di vita</summary><div class="pro-read-grid"><div><span>Diagnosi / motivo</span><b>${esc(p.diagnosis||'—')}</b></div><div><span>Peso teorico</span><b>${p.theoreticalWeight?p.theoreticalWeight+' kg':'—'}</b></div><div><span>Lavoro</span><b>${esc(p.work||'—')}</b></div><div><span>Attività fisica</span><b>${esc(p.activity||'—')}</b></div><div><span>Alvo</span><b>${esc(p.bowel||'—')}</b></div><div><span>Fumo</span><b>${esc(p.smoking||'—')}</b></div><div><span>Alcol</span><b>${esc(p.alcohol||'—')}</b></div><div><span>Metabolismo basale</span><b>${esc(p.metabolism||'—')}</b></div><div><span>FEEG</span><b>${esc(p.feeg||'—')}</b></div><div><span>Impedenziometria</span><b>${esc(p.impedance||'—')}</b></div></div></details><details class="pro-accordion"><summary>Familiarità</summary><div class="pro-read-grid"><div><span>Obesità</span><b>${p.famObesity?'Sì':'No'}</b></div><div><span>Diabete</span><b>${p.famDiabetes?'Sì':'No'}</b></div><div><span>Ipertensione</span><b>${p.famHypertension?'Sì':'No'}</b></div><div><span>Cardiovascolare</span><b>${p.famCardiovascular?'Sì':'No'}</b></div><div><span>Dislipidemie</span><b>${p.famDyslipidemia?'Sì':'No'}</b></div><div><span>Tiroide</span><b>${p.famThyroid?'Sì':'No'}</b></div></div></details><details class="pro-accordion"><summary>Anamnesi patologica</summary><div class="pro-read-grid"><div><span>Diete pregresse</span><b>${esc(p.previousDiets||'—')}</b></div><div><span>Allergie</span><b>${esc(p.allergies||'—')}</b></div><div><span>Farmaci</span><b>${esc(p.medications||'—')}</b></div><div><span>Disturbi GI</span><b>${esc(p.giIssues||'—')}</b></div><div><span>Patologie / interventi</span><b>${esc(p.pastConditions||'—')}</b></div><div><span>Osservazioni</span><b>${esc(p.observations||'—')}</b></div><div><span>Obiettivi</span><b>${esc(p.objectives||'—')}</b></div></div></details>`}function proLabs(p){const r=labsFor(p.id),f=[['glucose','Glicemia'],['cholesterol','Colesterolo'],['hdl','HDL'],['ldl','LDL'],['triglycerides','Trigliceridi'],['got','GOT'],['gpt','GPT'],['uricAcid','Acido urico'],['creatinine','Creatinina'],['ggt','γGT']];return `<div class="section-head"><h2>Esami ematici</h2><button class="mini" id="newLab">＋ Aggiungi esami</button></div>${r.length?`<div class="labs-table-desktop"><table class="labs-table"><thead><tr><th>Data</th>${f.map(x=>`<th>${x[1]}</th>`).join('')}<th></th></tr></thead><tbody>${r.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<tr><td>${fmt(x.date)}</td>${f.map(y=>`<td>${esc(x[y[0]]||'—')}</td>`).join('')}<td><button class="mini" data-edit-lab="${x.id}">Modifica</button></td></tr>`).join('')}</tbody></table></div><div class="labs-cards-mobile">${r.map(x=>`<div class="lab-card"><div class="section-head"><b>${fmt(x.date)}</b><button class="mini" data-edit-lab="${x.id}">Modifica</button></div><div class="lab-values">${f.map(y=>`<div><span>${y[1]}</span><b>${esc(x[y[0]]||'—')}</b></div>`).join('')}</div></div>`).join('')}</div>`:'<p class="muted">Nessun esame registrato.</p>'}`}function proPlan(p){const m=planMetaFor(p.id);return `<div class="section-head"><h2>Piano alimentare</h2><span class="pill">${m?'Attivo':'Non caricato'}</span></div><div class="plan-pro-card">${m?`<b>${esc(m.filename)}</b><div class="plan-actions"><button class="secondary" id="openProPlan">Apri PDF</button><button class="mini" id="replacePlan">Sostituisci</button><button class="mini danger-text" id="deletePlan">Elimina</button></div>`:`<p class="muted">Il professionista carica il PDF; il paziente può solo consultarlo.</p><button class="primary" id="uploadPlan">Carica PDF dieta</button>`}<input id="planFile" type="file" accept=".pdf,application/pdf" style="display:none"><label>Data piano</label><input id="planDate" type="date" value="${m?.planDate||today()}"></div>`}
function tabContent(p){
 if(tab==='summary')return proSummary2(p);
 if(tab==='anamnesis')return proAnamnesis(p);
 if(tab==='labs')return proLabs(p);
 if(tab==='plan')return proPlan(p);
 if(tab==='diary')return proDiaryHistory(p);
 if(tab==='trend')return proTrendContent(p);
 if(tab==='measures')return `<div class="section-head"><h2>Misure</h2><button class="mini" id="newPatientMeasure">＋ Aggiungi misura</button></div>
 <div class="measure-table-wrap"><table class="measure-table"><thead><tr><th>Data</th><th>Vita</th><th>Fianchi</th><th>Note</th><th></th></tr></thead><tbody>
 ${(p.measures||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(m=>`<tr>
   <td>${fmt(m.date)}</td><td>${m.waist!==''&&m.waist!=null?m.waist:'—'}</td><td>${m.hips!==''&&m.hips!=null?m.hips:'—'}</td><td>${esc(m.notes||'')}</td>
   <td><button class="mini" data-edit-measure="${m.date}">Modifica</button></td>
 </tr>`).join('')||'<tr><td colspan="5">Nessuna misura.</td></tr>'}
 </tbody></table></div>`;
 if(tab==='visits')return appointments().filter(a=>a.patientId===p.id&&a.type!=='personal').sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).map(a=>`<div class="pro3-event ${typeClass(a.type)}"><b>${fmt(a.date)} · ${a.time}</b><span>${typeLabel(a.type)} · ${a.duration} min</span></div>`).join('')||'<p class="muted">Nessuna visita.</p>';
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
   <input id="npBirth" type="date">

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
   <input id="npNextVisit" type="date">

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
   birth:el('npBirth')?.value||'',
   sex:el('npSex')?.value||'',
   height,
   goal,
   nextVisit:el('npNextVisit')?.value||'',
   minWeight,
   maxWeight,
   reasonableWeight,
   work:(el('npWork')?.value||'').trim(),
   activity:(el('npActivity')?.value||'').trim(),
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
   <label>Data di nascita</label><input id="epBirth" type="date" value="${p.birth||''}">
   <label>Sesso</label>
   <select id="epSex">
     <option value="" ${!p.sex?'selected':''}>Non specificato</option>
     <option value="M" ${p.sex==='M'?'selected':''}>Maschile</option>
     <option value="F" ${p.sex==='F'?'selected':''}>Femminile</option>
     <option value="X" ${p.sex==='X'?'selected':''}>Altro / preferisco non specificare</option>
   </select>
   <label>Altezza (cm)</label><input id="epHeight" type="number" min="80" max="250" step="1" value="${p.height||''}">
   <label>Peso obiettivo (kg)</label><input id="epGoal" type="number" min="30" max="300" step="0.1" value="${p.goal||''}">
   <label>Data prossima visita</label><input id="epNextVisit" type="date" value="${p.nextVisit||''}">

   <h2 style="margin-top:22px">Storia del peso</h2>
   <label>Peso minimo storico (kg)</label><input id="epMinWeight" type="number" min="30" max="300" step="0.1" value="${p.minWeight||''}">
   <label>Peso massimo storico (kg)</label><input id="epMaxWeight" type="number" min="30" max="300" step="0.1" value="${p.maxWeight||''}">
   <label>Peso ragionevole / concordato (kg)</label><input id="epReasonableWeight" type="number" min="30" max="300" step="0.1" value="${p.reasonableWeight||''}">

   <h2 style="margin-top:22px">Stile di vita</h2>
   <label>Attività lavorativa</label><textarea id="epWork" rows="2">${esc(p.work||'')}</textarea>
   <label>Attività fisica abituale</label><textarea id="epActivity" rows="2">${esc(p.activity||'')}</textarea>
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
   birth:el('epBirth')?.value||'',
   sex:el('epSex')?.value||'',
   height,
   goal,
   nextVisit:el('epNextVisit')?.value||'',
   minWeight,
   maxWeight,
   reasonableWeight,
   work:(el('epWork')?.value||'').trim(),
   activity:(el('epActivity')?.value||'').trim(),
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


function labForm(){const p=patient(selected),r=labsFor(p.id),x=window.editLabId?r.find(y=>y.id===window.editLabId):null,f=(id,l)=>`<label>${l}<input id="lab${id}" value="${esc(x?.[id]||'')}"></label>`;return `${top(x?'Modifica esami':'Nuovi esami')}<section class="card"><div class="form-grid"><label>Data<input id="labDate" type="date" value="${x?.date||today()}"></label>${f('glucose','Glicemia')}${f('cholesterol','Colesterolo')}${f('hdl','HDL')}${f('ldl','LDL')}${f('triglycerides','Trigliceridi')}${f('got','GOT')}${f('gpt','GPT')}${f('uricAcid','Acido urico')}${f('creatinine','Creatinina')}${f('ggt','γGT')}</div><div class="pro3-actions">${x?'<button class="mini danger-text" id="deleteLab">Elimina</button>':''}<button class="secondary" id="cancelLab">Annulla</button><button class="primary" id="saveLab">Salva</button></div></section>`}function saveLab(){const p=patient(selected),o={id:window.editLabId||'lab-'+Date.now(),date:el('labDate')?.value||today()};['glucose','cholesterol','hdl','ldl','triglycerides','got','gpt','uricAcid','creatinine','ggt'].forEach(k=>o[k]=(el('lab'+k)?.value||'').trim());let r=labsFor(p.id),i=r.findIndex(x=>x.id===o.id);if(i>=0)r[i]=o;else r.push(o);saveLabsFor(p.id,r);window.editLabId='';tab='labs';view='details';render()}function deleteLab(){const p=patient(selected);if(!confirm('Eliminare questi esami?'))return;saveLabsFor(p.id,labsFor(p.id).filter(x=>x.id!==window.editLabId));window.editLabId='';tab='labs';view='details';render()}
function patientMeasureForm(){
 const p=patient(selected);
 if(!p)return `${top('Paziente non trovato')}`;
 const existing=window.editMeasureDate?(p.measures||[]).find(x=>x.date===window.editMeasureDate):null;
 return `${top(existing?'Modifica misurazione':'Nuova misurazione')}
 <section class="card">
   <label>Data</label><input id="pmDate" type="date" value="${existing?.date||today()}">
   <label>Circonferenza vita (cm)</label><input id="pmWaist" type="number" min="20" max="300" step="0.1" value="${existing?.waist??''}">
   <label>Circonferenza fianchi (cm)</label><input id="pmHips" type="number" min="20" max="300" step="0.1" value="${existing?.hips??''}">
   <label>Note</label><textarea id="pmNotes" rows="3">${esc(existing?.notes||'')}</textarea>
   <div class="pro3-actions"><button class="secondary" id="cancelPatientMeasure">Annulla</button><button class="primary" id="savePatientMeasure">${existing?'Salva modifiche':'Salva misura'}</button></div>
 </section>`;
}
function savePatientMeasure(){
 const p=patient(selected); if(!p)return;
 const date=el('pmDate')?.value||''; if(!date)return alert('Inserisci la data.');
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
     settings:load(SETTINGS_KEY,{})
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
 save(SETTINGS_KEY,d.settings&&typeof d.settings==='object'?d.settings:{});
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
 <label>Data</label><input id="eDate" inputmode="numeric" placeholder="gg-mm-aaaa" value="${fmt(a.date)}">
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
  let html=view==='dashboard'?dashboard():view==='patients'?patientsPage():view==='agenda'?agenda():view==='settings'?settingsPage():view==='details'?details():view==='newPatient'?newPatientForm():view==='editProfile'?editPatientProfileForm():view==='patientMeasure'?patientMeasureForm():view==='labForm'?labForm():view==='diaryDay'?proDiaryDayView():eventForm(window.prefill||null);
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
 el('savePatientMeasure')?.addEventListener('click',savePatientMeasure);el('newLab')?.addEventListener('click',()=>{window.editLabId='';view='labForm';render()});document.querySelectorAll('[data-edit-lab]').forEach(b=>b.addEventListener('click',()=>{window.editLabId=b.dataset.editLab;view='labForm';render()}));el('cancelLab')?.addEventListener('click',()=>{view='details';tab='labs';render()});el('saveLab')?.addEventListener('click',saveLab);el('deleteLab')?.addEventListener('click',deleteLab);const upload=()=>el('planFile')?.click();el('uploadPlan')?.addEventListener('click',upload);el('replacePlan')?.addEventListener('click',upload);el('planFile')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;if(!f.name.toLowerCase().endsWith('.pdf'))return alert('Seleziona un PDF.');if(f.size>8*1024*1024)return alert('Per la demo usa un PDF inferiore a 8 MB.');await writePlanPdf(selected,await f.arrayBuffer());savePlanMeta(selected,{filename:f.name,planDate:el('planDate')?.value||today()});render()});el('openProPlan')?.addEventListener('click',async()=>{const d=await readPlanPdf(selected);if(!d)return alert('PDF non disponibile.');const u=URL.createObjectURL(new Blob([d],{type:'application/pdf'}));window.open(u,'_blank');setTimeout(()=>URL.revokeObjectURL(u),60000)});el('deletePlan')?.addEventListener('click',async()=>{if(!confirm('Eliminare il piano alimentare?'))return;await deletePlanPdf(selected);savePlanMeta(selected,null);render()});
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
 el('deletePatient')?.addEventListener('click',deleteSelectedPatient);
 el('searchPatient')?.addEventListener('input',e=>document.querySelectorAll('.pro3-patient').forEach(x=>x.style.display=x.innerText.toLowerCase().includes(e.target.value.toLowerCase())?'grid':'none'));
 el('saveSettings')?.addEventListener('click',()=>{save(SETTINGS_KEY,{name:el('sName').value,first:+el('sFirst').value||60,control:+el('sControl').value||30,dayStart:el('sStart').value||'08:00',dayEnd:el('sEnd').value||'19:00',workDays:+el('sWorkDays').value||5});alert('Impostazioni salvate')});
 el('downloadProBackup')?.addEventListener('click',downloadProBackup);
 el('uploadProBackup')?.addEventListener('click',()=>el('proBackupFile')?.click());
 el('proBackupFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importProBackupFile(f)});

 el('saveNote')?.addEventListener('click',()=>{const n=load(NOTES_KEY,{});n[selected]=el('noteText').value;save(NOTES_KEY,n);alert('Nota salvata')});
 el('eType')?.addEventListener('change',()=>{const t=el('eType').value,s=settings();el('patientBox').style.display=t==='personal'?'none':'block';el('titleBox').style.display=t==='personal'?'block':'none';if(t==='first')el('eDuration').value=s.first;if(t==='control')el('eDuration').value=s.control});
 el('cancelEvent')?.addEventListener('click',()=>{editing=null;window.prefill=null;view='agenda';render()});
 el('deleteEvent')?.addEventListener('click',()=>{
   if(!editing)return;
   if(!confirm('Vuoi eliminare questo appuntamento?'))return;
   save(APPT_KEY,appointments().filter(a=>a.id!==editing.id));
   editing=null;
   window.prefill=null;
   view='agenda';
   render();
 });
 el('saveEvent')?.addEventListener('click',()=>{
   const date=parseIt(el('eDate').value);if(!date)return alert('Inserisci la data nel formato gg-mm-aaaa');
   const type=el('eType').value;
   const obj={id:editing?.id||'e'+Date.now(),type,patientId:type==='personal'?null:el('ePatient').value,date,time:el('eTime').value,duration:+el('eDuration').value||30,title:type==='personal'?(el('eTitle').value||'Impegno personale'):'',note:el('eNote').value};
   const c=conflict(obj);if(c)return alert(`Orario già occupato: ${fmt(c.date)} alle ${c.time}. Appuntamento già fissato.`);
   let arr=appointments();const i=arr.findIndex(a=>a.id===obj.id);if(i>=0)arr[i]=obj;else arr.push(obj);save(APPT_KEY,arr);editing=null;window.prefill=null;view='agenda';render();
 });
}

ensureImportedFriendPatient();
render();
})();
