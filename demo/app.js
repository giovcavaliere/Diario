const KEY='diario-pro-patient-main-v1';
const PROFILE_KEY='diario-pro-profile-main-v1';
const MEASURE_KEY='diario-pro-measures-main-v1';
const EXTRA_PATIENTS_KEY='diario-pro-extra-patients-v1';
const ACCOUNT_KEY='diario-pro-accounts-v1';
const ACTIVE_PATIENT_KEY='diario-pro-active-patient-v1';
const PENDING_LABS_KEY='diario-pro-pending-labs-v1';
let page='home';
let editDate=null;
let coffee=0;
let trendDays=30;
let duplicateDraft=null;
let duplicateSource=null;
let importText='';
let importPreview=null;
let historySearch='';
let showMovingAverage=false;
let bmiDays=30;
let measuresCompleteOnly=false;

const $=s=>document.querySelector(s);
const rawExtraPatients=()=>{try{return JSON.parse(localStorage.getItem(EXTRA_PATIENTS_KEY)||'[]')}catch(e){return []}};
const activePatientId=()=>localStorage.getItem(ACTIVE_PATIENT_KEY)||'';
const activeExtraPatient=()=>rawExtraPatients().find(p=>p.id===activePatientId())||null;
const accountMap=()=>{try{return JSON.parse(localStorage.getItem(ACCOUNT_KEY)||'{}')||{}}catch(e){return {}}};
const load=()=>{
 const id=activePatientId();if(id&&id!=='main'){const p=activeExtraPatient();return Array.isArray(p?.diary)?JSON.parse(JSON.stringify(p.diary)):[]}
 return JSON.parse(localStorage.getItem(KEY)||'[]');
};
const save=d=>{
 const id=activePatientId();if(id&&id!=='main'){const arr=rawExtraPatients(),i=arr.findIndex(p=>p.id===id);if(i<0)return;arr[i]={...arr[i],diary:d,weights:d.filter(x=>x.weight!==''&&x.weight!=null).map(x=>[x.date,Number(x.weight)])};localStorage.setItem(EXTRA_PATIENTS_KEY,JSON.stringify(arr));return}
 localStorage.setItem(KEY,JSON.stringify(d));
};
const loadProfile=()=>{
 let p={},id=activePatientId();
 if(id&&id!=='main')p=activeExtraPatient()||{};else{try{p=JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')||{}}catch(e){p={}}}
 const num=k=>p[k]===undefined||p[k]===null||p[k]===''?'':Number(p[k]);
 let first=p.firstName||p.name||'',surname=p.surname||'';
 if(id&&id!=='main'&&!p.firstName&&p.name){const parts=String(p.name).trim().split(/\s+/);first=parts.shift()||'';surname=surname||parts.join(' ')}
 return {name:first,surname,birth:p.birth||'',height:num('height'),sex:p.sex||'',goal:num('goal'),nextVisit:p.nextVisit||'',minWeight:num('minWeight'),maxWeight:num('maxWeight'),reasonableWeight:num('reasonableWeight'),work:p.work||'',activity:p.activity||'',activityFactor:p.activityFactor||'',smoking:p.smoking||'',alcohol:p.alcohol||'',diagnosis:p.diagnosis||'',theoreticalWeight:num('theoreticalWeight'),bowel:p.bowel||'',metabolism:p.metabolism||'',feeg:p.feeg||'',impedance:p.impedance||'',famObesity:!!p.famObesity,famDiabetes:!!p.famDiabetes,famHypertension:!!p.famHypertension,famCardiovascular:!!p.famCardiovascular,famDyslipidemia:!!p.famDyslipidemia,famThyroid:!!p.famThyroid,famGestational:!!p.famGestational,previousDiets:p.previousDiets||'',allergies:p.allergies||'',medications:p.medications||'',giIssues:p.giIssues||'',pastConditions:p.pastConditions||'',observations:p.observations||'',objectives:p.objectives||''};
};
const loadMeasures=()=>{const id=activePatientId();if(id&&id!=='main'){const p=activeExtraPatient();return Array.isArray(p?.measures)?JSON.parse(JSON.stringify(p.measures)):[]}try{return JSON.parse(localStorage.getItem(MEASURE_KEY)||'[]')}catch(e){return []}};
const saveMeasures=d=>{const id=activePatientId();if(id&&id!=='main'){const arr=rawExtraPatients(),i=arr.findIndex(p=>p.id===id);if(i<0)return;arr[i]={...arr[i],measures:d};localStorage.setItem(EXTRA_PATIENTS_KEY,JSON.stringify(arr));return}localStorage.setItem(MEASURE_KEY,JSON.stringify(d))};
const isoToday=()=>{let d=new Date(),z=d.getTimezoneOffset()*60000;return new Date(d-z).toISOString().slice(0,10)};
const fmt=d=>new Date(d+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const fmtShort=d=>new Date(d+'T12:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'});
const kg=v=>Number.isFinite(+v)&&v!==''?`${(+v).toFixed(1).replace('.',',')} kg`:'—';

function isoToItalianDate(iso){const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}-${m[2]}-${m[1]}`:''}
function italianDateToIso(v){const m=String(v||'').trim().match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);if(!m)return '';const iso=`${m[3]}-${m[2]}-${m[1]}`,d=new Date(iso+'T12:00:00');return !Number.isNaN(d.getTime())&&d.getFullYear()==+m[3]&&d.getMonth()+1==+m[2]&&d.getDate()==+m[1]?iso:''}

const PATIENT_CALORIE_TABLE=[
 ['pan bauletto',265],['pane',265],['pasta',350],['riso',360],['biscotti',450],['gocciole',470],['cereali',370],
 ['yogurt greco',90],['yogurt',70],['latte',50],['zymil',46],['cappuccino',70],['fiocchi',100],['mozzarella',250],
 ['pollo',165],['tacchino',135],['salmone',210],['tonno',190],['bresaola',150],['prosciutto',220],['cozze',85],
 ['verdure',35],['iceberg',14],['insalata',20],['pomodor',18],['funghi',22],['banana',89],['fragole',32],['anguria',30],['melone',34],
 ['mela',52],['frutta',55],['piselli',81],['olio',884],['crostata',400],['barretta',390],['succo',45]
];
function estimateTextCalories(text){
 const s=String(text||'').toLowerCase();if(!s.trim())return 0;let total=0;
 for(const [name,k100] of PATIENT_CALORIE_TABLE){
  let at=s.indexOf(name);if(at<0)continue;
  const around=s.slice(Math.max(0,at-35),Math.min(s.length,at+name.length+35));
  const grams=around.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|grammi)\b/i);
  if(grams)total+=Number(grams[1].replace(',','.'))*k100/100;
  else if(name==='cappuccino')total+=70;
  else if(name==='banana'||name==='mela')total+=85;
  else if(name==='barretta')total+=110;
  else total+=k100*.75;
 }
 return Math.round(total);
}
function dayEstimatedCalories(entry){
 if(!entry)return null;
 const stored=Number(entry.estimatedCalories);
 return Number.isFinite(stored)&&stored>0?Math.round(stored):estimateDiaryCalories(entry);
}
function estimateDiaryCalories(entry){
 if(!entry)return null;const total=['breakfast','snack1','lunch','snack2','dinner'].reduce((s,k)=>s+estimateTextCalories(entry[k]),0);
 return total>0?total:null;
}
function latestDiaryCalories(p){
 const a=(p.entries||p.diary||[]).slice().sort((x,y)=>String(x.date).localeCompare(String(y.date)));
 for(let i=a.length-1;i>=0;i--){const c=estimateDiaryCalories(a[i]);if(c)return {date:a[i].date,calories:c}}
 return null;
}
function sorted(){return load().sort((a,b)=>a.date.localeCompare(b.date))}
function weighted(){return sorted().filter(x=>Number.isFinite(+x.weight)&&x.weight!=='')}

function bmiFor(weight,heightCm){
  const w=Number(weight),h=Number(heightCm)/100;
  return Number.isFinite(w)&&h>0?w/(h*h):null;
}
function bmiLabel(v){
  if(!Number.isFinite(v))return '';
  if(v<18.5)return 'Sottopeso';
  if(v<25)return 'Normopeso';
  if(v<30)return 'Sovrappeso';
  if(v<35)return 'Obesità I';
  if(v<40)return 'Obesità II';
  return 'Obesità III';
}
function movingAverageSeries(items,windowSize=7){
  const w=items.filter(x=>x.weight!=='');
  return w.map((x,i)=>{
    const slice=w.slice(Math.max(0,i-windowSize+1),i+1);
    const avg=slice.reduce((s,r)=>s+Number(r.weight),0)/slice.length;
    return {...x,avg};
  });
}
function filteredByDays(items,days){
  let a=[...items];
  if(days&&a.length){
    const end=new Date(a.at(-1).date+'T12:00:00');
    const start=new Date(end); start.setDate(end.getDate()-(days-1));
    a=a.filter(x=>new Date(x.date+'T12:00:00')>=start);
  }
  return a;
}

function chart(items,days){
  let w=filteredByDays(items.filter(x=>x.weight!==''),days);
  if(!w.length)return '<p class="muted">Nessun peso registrato.</p>';

  const avgSeries=movingAverageSeries(items).filter(x=>w.some(y=>y.date===x.date));
  let vals=w.map(x=>+x.weight);
  if(showMovingAverage) vals.push(...avgSeries.map(x=>x.avg));
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

  let tickCount=5;
  let ticks=Array.from({length:tickCount},(_,i)=>max-(range/(tickCount-1))*i);
  let grid=ticks.map(v=>{
    let y=yFor(v);
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid"/><text x="${left-2}" y="${y}" text-anchor="end" dominant-baseline="middle" class="chart-y-label">${v.toFixed(1).replace('.',',')}</text>`;
  }).join('');

  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 100 100" preserveAspectRatio="none">${grid}<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" class="chart-axis"/><line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="chart-axis"/><polyline points="${pts}" class="chart-line" fill="none" vector-effect="non-scaling-stroke"/>${w.map(x=>`<circle cx="${xFor(x.date)}" cy="${yFor(+x.weight)}" r="0.55" class="chart-point" vector-effect="non-scaling-stroke"/>`).join('')}${showMovingAverage&&avgPts?`<polyline points="${avgPts}" class="chart-average" fill="none" vector-effect="non-scaling-stroke"/>`:''}</svg><span class="chart-unit">kg</span></div><div class="chart-dates"><span>${fmt(w[0].date).replace(/^[^ ]+ /,'')}</span><span>${fmt(w.at(-1).date).replace(/^[^ ]+ /,'')}</span></div>`;
}

function bmiChart(items,days){
  const profile=loadProfile();
  if(!profile.height)return '<p class="muted">Inserisci l’altezza nel Profilo per calcolare il BMI.</p>';
  let data=items.filter(x=>x.weight!=='').map(x=>({...x,bmi:bmiFor(x.weight,profile.height)})).filter(x=>Number.isFinite(x.bmi));
  data=filteredByDays(data,days);
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
  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 100 100" preserveAspectRatio="none">${grid}<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" class="chart-axis"/><line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="chart-axis"/><polyline points="${pts}" class="chart-bmi-line" fill="none" vector-effect="non-scaling-stroke"/>${data.map((x,i)=>`<circle cx="${xFor(i)}" cy="${yFor(x.bmi)}" r="0.55" class="chart-bmi-point" vector-effect="non-scaling-stroke"/>`).join('')}</svg><span class="chart-unit">BMI</span></div><div class="chart-dates"><span>${fmt(data[0].date).replace(/^[^ ]+ /,'')}</span><span>${fmt(data.at(-1).date).replace(/^[^ ]+ /,'')}</span></div>`;
}

const PLAN_META_KEY='diario-pro-plan-meta-v1',PLAN_DB='diario-pro-documents-v1',PLAN_STORE='plans';function planMetaMap(){try{return JSON.parse(localStorage.getItem(PLAN_META_KEY)||'{}')||{}}catch(e){return {}}}function mainPlanMeta(){return planMetaMap()[activePatientId()||'main']||null}function openPlanDb(){return new Promise((res,rej)=>{const r=indexedDB.open(PLAN_DB,2);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(PLAN_STORE))r.result.createObjectStore(PLAN_STORE);if(!r.result.objectStoreNames.contains('labUploads'))r.result.createObjectStore('labUploads');if(!r.result.objectStoreNames.contains('privacy'))r.result.createObjectStore('privacy')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}async function readPlanPdf(id='main'){const db=await openPlanDb();return new Promise((res,rej)=>{const r=db.transaction(PLAN_STORE,'readonly').objectStore(PLAN_STORE).get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}window.openPatientPlan=async()=>{
  const win=window.open('about:blank','_blank');
  try{
    const d=await readPlanPdf(activePatientId()||'main');
    if(!d){if(win)win.close();return alert('Piano alimentare non disponibile.');}
    const u=URL.createObjectURL(new Blob([d],{type:'application/pdf'}));
    if(win)win.location.href=u;
    else location.href=u;
    setTimeout(()=>URL.revokeObjectURL(u),60000);
  }catch(e){
    if(win)win.close();
    alert('Non riesco ad aprire il piano alimentare.');
  }
};

const PATIENT_APPT_KEY='diario-pro-appts-recovery-v1';
function patientAppointments(){
  try{
    const a=JSON.parse(localStorage.getItem(PATIENT_APPT_KEY)||'[]');
    return Array.isArray(a)?a:[];
  }catch(e){return []}
}
function nextPatientVisit(profile){
  const todayIso=isoToday();
  const future=patientAppointments()
    .filter(a=>a&&a.patientId===(activePatientId()||'main')&&a.type!=='personal'&&a.date>=todayIso)
    .sort((a,b)=>String(a.date+a.time).localeCompare(String(b.date+b.time)));
  if(future.length)return future[0].date;
  return profile.nextVisit||'';
}


async function storeLabPdf(key,b){const db=await openPlanDb();return new Promise((res,rej)=>{const tx=db.transaction('labUploads','readwrite');tx.objectStore('labUploads').put(b,key);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
function pendingLabMap(){try{return JSON.parse(localStorage.getItem(PENDING_LABS_KEY)||'{}')||{}}catch(e){return {}}}
function parseLabValues(text){
 const c=String(text||'').replace(/\s+/g,' '),out={};
 const specs=[['glucose',['glicemia','glucosio']],['cholesterol',['colesterolo totale','colesterolo']],['hdl',['hdl']],['ldl',['ldl']],['triglycerides',['trigliceridi']],['got',['got','ast']],['gpt',['gpt','alt']],['uricAcid',['acido urico','uricemia']],['creatinine',['creatinina']],['ggt',['gamma gt','ggt']]];
 for(const [k,names] of specs)for(const n of names){const safe=n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),m=c.match(new RegExp(safe+'[^0-9]{0,24}([0-9]+(?:[.,][0-9]+)?)','i'));if(m){out[k]=m[1].replace(',','.');break}}
 const dm=c.match(/\b([0-3]?\d)[\/.-]([01]?\d)[\/.-](20\d{2})\b/);out.date=dm?`${dm[3]}-${String(dm[2]).padStart(2,'0')}-${String(dm[1]).padStart(2,'0')}`:isoToday();return out;
}
async function extractPdfText(file){
 const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@6.2.108/build/pdf.worker.min.mjs';
 const pdf=await pdfjs.getDocument({data:await file.arrayBuffer(),enableScripting:false}).promise;let t='';for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i),c=await p.getTextContent();t+=' '+c.items.map(x=>x.str).join(' ')}return t;
}
window.uploadBloodTests=async input=>{const f=input.files?.[0];if(!f)return;if(f.type!=='application/pdf'&&!f.name.toLowerCase().endsWith('.pdf'))return alert('Seleziona un PDF.');const id=activePatientId()||'main',key='lab-'+id+'-'+Date.now();let values={},note='';try{values=parseLabValues(await extractPdfText(f));if(!Object.keys(values).some(k=>k!=='date'))note='Nessun valore riconosciuto automaticamente.'}catch(e){values={date:isoToday()};note='PDF non leggibile come testo o scansione: compilazione manuale necessaria.'}await storeLabPdf(key,await f.arrayBuffer());const m=pendingLabMap();m[key]={key,patientId:id,filename:f.name,uploadedAt:new Date().toISOString(),status:'Da verificare',values,note};localStorage.setItem(PENDING_LABS_KEY,JSON.stringify(m));input.value='';alert('Analisi inviate al professionista per la verifica.');render()};
function bloodUploadCard(){const id=activePatientId()||'main',n=Object.values(pendingLabMap()).filter(x=>x.patientId===id&&x.status==='Da verificare').length;return `<section class="card"><div class="section-head"><h2>Analisi del sangue</h2><span class="pill">${n?n+' in verifica':'PDF'}</span></div><p class="muted">Carica il referto. I valori riconosciuti vengono proposti al professionista, che deve confermarli.</p><label class="secondary upload-button">Carica analisi PDF<input type="file" accept="application/pdf,.pdf" onchange="uploadBloodTests(this)" hidden></label></section>`}

function home(){
  const profile=loadProfile();
  let visitHtml='';
  const effectiveNextVisit=nextPatientVisit(profile);
  if(effectiveNextVisit){
    const d=new Date(effectiveNextVisit+'T12:00:00');
    if(!Number.isNaN(d.getTime())){
      const visitDate=d.toLocaleDateString('it-IT',{day:'numeric',month:'long',year:'numeric'});
      visitHtml=`<section class="card next-visit-card"><div class="next-visit-icon">📅</div><div><div class="muted">Prossima visita</div><b>${visitDate}</b></div></section>`;
    }
  }
  let w=weighted(),last=w.at(-1),first=w[0];
  let delta=last&&first?(+last.weight)-(+first.weight):null;
  let deltaClass=delta<0?'good':delta>0?'up':'';
  const currentBmi=last&&profile.height?bmiFor(last.weight,profile.height):null;
  let goalHtml='';
  if(first&&last&&profile.goal&&profile.goal<Number(first.weight)){
    const startWeight=Number(first.weight);
    const currentWeight=Number(last.weight);
    const goalWeight=Number(profile.goal);
    const totalJourney=startWeight-goalWeight;
    const completedJourney=startWeight-currentWeight;
    const pct=totalJourney>0
      ? Math.round(Math.max(0,Math.min(1,completedJourney/totalJourney))*100)
      : 0;
    goalHtml=`<section class="card goal-card"><div class="section-head"><h2>Obiettivo</h2><span class="pill">${pct}%</span></div><div class="goal-row"><b>${kg(startWeight)}</b><span>→</span><b>${kg(goalWeight)}</b></div><div class="progress"><span style="width:${pct}%"></span></div><p class="muted">Peso attuale: ${kg(currentWeight)} · ${Math.max(0,currentWeight-goalWeight).toFixed(1).replace('.',',')} kg al traguardo</p></section>`;
  }
  return `<div class="hero-title"><div><div class="eyebrow">IL MIO PERCORSO</div><h1>${profile.name?`Diario di ${escapeHtml([profile.name,profile.surname].filter(Boolean).join(' '))}`:'Diario'}</h1></div></div>
  <section class="card highlight"><div class="muted caps">ULTIMA RILEVAZIONE</div>${last?`<div class="weight">${(+last.weight).toFixed(1).replace('.',',')} <small>kg</small></div><div class="delta ${deltaClass}">${delta>0?'+':''}${delta.toFixed(1).replace('.',',')} kg dall'inizio</div>${currentBmi?`<div class="bmi-now"><span>BMI</span><b>${currentBmi.toFixed(1).replace('.',',')}</b><small>${bmiLabel(currentBmi)}</small></div>`:''}<p class="muted">${fmt(last.date)}</p>`:'<p class="muted">Inserisci la prima giornata per iniziare.</p>'}</section>
  ${visitHtml}${goalHtml}
  ${(()=>{const pm=mainPlanMeta();return pm?`<section class="card plan-card"><div class="section-head"><h2>Il mio piano alimentare</h2><span class="pill">PDF</span></div><p><b>${escapeHtml(pm.filename||'Piano alimentare')}</b></p><p class="muted">${pm.planDate?'Piano del '+fmtShort(pm.planDate):'Documento pubblicato dal professionista'}</p><button class="secondary" onclick="openPatientPlan()">Apri PDF</button></section>`:''})()}
  ${bloodUploadCard()}
  <section class="card chart-card"><div class="section-head"><h2>Ultimi 7 giorni</h2><span class="pill">Peso</span></div>${chart(w,7)}</section>
  <div class="grid actions"><button class="primary" onclick="newDay()">＋ Aggiungi giornata</button><button class="secondary" onclick="go('trend')">📈 Andamento</button></div>`;
}
function formDataFromDOM(){
  let weight=$('#weight')?.value.trim().replace(',','.')??'';
  return {
    date:italianDateToIso($('#dateText')?.value)||$('#datePicker')?.value||editDate||isoToday(),
    weight:weight===''?'':Number(weight),
    coffee,
    sweetener:$('#sweetener')?.value.trim()||'',
    ...Object.fromEntries(['breakfast','snack1','lunch','snack2','dinner','notes'].map(k=>[k,$('#'+k)?.value.trim()||'']))
  };
}

function add(){
  let existing=editDate?load().find(x=>x.date===editDate):null;
  let data=duplicateDraft||existing||{};
  coffee=Number(data.coffee||0);
  let isEdit=!!existing&&!duplicateDraft;
  let targetDate=data.date||editDate||isoToday();
  let targetExists=duplicateDraft&&load().some(x=>x.date===targetDate);
  return `<div class="page-title"><button class="back" onclick="cancelEdit()">‹</button><div><div class="eyebrow">${duplicateDraft?'COPIA RAPIDA':isEdit?'REGISTRAZIONE':'NUOVA REGISTRAZIONE'}</div><h1>${duplicateDraft?'Duplica giornata':isEdit?'Modifica giornata':'Aggiungi giornata'}</h1></div>${isEdit?'<button class="mini danger-text" onclick="deleteDay()">Elimina</button>':''}</div>
  ${duplicateDraft?`<div class="notice">Stai copiando <b>${fmtShort(duplicateSource)}</b>. Peso escluso: modifica quello che vuoi e salva con una nuova data.</div>`:''}
  <section class="card form-card"><label>Data</label><div class="date-entry"><input id="dateText" type="text" inputmode="numeric" placeholder="GG-MM-AAAA" value="${isoToItalianDate(targetDate)}" onblur="manualDateChanged(this.value)"><label class="date-picker-btn" title="Apri calendario">📅<input id="datePicker" type="date" value="${targetDate}" onchange="pickerDateChanged(this.value)"></label></div>${targetExists?'<div class="warning">Questa data è già registrata. Scegline un’altra per evitare duplicati.</div>':''}
  <label>Peso (kg)</label><input id="weight" inputmode="decimal" placeholder="es. 115,6" value="${data.weight??''}">
  <label>Caffè</label><div class="coffee"><button onclick="setCoffee(-1)">−</button><strong id="coffee">${coffee}</strong><button onclick="setCoffee(1)">＋</button></div><label>Zucchero / dolcificante</label><input id="sweetener" value="${escapeHtml(data.sweetener||'')}" placeholder="es. senza zucchero, 1 cucchiaino, stevia…">
  ${[['breakfast','Colazione','🥐'],['snack1','Spuntino mattina','🍎'],['lunch','Pranzo','🍝'],['snack2','Spuntino pomeriggio','🍎'],['dinner','Cena','🍽️'],['notes','Sport / Note','🏃']].map(([k,l,i])=>`<label>${i} ${l}</label><textarea id="${k}" placeholder="Scrivi liberamente…">${data[k]||''}</textarea>`).join('')}
  <div class="day-calorie-preview">
    <span>Calorie stimate della giornata</span>
    <b>${dayEstimatedCalories(data)?dayEstimatedCalories(data)+' kcal':'Saranno calcolate al salvataggio'}</b>
    <small>Se la giornata è parziale, la stima considera solo ciò che è stato inserito. Modificando la giornata, il valore viene ricalcolato.</small>
  </div>
  <div class="form-actions"><button class="primary" onclick="saveDay()" ${targetExists?'disabled':''}>${duplicateDraft?'Salva copia':isEdit?'Aggiorna giornata':'Salva giornata'}</button>${isEdit?`<button class="secondary" onclick="startDuplicate()">⧉ Duplica giornata</button>`:''}</div></section>`;
}


function profilePage(){
  const p=loadProfile();
  const last=weighted().at(-1);
  const currentBmi=p.height&&last?bmiFor(last.weight,p.height):null;
  const sexLabel=p.sex==='M'?'Maschile':p.sex==='F'?'Femminile':p.sex==='X'?'Altro / preferisco non specificare':'—';

  return `<div class="page-title"><button class="back" onclick="go('home')">‹</button><div><div class="eyebrow">DATI PERSONALI</div><h1>Profilo</h1></div></div>

  <section class="card">
    <div class="section-head"><h2>Profilo gestito dal professionista</h2></div>
    <p class="muted">I dati anagrafici e i parametri del percorso sono gestiti dal professionista. Se qualcosa non è corretto, segnalalo durante la visita.</p>
  </section>

  <section class="card">
    <h2>Dati personali</h2>
    <div class="profile-read-grid">
      <div><span>Nome</span><b>${escapeHtml(p.name||'—')}</b></div>
      <div><span>Cognome</span><b>${escapeHtml(p.surname||'—')}</b></div>
      <div><span>Data di nascita</span><b>${p.birth?fmtShort(p.birth):'—'}</b></div>
      <div><span>Sesso</span><b>${sexLabel}</b></div>
      <div><span>Altezza</span><b>${p.height?p.height+' cm':'—'}</b></div>
      <div><span>Peso obiettivo</span><b>${p.goal?p.goal+' kg':'—'}</b></div>
      <div><span>Prossima visita</span><b>${nextPatientVisit(p)?fmtShort(nextPatientVisit(p)):'—'}</b></div>
    </div>
  </section>

  <section class="card">
    <h2>Storia del peso</h2>
    <div class="profile-read-grid">
      <div><span>Peso minimo storico</span><b>${p.minWeight?p.minWeight+' kg':'—'}</b></div>
      <div><span>Peso massimo storico</span><b>${p.maxWeight?p.maxWeight+' kg':'—'}</b></div>
      <div><span>Peso ragionevole / concordato</span><b>${p.reasonableWeight?p.reasonableWeight+' kg':'—'}</b></div>
      <div><span>BMI attuale</span><b>${currentBmi?currentBmi.toFixed(1).replace('.',','):'—'}</b></div>
    </div>
  </section>

  <section class="card">
    <h2>Stile di vita</h2>
    <div class="profile-read-grid">
      <div><span>Attività lavorativa</span><b>${escapeHtml(p.work||'—')}</b></div>
      <div><span>Attività fisica abituale</span><b>${escapeHtml(p.activity||'—')}</b></div>
      <div><span>Fumo</span><b>${escapeHtml(p.smoking||'—')}</b></div>
      <div><span>Alcol</span><b>${escapeHtml(p.alcohol||'—')}</b></div>
    </div>
  </section><details class="patient-section"><summary>Anamnesi e obiettivi</summary><div class="profile-read-grid section-body"><div><span>Diagnosi / motivo</span><b>${escapeHtml(p.diagnosis||'—')}</b></div><div><span>Alvo</span><b>${escapeHtml(p.bowel||'—')}</b></div><div><span>Diete pregresse</span><b>${escapeHtml(p.previousDiets||'—')}</b></div><div><span>Allergie / intolleranze</span><b>${escapeHtml(p.allergies||'—')}</b></div><div><span>Farmaci</span><b>${escapeHtml(p.medications||'—')}</b></div><div><span>Disturbi gastrointestinali</span><b>${escapeHtml(p.giIssues||'—')}</b></div><div><span>Patologie / interventi</span><b>${escapeHtml(p.pastConditions||'—')}</b></div><div><span>Osservazioni</span><b>${escapeHtml(p.observations||'—')}</b></div><div><span>Obiettivi</span><b>${escapeHtml(p.objectives||'—')}</b></div></div></details>`;
}
function mergedMeasures(){
  const diary=sorted();
  const measures=loadMeasures();
  const dates=new Set([
    ...diary.filter(x=>x.weight!=='').map(x=>x.date),
    ...measures.map(x=>x.date)
  ]);
  return [...dates].sort().map(date=>{
    const d=diary.find(x=>x.date===date)||{};
    const m=measures.find(x=>x.date===date)||{};
    return {
      date,
      weight:d.weight??'',
      waist:m.waist??'',
      hips:m.hips??'',
      notes:m.notes??''
    };
  });
}

function visibleMeasures(){
  const rows=mergedMeasures();
  return measuresCompleteOnly ? rows.filter(r=>r.waist!==''&&r.hips!=='') : rows;
}

function measuresPage(){
  const p=loadProfile();
  const allRows=mergedMeasures();
  const completeCount=allRows.filter(r=>r.waist!==''&&r.hips!=='').length;
  const weightCount=allRows.filter(r=>r.weight!=='').length;
  const rows=visibleMeasures().slice().reverse();

  return `<div class="hero-title"><div><div class="eyebrow">EVOLUZIONE CORPOREA</div><h1>Misurazioni</h1></div><button class="pdf-btn" onclick="exportMeasuresPDF()">PDF</button></div>
  <section class="card">
    <div class="section-head"><h2>Nuova misurazione</h2><span class="pill">Facoltativa</span></div>
    <label>Data</label><div class="date-entry"><input id="measureDate" inputmode="numeric" placeholder="GG-MM-AAAA" value="${isoToItalianDate(isoToday())}"><label class="date-picker-btn">📅<input id="measureDatePicker" type="date" value="${isoToday()}" onchange="document.getElementById('measureDate').value=isoToItalianDate(this.value)"></label></div>
    <div class="measure-grid">
      <div><label>Vita (cm)</label><input id="measureWaist" inputmode="decimal" placeholder="es. 105"></div>
      <div><label>Fianchi (cm)</label><input id="measureHips" inputmode="decimal" placeholder="es. 112"></div>
    </div>
    <label>Note</label><textarea id="measureNotes" rows="2" placeholder="Note sulla misurazione"></textarea>
    <div class="measure-actions">
      <button class="secondary" id="deleteMeasureBtn" onclick="deleteMeasureForm()" style="display:none">Elimina misurazione</button>
      <button class="primary" onclick="saveMeasureForm()">Salva misurazione</button>
    </div>
    <p class="muted measure-note">Il peso non si inserisce qui: viene recuperato automaticamente dal Diario della stessa data. Se correggi il peso nel Diario, si aggiorna anche qui.</p>
  </section>

  <section class="card">
    <div class="section-head"><h2>Storico misurazioni</h2><span class="pill">${completeCount} complete · ${weightCount} pesate</span></div>
    <label class="measure-filter">
      <input type="checkbox" ${measuresCompleteOnly?'checked':''} onchange="measuresCompleteOnly=this.checked;render()">
      <span>Visualizza solo misurazioni complete</span>
    </label>
    <p class="muted filter-help">${measuresCompleteOnly?'Sono mostrate solo le date con Vita e Fianchi compilati. Anche il PDF userà questo filtro.':'Sono mostrate tutte le pesate e le eventuali circonferenze. Anche il PDF userà questa vista.'}</p>
    <div class="measure-table-wrap">
      <table class="measure-table">
        <thead><tr><th>Data</th><th>Peso</th><th>BMI</th><th>Vita</th><th>Fianchi</th><th>Note</th></tr></thead>
        <tbody>
          ${rows.map(r=>`<tr onclick="editMeasure('${r.date}')"><td>${fmtShort(r.date)}</td><td>${r.weight!==''?kg(r.weight):'—'}</td><td>${r.weight!==''&&p.height?bmiFor(r.weight,p.height).toFixed(1).replace('.',','):'—'}</td><td>${r.waist!==''?String(r.waist).replace('.',',')+' cm':'—'}</td><td>${r.hips!==''?String(r.hips).replace('.',',')+' cm':'—'}</td><td>${escapeHtml(r.notes||'')}</td></tr>`).join('') || `<tr><td colspan="6" class="empty-cell">Nessuna misurazione da mostrare.</td></tr>`}
        </tbody>
      </table>
    </div>
  </section>`;
}
window.saveMeasureForm=()=>{
  const date=italianDateToIso($('#measureDate')?.value);
  if(!date)return alert('Inserisci la data.');
  const parse=id=>{
    const v=($(id)?.value||'').trim().replace(',','.');
    return v===''?'':Number(v);
  };
  const waist=parse('#measureWaist');
  const hips=parse('#measureHips');
  const notes=($('#measureNotes')?.value||'').trim();
  if(waist!==''&&(!Number.isFinite(waist)||waist<30||waist>250))return alert('Controlla la circonferenza vita.');
  if(hips!==''&&(!Number.isFinite(hips)||hips<30||hips>250))return alert('Controlla la circonferenza fianchi.');
  let arr=loadMeasures().filter(x=>x.date!==date);
  arr.push({date,waist,hips,notes});
  saveMeasures(arr.sort((a,b)=>a.date.localeCompare(b.date)));
  render();
  alert('Misurazione salvata.');
};

window.editMeasure=date=>{
  const m=loadMeasures().find(x=>x.date===date)||{};
  $('#measureDate').value=isoToItalianDate(date);
  $('#measureWaist').value=m.waist??'';
  $('#measureHips').value=m.hips??'';
  $('#measureNotes').value=m.notes??'';
  const btn=$('#deleteMeasureBtn');
  if(btn)btn.style.display='inline-flex';
  scrollTo({top:0,behavior:'smooth'});
};

function makeMeasuresPdfBlob(){
  const p=loadProfile();
  const rows=visibleMeasures().map(r=>[
    fmtShort(r.date),
    r.weight!==''&&r.weight!=null?Number(r.weight).toFixed(1).replace('.',','):'',
    r.weight!==''&&p.height?bmiFor(r.weight,p.height).toFixed(1).replace('.',','):'',
    r.waist!==''&&r.waist!=null?Number(r.waist).toFixed(1).replace('.',','):'',
    r.hips!==''&&r.hips!=null?Number(r.hips).toFixed(1).replace('.',','):'',
    r.notes||''
  ]);

  const headers=['Data','Peso (kg)','BMI','Vita (cm)','Fianchi (cm)','Note'];
  const widths=[70,70,60,75,85,390];
  const x0=22,pageW=842,pageH=595,top=525,bottom=28;
  const fontSize=7,lineH=9,pad=4;
  let pages=[],current=[],y=top;

  function prepareRow(cells,isHeader=false){
    const wrapped=cells.map((c,i)=>wrapCell(c,Math.max(4,Math.floor((widths[i]-pad*2)/(fontSize*.50)))));
    const lines=Math.max(...wrapped.map(a=>a.length));
    const h=Math.max(isHeader?23:19,lines*lineH+pad*2);
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
    const pr=prepareRow(row,false);
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
    const title=p.name?`Misurazioni - ${p.name}`:'Misurazioni';
    const filterLabel=measuresCompleteOnly?'Solo misurazioni complete':'Tutte le rilevazioni';
    const detail=[
      p.height?`Altezza: ${p.height} cm`:'',
      p.goal?`Obiettivo: ${Number(p.goal).toFixed(1).replace('.',',')} kg`:'',
      rows.length?`Periodo: ${rows[0][0]} / ${rows.at(-1)[0]}`:'',
      filterLabel
    ].filter(Boolean).join('   ');

    stream+=`BT /F2 13 Tf 22 566 Td (${pdfEscape(title)}) Tj ET\n`;
    if(detail)stream+=`BT /F1 7 Tf 22 550 Td (${pdfEscape(detail)}) Tj ET\n`;

    items.forEach(item=>{
      let x=x0,yBottom=item.y;
      item.wrapped.forEach((cellLines,i)=>{
        const w=widths[i];
        if(item.isHeader)stream+=`0.91 0.96 0.96 rg ${x} ${yBottom} ${w} ${item.h} re f 0 0 0 rg\n`;
        stream+=`0.72 G 0.35 w ${x} ${yBottom} ${w} ${item.h} re S 0 G\n`;
        cellLines.forEach((line,li)=>{
          const ty=yBottom+item.h-pad-fontSize-li*lineH;
          if(ty>yBottom+1)stream+=`BT /${item.isHeader?'F2':'F1'} ${fontSize} Tf ${x+pad} ${ty} Td (${pdfEscape(line)}) Tj ET\n`;
        });
        x+=w;
      });
    });

    stream+=`BT /F1 6 Tf 760 12 Td (Pagina ${pageIndex+1}/${pages.length}) Tj ET\n`;
    const contentId=add(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
    const pageId=add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[pagesObj-1]=`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] >>`;
  const catalog=add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);

  let pdf='%PDF-1.4\n%Measurements\n',offsets=[0];
  objects.forEach((obj,i)=>{
    offsets[i+1]=pdf.length;
    pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;
  });

  const xref=pdf.length;
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([pdf],{type:'application/pdf'});
}


window.deleteMeasureForm=()=>{
  const date=$('#measureDate')?.value;
  if(!date)return alert('Seleziona prima una misurazione da eliminare.');
  const existing=loadMeasures().find(x=>x.date===date);
  if(!existing)return alert('Per questa data non ci sono misurazioni da eliminare.');
  if(!confirm(`Eliminare la misurazione del ${fmtShort(date)}?`))return;
  const arr=loadMeasures().filter(x=>x.date!==date);
  saveMeasures(arr);
  render();
  alert('Misurazione eliminata.');
};

window.exportMeasuresPDF=()=>{
  const rows=visibleMeasures();
  if(!rows.length)return alert(measuresCompleteOnly?'Nessuna misurazione completa da esportare.':'Nessuna misurazione da esportare.');
  const blob=makeMeasuresPdfBlob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`Misurazioni_${rows[0].date}_${rows.at(-1).date}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
};


function patientAgeYears(birth){
  if(!birth)return null;
  const b=new Date(birth+'T12:00:00'),n=new Date();
  if(Number.isNaN(b.getTime()))return null;
  let a=n.getFullYear()-b.getFullYear();
  if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))a--;
  return a;
}
function patientBmr(){
  const p=loadProfile(),last=weighted().at(-1);
  const w=last?Number(last.weight):null,h=Number(p.height),a=patientAgeYears(p.birth);
  if(!w||!h||a==null||!['M','F'].includes(p.sex))return null;
  return 10*w+6.25*h-5*a+(p.sex==='M'?5:-161);
}

function patientDiaryCalorieSummary(){
  const calorieDays=sorted()
    .map(x=>({date:x.date,calories:dayEstimatedCalories(x)}))
    .filter(x=>x.calories);
  const last=calorieDays.at(-1);
  const bmr=patientBmr();
  return `<section class="card diary-calorie-card">
    <div class="section-head"><h2>Calorie dal diario</h2><span class="pill">Stima</span></div>
    <div class="calorie-summary-grid">
      <div><span>Ultima giornata</span><b>${last?last.calories+' kcal':'—'}</b><small>${last?fmtShort(last.date):'Nessun dato interpretabile'}</small></div>
      <div><span>BMR senza attività</span><b>${bmr?Math.round(bmr)+' kcal/giorno':'—'}</b><small>${bmr?'Metabolismo basale stimato':'Servono peso, altezza, nascita e sesso'}</small></div>
    </div>
    <p class="muted calorie-disclaimer">Le calorie del diario sono indicative e dipendono dalle quantità e dagli alimenti descritti.</p>
  </section>`;
}

function trend(){
  let all=weighted(),first=all[0],last=all.at(-1),delta=first&&last?(+last.weight)-(+first.weight):null;
  const p=loadProfile();
  const currentBmi=last&&p.height?bmiFor(last.weight,p.height):null;
  const q=historySearch.trim().toLowerCase();
  const history=sorted().reverse().filter(x=>!q||[x.date,x.breakfast,x.snack1,x.lunch,x.snack2,x.dinner,x.notes,x.sweetener,String(x.weight),String(x.coffee)].join(' ').toLowerCase().includes(q));
  return `<div class="hero-title"><div><div class="eyebrow">STATISTICHE</div><h1>Andamento</h1></div><button class="pdf-btn" onclick="exportPDF()">PDF</button></div>
  
  ${patientDiaryCalorieSummary()}
  <section class="card chart-card"><div class="section-head"><h2>Peso</h2><label class="toggle"><input type="checkbox" ${showMovingAverage?'checked':''} onchange="showMovingAverage=this.checked;render()"><span>Media 7 gg</span></label></div><div class="tabs">${[[7,'7 giorni'],[30,'30 giorni'],[90,'3 mesi'],[0,'Tutto']].map(([n,l])=>`<button class="${trendDays===n?'active':''}" onclick="trendDays=${n};render()">${l}</button>`).join('')}</div>${chart(all,trendDays)}</section>
  <section class="card summary"><div class="section-head"><h2>Riepilogo peso</h2><span class="pill">Totale</span></div>${first?`<div class="stats"><div><span>Peso iniziale</span><b>${kg(first.weight)}</b></div><div><span>Ultimo peso</span><b>${kg(last.weight)}</b></div><div><span>Variazione</span><b class="${delta<0?'good':delta>0?'up':''}">${delta>0?'+':''}${delta.toFixed(1).replace('.',',')} kg</b></div></div>`:'<p class="muted">Nessun dato.</p>'}</section>
  <section class="card chart-card"><div class="section-head"><h2>BMI</h2>${currentBmi?`<span class="pill">${currentBmi.toFixed(1).replace('.',',')} · ${bmiLabel(currentBmi)}</span>`:'<span class="pill">Profilo</span>'}</div><div class="tabs">${[[7,'7 giorni'],[30,'30 giorni'],[90,'3 mesi'],[0,'Tutto']].map(([n,l])=>`<button class="${bmiDays===n?'active':''}" onclick="bmiDays=${n};render()">${l}</button>`).join('')}</div>${bmiChart(all,bmiDays)}</section>
  <section class="card"><div class="section-head"><h2>Storico</h2><div class="head-actions"><button class="mini" onclick="showImport()">↑ Importa storico</button><button class="mini" onclick="exportBackup()">↓ Backup</button><button class="mini" onclick="document.getElementById('backupFile').click()">↑ Ripristina</button><input id="backupFile" type="file" accept=".json,application/json" style="display:none" onchange="restoreBackup(event)"><button class="mini" onclick="exportPDF()">↓ Esporta PDF</button></div></div>
  <div class="search-wrap"><input id="historySearch" type="search" placeholder="Cerca nello storico…" value="${escapeHtml(historySearch)}" oninput="historySearch=this.value;renderPreserveSearch()"></div>
  ${history.map(x=>`<div class="listitem" onclick="edit('${x.date}')"><span><b>${fmtShort(x.date)}</b><small>${fmt(x.date).split(' ')[0]}</small></span><div class="history-right"><b>${kg(x.weight)}</b>${p.height&&x.weight!==''?`<small>BMI ${bmiFor(x.weight,p.height).toFixed(1).replace('.',',')}</small>`:''}${dayEstimatedCalories(x)?`<small>${dayEstimatedCalories(x)} kcal stimate</small>`:''}</div></div>`).join('')||'<p class="muted">Nessuna giornata trovata.</p>'}</section>`;
}
window.renderPreserveSearch=()=>{
  const pos=document.scrollingElement?.scrollTop||0;
  const val=$('#historySearch')?.value||historySearch;
  historySearch=val;
  render();
  requestAnimationFrame(()=>{window.scrollTo(0,pos);const el=$('#historySearch');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}});
};


function showImport(){
  importText='';
  importPreview=null;
  page='import';
  render();
  scrollTo(0,0);
}

function importPage(){
  const preview=importPreview;
  return `<div class="page-title"><button class="back" onclick="cancelImport()">‹</button><div><div class="eyebrow">CARICAMENTO DATI</div><h1>Importa storico</h1></div></div>
  <section class="card import-card">
    <p class="muted import-help">Apri le Note iOS, seleziona e copia tutta la tabella del diario, poi incollala qui sotto. Puoi includere anche la riga delle intestazioni.</p>
    <label for="historyImport">Storico da Note iOS</label>
    <textarea id="historyImport" class="import-textarea" placeholder="Incolla qui tutto lo storico…">${escapeHtml(importText)}</textarea>
    <div class="import-actions"><button class="secondary" onclick="analyzeImport()">Analizza dati</button>${preview&&preview.validRows.length?'<button class="primary" onclick="confirmImport()">Importa '+preview.validRows.length+' giornate</button>':''}</div>
    ${preview?importPreviewHtml(preview):''}
  </section>
  <section class="card"><h2>Come vengono gestiti i dati</h2><p class="muted import-help">Il simbolo <b>/</b> diventa un campo vuoto. Le giornate senza peso vengono conservate. Se una data esiste già, viene aggiornata anziché duplicata. La colonna +/- non viene importata perché il Diario ricalcola automaticamente la variazione.</p></section>`;
}

function escapeHtml(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function parseHistoryText(text){
  const lines=String(text||'').replace(/\r/g,'').split('\n').map(x=>x.trimEnd()).filter(x=>x.trim());
  let start=0;
  if(lines[0] && (/^Giorno[\t;]/i.test(lines[0]) || /^Giorno\s+/i.test(lines[0]))) start=1;
  const validRows=[];
  const errors=[];
  const clean=v=>{v=(v??'').trim();return v==='/'?'':v;};

  for(let i=start;i<lines.length;i++){
    let cols=lines[i].split('\t');
    if(cols.length<10) cols=lines[i].split(';');
    if(cols.length<10){
      errors.push(`Riga ${i+1}: non riconosco le colonne. Verifica che la riga sia stata copiata insieme alla tabella.`);
      continue;
    }
    let [d,weekday,weight,delta,coffee,breakfast,snack1,lunch,snack2,dinner,...notesParts]=cols;
    d=clean(d);
    const m=d.match(/^(\d{1,2})-(\d{1,2})$/);
    if(!m){errors.push(`Riga ${i+1}: data "${d}" non valida.`);continue;}
    let day=+m[1], month=+m[2];
    // Correzione concordata per lo storico 2026: le tre righe finali erano state digitate come settembre.
    if(month===9 && [7,8,9].includes(day)) month=8;
    if(month<1||month>12||day<1||day>31){errors.push(`Riga ${i+1}: data "${d}" non valida.`);continue;}
    const date=`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const w=clean(weight).replace(',','.');
    const c=clean(coffee);
    const row={
      date,
      weight:w===''?'':Number(w),
      coffee:c===''?0:(Number(c)||0),
      breakfast:clean(breakfast),
      snack1:clean(snack1),
      lunch:clean(lunch),
      snack2:clean(snack2),
      dinner:clean(dinner),
      notes:clean(notesParts.join('\t'))
    };
    if(w!==''&&!Number.isFinite(row.weight)){errors.push(`Riga ${i+1}: peso "${weight}" non valido.`);continue;}
    validRows.push(row);
  }
  validRows.sort((a,b)=>a.date.localeCompare(b.date));
  return {validRows,errors,totalLines:Math.max(0,lines.length-start)};
}

function importPreviewHtml(p){
  if(!p.validRows.length){
    return `<div class="import-result bad"><b>Nessuna giornata riconosciuta.</b><span>${p.errors[0]||'Controlla il testo incollato.'}</span></div>`;
  }
  const first=p.validRows[0],last=p.validRows.at(-1);
  return `<div class="import-result ok"><b>${p.validRows.length} giornate riconosciute</b><span>Dal ${fmtShort(first.date)} al ${fmtShort(last.date)}</span><span>${p.validRows.filter(x=>x.weight!=='').length} rilevazioni di peso</span>${p.errors.length?`<span class="import-warn">${p.errors.length} righe da controllare</span>`:'<span>Nessun errore rilevato</span>'}</div>${p.errors.length?`<details class="import-errors"><summary>Mostra righe non riconosciute</summary>${p.errors.slice(0,12).map(x=>`<div>${escapeHtml(x)}</div>`).join('')}</details>`:''}`;
}

window.analyzeImport=()=>{
  const box=$('#historyImport');
  importText=box?box.value:'';
  importPreview=parseHistoryText(importText);
  render();
  setTimeout(()=>$('#historyImport')?.focus(),0);
};

window.confirmImport=()=>{
  if(!importPreview||!importPreview.validRows.length)return alert('Prima analizza i dati da importare.');
  const current=load();
  const byDate=new Map(current.map(x=>[x.date,x]));
  let inserted=0,updated=0;
  for(const row of importPreview.validRows){
    if(byDate.has(row.date))updated++;else inserted++;
    byDate.set(row.date,row);
  }
  const merged=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const ok=confirm(`Importare ${importPreview.validRows.length} giornate?\n\nNuove: ${inserted}\nDa aggiornare: ${updated}\nTotale dopo l'importazione: ${merged.length}`);
  if(!ok)return;
  save(merged);
  importText='';importPreview=null;
  page='trend';editDate=null;duplicateDraft=null;duplicateSource=null;
  render();scrollTo(0,0);
  alert(`Importazione completata. ${merged.length} giornate presenti nel Diario.`);
};

window.cancelImport=()=>{importText='';importPreview=null;page='trend';render();scrollTo(0,0)};


function exportBackup(){
  const entries=load();
  const payload={
    app:"Diario",
    version:1,
    exportedAt:new Date().toISOString(),
    profile:loadProfile(),
    measurements:loadMeasures(),
    entries:entries
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  const today=new Date().toISOString().slice(0,10);
  a.href=url;
  a.download=`diario-backup-${today}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function restoreBackup(event){
  const file=event.target.files && event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const parsed=JSON.parse(reader.result);
      const entries=Array.isArray(parsed)?parsed:parsed.entries;
      const profile=Array.isArray(parsed)?null:parsed.profile;
      const measurements=Array.isArray(parsed)?null:parsed.measurements;
      if(!Array.isArray(entries))throw new Error("Formato backup non valido");
      const valid=entries.every(x=>x && typeof x.date==="string");
      if(!valid)throw new Error("Il file non contiene giornate valide");
      const ok=confirm(`Ripristinare ${entries.length} giornate?\n\nI dati attualmente presenti nel Diario verranno sostituiti.`);
      if(!ok)return;
      save(entries.sort((a,b)=>a.date.localeCompare(b.date)));
      if(profile&&typeof profile==='object')saveProfile(profile);
      if(Array.isArray(measurements))saveMeasures(measurements);
      editDate=null;
      duplicateDraft=null;
      duplicateSource=null;
      page="trend";
      render();
      alert(`Ripristino completato: ${entries.length} giornate caricate.`);
    }catch(err){
      alert("Impossibile ripristinare il backup: "+err.message);
    }finally{
      event.target.value="";
    }
  };
  reader.readAsText(file);
}


function loginPage(){return `<div class="login-shell"><section class="card login-card"><div class="eyebrow">AREA PAZIENTE · DEMO</div><h1>Accedi al diario</h1><p class="muted">Usa le credenziali create dal professionista. Nella demo sono memorizzate solo sul dispositivo.</p><label>Username</label><input id="loginUser" autocomplete="username"><label>Password</label><input id="loginPass" type="password" autocomplete="current-password"><button class="primary" onclick="patientLogin()">Accedi</button><a href="./index.html" class="mini" style="display:inline-block;margin-top:12px">Cambia area</a></section></div>`}
window.patientLogin=()=>{const u=($('#loginUser')?.value||'').trim().toLowerCase(),pw=$('#loginPass')?.value||'';const f=Object.entries(accountMap()).find(([id,a])=>a&&a.active!==false&&String(a.username||'').toLowerCase()===u&&String(a.password||'')===pw);if(!f)return alert('Credenziali non valide.');localStorage.setItem(ACTIVE_PATIENT_KEY,f[0]);page='home';render()};
window.patientLogout=()=>{localStorage.removeItem(ACTIVE_PATIENT_KEY);page='home';render()};

function render(){
  const ac=accountMap(),id=activePatientId();if(Object.keys(ac).length&&(!id||!ac[id]||ac[id].active===false)){$('#app').innerHTML=loginPage();return}
  $('#app').innerHTML=page==='home'?home():page==='add'?add():page==='import'?importPage():page==='profile'?profilePage():page==='measures'?measuresPage():trend();
  const appRoot=$('#app');
  if(!document.getElementById('patient-profile-read-style')){
    const st=document.createElement('style');
    st.id='patient-profile-read-style';
    st.textContent='.profile-read-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.profile-read-grid>div{padding:12px;border:1px solid #e5ecee;border-radius:14px;background:#fff}.profile-read-grid span,.profile-read-grid b{display:block}.profile-read-grid span{font-size:12px;color:#71818a}.profile-read-grid b{margin-top:4px}@media(max-width:650px){.profile-read-grid{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }
  if(appRoot){
    appRoot.insertAdjacentHTML('afterbegin',`<div style="display:flex;justify-content:flex-end;margin:0 0 10px">
      ${Object.keys(accountMap()).length?'<button class="mini" onclick="patientLogout()">Esci</button>':''}<a href="./index.html" class="mini">Cambia area</a>
    </div>`);
  }
}

function go(p){
  page=p;
  if(p!=='add'){editDate=null;duplicateDraft=null;duplicateSource=null;} if(p!=='import'){importText='';importPreview=null;}
  render();scrollTo(0,0);
}
window.go=go;
window.newDay=()=>{editDate=isoToday();duplicateDraft=null;duplicateSource=null;page='add';render();scrollTo(0,0)};
window.cancelEdit=()=>{editDate=null;duplicateDraft=null;duplicateSource=null;page='home';render();scrollTo(0,0)};
window.setCoffee=n=>{coffee=Math.max(0,coffee+n);$('#coffee').textContent=coffee};
window.dateChanged=d=>{
  if(duplicateDraft){duplicateDraft={...formDataFromDOM(),date:d,weight:$('#weight').value.trim()===''?'':Number($('#weight').value.trim().replace(',','.'))};render();return;}
  editDate=d;render();
};
window.manualDateChanged=v=>{const iso=italianDateToIso(v);if(!iso)return alert('Inserisci la data nel formato GG-MM-AAAA.');dateChanged(iso)};
window.pickerDateChanged=iso=>dateChanged(iso);
window.edit=d=>{editDate=d;duplicateDraft=null;duplicateSource=null;page='add';render();scrollTo(0,0)};

window.startDuplicate=()=>{
  let src=formDataFromDOM();
  duplicateSource=src.date;
  let target=isoToday();
  if(target===src.date){let d=new Date(src.date+'T12:00:00');d.setDate(d.getDate()+1);target=d.toISOString().slice(0,10)}
  duplicateDraft={...src,date:target,weight:''};
  editDate=null;
  page='add';render();scrollTo(0,0);
};

window.saveDay=()=>{
  let obj=formDataFromDOM(),date=obj.date;
  if(!date)return alert('Seleziona una data.');
  obj.estimatedCalories=estimateDiaryCalories(obj)||'';
  let a=load(),i=a.findIndex(x=>x.date===date);
  if(duplicateDraft&&i>=0)return alert('Questa data è già registrata. Scegli una data diversa.');
  if(i>=0)a[i]=obj;else a.push(obj);
  save(a);
  const kcal=obj.estimatedCalories;
  editDate=null;duplicateDraft=null;duplicateSource=null;page='home';render();
  if(kcal)alert(`Giornata salvata. Calorie stimate: ${kcal} kcal.`);
};

window.deleteDay=()=>{
  if(!confirm('Eliminare questa giornata?'))return;
  save(load().filter(x=>x.date!==editDate));editDate=null;duplicateDraft=null;duplicateSource=null;page='home';render();
};

function ascii(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[–—]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x20-\x7E]/g,' ')}
function pdfEscape(s){return ascii(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}
function wrapCell(text,maxChars){
  let t=ascii(text).replace(/\s+/g,' ').trim();
  if(!t)return [''];
  let words=t.split(' '),lines=[],line='';
  words.forEach(w=>{let next=line?line+' '+w:w;if(next.length>maxChars&&line){lines.push(line);line=w}else line=next});
  if(line)lines.push(line);
  return lines;
}
function pdfTableData(){
  return sorted().map(x=>[
    fmtShort(x.date),
    x.weight===''||x.weight==null?'':Number(x.weight).toFixed(1).replace('.',','),
    x.coffee===''||x.coffee==null?'':String(x.coffee),
    x.sweetener||'',
    x.breakfast||'',x.snack1||'',x.lunch||'',x.snack2||'',x.dinner||'',x.notes||''
  ]);
}
function makePdfBlob(){
  const rows=pdfTableData();
  const headers=['Data','Peso','Caffe','Zucchero / dolc.','Colazione','Spuntino mattina','Pranzo','Spuntino pomeriggio','Cena','Sport / Note'];
  const widths=[46,38,30,72,88,78,92,78,92,105];
  const x0=22, pageW=842, pageH=595, top=548, bottom=28;
  const fontSize=6.5, lineH=8, pad=3;
  let pages=[],current=[],y=top;

  function prepareRow(cells,isHeader=false){
    let wrapped=cells.map((c,i)=>wrapCell(c,Math.max(4,Math.floor((widths[i]-pad*2)/(fontSize*.50)))));
    let lines=Math.max(...wrapped.map(a=>a.length));
    let h=Math.max(isHeader?22:18,lines*lineH+pad*2);
    return {wrapped,h,isHeader};
  }
  const head=prepareRow(headers,true);
  function newPage(){current=[];pages.push(current);y=top;current.push({...head,y:y-head.h});y-=head.h;}
  newPage();
  rows.forEach(row=>{
    let pr=prepareRow(row,false);
    if(y-pr.h<bottom)newPage();
    current.push({...pr,y:y-pr.h});y-=pr.h;
  });

  let objects=[];
  const add=o=>{objects.push(o);return objects.length};
  let fontRegular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let fontBold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  let pagesObj=add('PAGES_PLACEHOLDER');
  let pageIds=[];

  pages.forEach((items,pageIndex)=>{
    let stream='';
    let title=`Diario alimentare - ${rows.length?rows[0][0]+' / '+rows.at(-1)[0]:'Nessun dato'}`;
    stream+=`BT /F2 11 Tf 22 570 Td (${pdfEscape(title)}) Tj ET\n`;
    items.forEach(item=>{
      let x=x0, yBottom=item.y;
      item.wrapped.forEach((cellLines,i)=>{
        let w=widths[i];
        if(item.isHeader)stream+=`0.91 0.96 0.96 rg ${x} ${yBottom} ${w} ${item.h} re f 0 0 0 rg\n`;
        stream+=`0.72 G 0.35 w ${x} ${yBottom} ${w} ${item.h} re S 0 G\n`;
        cellLines.forEach((line,li)=>{
          let ty=yBottom+item.h-pad-fontSize-li*lineH;
          if(ty>yBottom+1)stream+=`BT /${item.isHeader?'F2':'F1'} ${fontSize} Tf ${x+pad} ${ty} Td (${pdfEscape(line)}) Tj ET\n`;
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
  let catalog=add(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`);
  let pdf='%PDF-1.4\n%Diary\n',offsets=[0];
  objects.forEach((obj,i)=>{offsets[i+1]=pdf.length;pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  let xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=objects.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf],{type:'application/pdf'});
}
window.exportPDF=()=>{
  let days=sorted();if(!days.length)return alert('Non ci sono giornate da esportare.');
  let blob=makePdfBlob(),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`Diario_${days[0].date}_${days.at(-1).date}.pdf`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
};
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  if(b.dataset.page==='add')newDay();else go(b.dataset.page);
});
if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');
render();
