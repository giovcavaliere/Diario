const KEY='diario-v1';
let page='home';
let editDate=null;
let coffee=0;
let trendDays=30;
let duplicateDraft=null;
let duplicateSource=null;

const $=s=>document.querySelector(s);
const load=()=>JSON.parse(localStorage.getItem(KEY)||'[]');
const save=d=>localStorage.setItem(KEY,JSON.stringify(d));
const isoToday=()=>{let d=new Date(),z=d.getTimezoneOffset()*60000;return new Date(d-z).toISOString().slice(0,10)};
const fmt=d=>new Date(d+'T12:00:00').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const fmtShort=d=>new Date(d+'T12:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'});
const kg=v=>Number.isFinite(+v)&&v!==''?`${(+v).toFixed(1).replace('.',',')} kg`:'—';

function sorted(){return load().sort((a,b)=>a.date.localeCompare(b.date))}
function weighted(){return sorted().filter(x=>Number.isFinite(+x.weight)&&x.weight!=='')}

function chart(items,days){
  let w=items.filter(x=>x.weight!=='');
  if(days&&w.length){
    let end=new Date(w.at(-1).date+'T12:00:00');
    let start=new Date(end);start.setDate(end.getDate()-(days-1));
    w=w.filter(x=>new Date(x.date+'T12:00:00')>=start);
  }
  if(!w.length)return '<p class="muted">Nessun peso registrato.</p>';

  let vals=w.map(x=>+x.weight);
  let rawMin=Math.min(...vals),rawMax=Math.max(...vals);
  let pad=Math.max(.5,(rawMax-rawMin)*.12);
  let min=Math.floor((rawMin-pad)*2)/2;
  let max=Math.ceil((rawMax+pad)*2)/2;
  if(max===min)max=min+1;
  let range=max-min;

  const left=14,right=98,top=8,bottom=86;
  let pts=w.map((x,i)=>{
    let xx=w.length===1?(left+right)/2:left+i/(w.length-1)*(right-left);
    let yy=bottom-((+x.weight-min)/range)*(bottom-top);
    return `${xx.toFixed(2)},${yy.toFixed(2)}`;
  }).join(' ');

  let tickCount=5;
  let ticks=Array.from({length:tickCount},(_,i)=>max-(range/(tickCount-1))*i);
  let grid=ticks.map(v=>{
    let y=bottom-((v-min)/range)*(bottom-top);
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid"/><text x="${left-2}" y="${y+1.5}" text-anchor="end" class="chart-y-label">${v.toFixed(1).replace('.',',')}</text>`;
  }).join('');

  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 100 100" preserveAspectRatio="none">${grid}<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" class="chart-axis"/><line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="chart-axis"/><polyline points="${pts}" class="chart-line" fill="none" vector-effect="non-scaling-stroke"/>${w.map((x,i)=>{let xx=w.length===1?(left+right)/2:left+i/(w.length-1)*(right-left);let yy=bottom-((+x.weight-min)/range)*(bottom-top);return `<circle cx="${xx}" cy="${yy}" r="0.55" class="chart-point" vector-effect="non-scaling-stroke"/>`}).join('')}</svg><span class="chart-unit">kg</span></div><div class="chart-dates"><span>${fmt(w[0].date).replace(/^[^ ]+ /,'')}</span><span>${fmt(w.at(-1).date).replace(/^[^ ]+ /,'')}</span></div>`;
}
function home(){
  let w=weighted(),last=w.at(-1),first=w[0];
  let delta=last&&first?(+last.weight)-(+first.weight):null;
  let deltaClass=delta<0?'good':delta>0?'up':'';
  return `<div class="hero-title"><div><div class="eyebrow">IL MIO PERCORSO</div><h1>Diario</h1></div><div class="hero-icon">✓</div></div>
  <section class="card highlight"><div class="muted caps">ULTIMA RILEVAZIONE</div>${last?`<div class="weight">${(+last.weight).toFixed(1).replace('.',',')} <small>kg</small></div><div class="delta ${deltaClass}">${delta>0?'+':''}${delta.toFixed(1).replace('.',',')} kg dall'inizio</div><p class="muted">${fmt(last.date)}</p>`:'<p class="muted">Inserisci la prima giornata per iniziare.</p>'}</section>
  <section class="card chart-card"><div class="section-head"><h2>Ultimi 7 giorni</h2><span class="pill">Peso</span></div>${chart(w,7)}</section>
  <div class="grid actions"><button class="primary" onclick="newDay()">＋ Aggiungi giornata</button><button class="secondary" onclick="go('trend')">📈 Andamento</button></div>`;
}

function formDataFromDOM(){
  let weight=$('#weight')?.value.trim().replace(',','.')??'';
  return {
    date:$('#date')?.value||editDate||isoToday(),
    weight:weight===''?'':Number(weight),
    coffee,
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
  return `<div class="page-title"><button class="back" onclick="cancelEdit()">‹</button><div><div class="eyebrow">${duplicateDraft?'COPIA RAPIDA':isEdit?'REGISTRAZIONE':'NUOVA REGISTRAZIONE'}</div><h1>${duplicateDraft?'Duplica giornata':isEdit?'Modifica giornata':'Aggiungi giornata'}</h1></div></div>
  ${duplicateDraft?`<div class="notice">Stai copiando <b>${fmtShort(duplicateSource)}</b>. Peso escluso: modifica quello che vuoi e salva con una nuova data.</div>`:''}
  <section class="card form-card"><label>Data</label><input id="date" type="date" value="${targetDate}" onchange="dateChanged(this.value)">${targetExists?'<div class="warning">Questa data è già registrata. Scegline un’altra per evitare duplicati.</div>':''}
  <label>Peso (kg)</label><input id="weight" inputmode="decimal" placeholder="es. 115,6" value="${data.weight??''}">
  <label>Caffè</label><div class="coffee"><button onclick="setCoffee(-1)">−</button><strong id="coffee">${coffee}</strong><button onclick="setCoffee(1)">＋</button></div>
  ${[['breakfast','Colazione','🥐'],['snack1','Spuntino mattina','🍎'],['lunch','Pranzo','🍝'],['snack2','Spuntino pomeriggio','🍎'],['dinner','Cena','🍽️'],['notes','Sport / Note','🏃']].map(([k,l,i])=>`<label>${i} ${l}</label><textarea id="${k}" placeholder="Scrivi liberamente…">${data[k]||''}</textarea>`).join('')}
  <div class="form-actions"><button class="primary" onclick="saveDay()" ${targetExists?'disabled':''}>${duplicateDraft?'Salva copia':isEdit?'Aggiorna giornata':'Salva giornata'}</button>${isEdit?`<button class="secondary" onclick="startDuplicate()">⧉ Duplica giornata</button><button class="danger" onclick="deleteDay()">Elimina giornata</button>`:''}</div></section>`;
}

function trend(){
  let all=weighted(),first=all[0],last=all.at(-1),delta=first&&last?(+last.weight)-(+first.weight):null;
  return `<div class="hero-title"><div><div class="eyebrow">STATISTICHE</div><h1>Andamento</h1></div><button class="pdf-btn" onclick="exportPDF()">PDF</button></div>
  <section class="card chart-card"><div class="tabs">${[[7,'7 giorni'],[30,'30 giorni'],[90,'3 mesi'],[0,'Tutto']].map(([n,l])=>`<button class="${trendDays===n?'active':''}" onclick="trendDays=${n};render()">${l}</button>`).join('')}</div>${chart(all,trendDays)}</section>
  <section class="card summary"><div class="section-head"><h2>Riepilogo</h2><span class="pill">Totale</span></div>${first?`<div class="stats"><div><span>Peso iniziale</span><b>${kg(first.weight)}</b></div><div><span>Ultimo peso</span><b>${kg(last.weight)}</b></div><div><span>Variazione</span><b class="${delta<0?'good':delta>0?'up':''}">${delta>0?'+':''}${delta.toFixed(1).replace('.',',')} kg</b></div></div>`:'<p class="muted">Nessun dato.</p>'}</section>
  <section class="card"><div class="section-head"><h2>Storico</h2><div class="head-actions"><button class="mini" onclick="showImport()">↑ Importa storico</button><button class="mini" onclick="exportBackup()">↓ Backup</button><button class="mini" onclick="document.getElementById('backupFile').click()">↑ Ripristina</button><input id="backupFile" type="file" accept=".json,application/json" style="display:none" onchange="restoreBackup(event)"><button class="mini" onclick="exportPDF()">↓ Esporta PDF</button></div></div>${sorted().reverse().map(x=>`<div class="listitem" onclick="edit('${x.date}')"><span><b>${fmtShort(x.date)}</b><small>${fmt(x.date).split(' ')[0]}</small></span><b>${kg(x.weight)}</b></div>`).join('')||'<p class="muted">Nessuna giornata registrata.</p>'}</section>`;
}


function showImport(){
  const text=prompt(`Incolla qui lo storico copiato dalle Note iOS.

Puoi incollare direttamente la tabella con intestazione:
Giorno, gg/sett, Peso, +/-, caffè, Colazione, Spuntino, Pranzo, Spuntino, Cena, Sport/note.

Le righe con "/" vengono importate come campi vuoti.
Le date 07-09, 08-09 e 09-09 vengono corrette automaticamente in agosto 2026.`);
  if(!text)return;
  importHistoryText(text);
}

function importHistoryText(text){
  const lines=text.replace(/\r/g,'').split('\n').map(x=>x.trimEnd()).filter(x=>x.trim());
  if(!lines.length)return alert('Nessun dato trovato.');

  let start=0;
  if(/^Giorno[\t;]/i.test(lines[0]) || /^Giorno\s+/i.test(lines[0])) start=1;

  const current=load();
  const byDate=new Map(current.map(x=>[x.date,x]));
  let imported=0, updated=0, skipped=0, errors=[];

  const clean=v=>{
    v=(v??'').trim();
    return v==='/'?'':v;
  };

  for(let i=start;i<lines.length;i++){
    let cols=lines[i].split('\t');
    if(cols.length<10){
      // fallback for semicolon-separated exports
      cols=lines[i].split(';');
    }
    if(cols.length<10){
      errors.push(`Riga ${i+1}: colonne non riconosciute`);
      continue;
    }

    let [d,weekday,weight,delta,coffee,breakfast,snack1,lunch,snack2,dinner,...notesParts]=cols;
    d=clean(d);
    const m=d.match(/^(\d{1,2})-(\d{1,2})$/);
    if(!m){errors.push(`Riga ${i+1}: data "${d}" non valida`);continue;}

    let day=+m[1], month=+m[2];
    // Correzione concordata per le tre righe finali del diario.
    if(month===9 && [7,8,9].includes(day)) month=8;
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

    if(w!=='' && !Number.isFinite(row.weight)){
      errors.push(`Riga ${i+1}: peso "${weight}" non valido`);
      continue;
    }

    if(byDate.has(date)){ updated++; } else { imported++; }
    byDate.set(date,row);
  }

  const merged=[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
  save(merged);
  page='trend';
  editDate=null;
  duplicateDraft=null;
  duplicateSource=null;
  render();

  let msg=`Importazione completata.\n\nNuove giornate: ${imported}\nGiornate aggiornate: ${updated}\nTotale diario: ${merged.length}`;
  if(errors.length) msg+=`\n\nRighe non importate: ${errors.length}\n${errors.slice(0,5).join('\n')}`;
  alert(msg);
}


function exportBackup(){
  const entries=load();
  const payload={
    app:"Diario",
    version:1,
    exportedAt:new Date().toISOString(),
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
      if(!Array.isArray(entries))throw new Error("Formato backup non valido");
      const valid=entries.every(x=>x && typeof x.date==="string");
      if(!valid)throw new Error("Il file non contiene giornate valide");
      const ok=confirm(`Ripristinare ${entries.length} giornate?\n\nI dati attualmente presenti nel Diario verranno sostituiti.`);
      if(!ok)return;
      save(entries.sort((a,b)=>a.date.localeCompare(b.date)));
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

function render(){
  $('#app').innerHTML=page==='home'?home():page==='add'?add():trend();
}

function go(p){
  page=p;
  if(p!=='add'){editDate=null;duplicateDraft=null;duplicateSource=null;}
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
  let a=load(),i=a.findIndex(x=>x.date===date);
  if(duplicateDraft&&i>=0)return alert('Questa data è già registrata. Scegli una data diversa.');
  if(i>=0)a[i]=obj;else a.push(obj);
  save(a);editDate=null;duplicateDraft=null;duplicateSource=null;page='home';render();
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
    x.breakfast||'',x.snack1||'',x.lunch||'',x.snack2||'',x.dinner||'',x.notes||''
  ]);
}
function makePdfBlob(){
  const rows=pdfTableData();
  const headers=['Data','Peso','Caffe','Colazione','Spuntino mattina','Pranzo','Spuntino pomeriggio','Cena','Sport / Note'];
  const widths=[52,42,36,100,88,105,88,105,118];
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
