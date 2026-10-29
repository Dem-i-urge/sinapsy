/* Дворник · stena-io.js v0.1-draft · 29.10.2026
   Мост между задачей по расписанию «Дворник» и хранилищем стены: всё, что в прогоне считается,
   а не решается, — здесь, чтобы модель не перекладывала поля руками. Сеть не трогает.
   Дом — Dem-i-urge/sinapsy/dvornik/stena/stena-io.js; опубликованный рядом со стеной файл — проекция.

   <db> — папка, куда задача сохранила хранилище стены (ArtifactData list/get с out_dir):
          <db>/log/<id>.json, <db>/meta/params.json, <db>/meta/razbor.json (два последних — если есть).

   node stena-io.js in <db>                                   → stena.json для adapt.js (log, ownerUndated, estimates, params)
   node stena-io.js mode <db> <input.json>                    → JSON {mode, razbor}: «разбор», пока первый разбор завала не закончен (SPEC §6), иначе «понедельник»
   node stena-io.js positions <input.json> <plan.json>        → positions.json понедельника: верхние позиции раскладки (SPEC §5 п. 4)
   node stena-io.js groups <input.json> <plan.json> <projects.json> <db> [групп=4]
                                                              → positions.json разбора: группы по проектам до 25 позиций (SPEC §6)
   node stena-io.js entries <positions.json> <out> [fill.json] → <out>/<id>.json — документы журнала, <out>/writes.json — записи для ArtifactData batch (по 50 за вызов),
                                                                <out>/positions.json — позиции с предложениями модели из fill.json
   node stena-io.js show <positions.json> <input.json>        → текст треда
   node stena-io.js apply <positions.json> <answers.json> <today> [versions.json]
                                                              → changes.json (что писать в Notion) и log-writes.json (ответы в журнал)
   node stena-io.js verify <changes.json> <open-до> <open-после> <done-после>
                                                              → дифф Notion до/после по каждой задаче (финишная черта §7 п. 5)
   node stena-io.js verify-log <db-до> <db-после> <writes.json> → журнал дописан, прежние строки не тронуты (инвариант 7 на живом хранилище)
   Код выхода: 0 — порядок; 1 — сверка не сошлась; 2 — ошибка входа. */
const fs=require("fs"), path=require("path");
const MAP="https://claude.ai/artifact/NNPSJnwn5hP9fDbi4SdsPv";
const J=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const W=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,1));
const day=s=>s?String(s).slice(0,10):null;
const hex=u=>{const m=String(u||"").replace(/-/g,"").match(/[0-9a-f]{32}/i);return m?m[0].toLowerCase():null};
const docs=dir=>fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith(".json")).map(f=>({...J(path.join(dir,f)),id:path.basename(f,".json")})):[];
const doc=f=>fs.existsSync(f)?J(f):null;
const die=(m,c=2)=>{console.error(m);process.exit(c)};
const openOf=input=>(input.tasks||[]).filter(t=>t.status!=="Done");   // вход движка — только открытые; страховка от чужого входа
const FIELD_SUFFIX={"Плановая дата":"d","Синапс":"s","Трудоёмкость, ч":"h"};
const ANSWERS=["принял","поправил","отклонил","в точку","без даты","снять"];

/* SQL-выгрузка в формате adapt.js: одна строка, поля ¦, строки ‖ */
function rowsOf(file){const d=J(file);const r=(d.results||d)[0];const rows=r.rows?r.rows.split("‖"):[];
  if(+r.n!==rows.length)throw new Error(`${path.basename(file)}: n=${r.n}, строк ${rows.length} — выгрузка неполная`);return rows.map(x=>x.split("¦"))}
const openRows=f=>new Map(rowsOf(f).map(x=>[x[0],{status:x[2]||"Not started",synapse:x[5]||null,hours:x[6]===""?null:+x[6],planned:day(x[8]),deadline:day(x[9])}]));
const doneRows=f=>new Map(rowsOf(f).map(x=>[x[0],{done:day(x[2]),removed:x[3]==="__YES__"}]));

/* ---------- журнал → вход движка ---------- */
function stenaIn(db){
  const log=docs(path.join(db,"log")).sort((a,b)=>(a.date||"").localeCompare(b.date||"")||a.id.localeCompare(b.id));
  const last={}; for(const l of log)last[l.task+"|"+l.field]=l;   // последняя строка по задаче и полю
  const ownerUndated=[], estimates={};
  for(const l of Object.values(last)){
    if(l.field==="Плановая дата"&&l.answer==="без даты")ownerUndated.push(l.task);
    if(l.field==="Трудоёмкость, ч"&&+l.proposed>0&&["принял","поправил",null,undefined].includes(l.answer))
      estimates[l.task]={hours:l.answer==="поправил"&&+l.final>0?+l.final:+l.proposed,...(l.bg?{bg:l.bg}:{})};
  }
  const params=doc(path.join(db,"meta","params.json"))||{};
  return {log,ownerUndated,estimates,params};
}

/* ---------- режим: разбор завала, пока он не закончен ---------- */
function mode(db,input){
  const r=doc(path.join(db,"meta","razbor.json"));
  if(r&&r.finished)return {mode:"понедельник",razbor:{finished:true,finishedAt:r.finishedAt||null}};
  const open=new Set(openOf(input).map(t=>t.id));
  const candidates=r&&Array.isArray(r.candidates)?r.candidates:
    openOf(input).filter(t=>(t.planned&&day(t.planned)<input.today)||(!t.planned&&!t.deadline)).map(t=>t.id);
  const decided=new Set(docs(path.join(db,"log")).filter(l=>l.mode==="разбор"&&l.answer).map(l=>l.task));
  const left=candidates.filter(id=>open.has(id)&&!decided.has(id));
  return {mode:left.length?"разбор":"понедельник",razbor:{candidates,left:left.length,decided:decided.size,first:!r,
    finished:!left.length,doc:{candidates,startedAt:(r&&r.startedAt)||input.today,finished:!left.length,...(!left.length?{finishedAt:input.today}:{})}}};
}

/* ---------- позиции понедельника (§5 п. 4): перегрузы — справкой, остальное — по номерам ---------- */
function positions(input,plan){
  const T=new Map(plan.tasks.map(t=>[t.id,t]));
  const info=[], items=[];
  for(const p of plan.proposals.top){
    if(!p.field){info.push(p.reason+(p.title?" · «"+p.title+"»":""));continue}
    const t=T.get(p.task)||{};
    items.push({n:items.length+1,task:p.task,title:p.title||t.title,field:p.field,was:p.from||null,proposed:p.to||null,
      slot:p.slot||null,reason:p.reason,sphere:(t.spheres||[])[0]||null,act:p.field==="Плановая дата"&&!p.to?"в точку":"предложение"});
  }
  return {mode:"понедельник",today:plan.today,info,items};
}

/* ---------- позиции разбора (§6): группы по проектам до 25, не больше N групп за заход ---------- */
function groups(input,plan,projects,db,N=4){
  const st=mode(db,input); if(st.mode!=="разбор")return {mode:"понедельник",today:plan.today,info:["разбор завала закончен"],items:[],groups:[]};
  const leftIds=new Set(st.razbor.candidates);
  const decided=new Set(docs(path.join(db,"log")).filter(l=>l.mode==="разбор"&&l.answer).map(l=>l.task));
  const name=new Map(rowsOf(projects).map(x=>[x[0],x[1]]));
  const T=new Map(plan.tasks.map(t=>[t.id,t])), inT=new Map(openOf(input).map(t=>[t.id,t]));
  const by=new Map();
  for(const t of openOf(input)){if(!leftIds.has(t.id)||decided.has(t.id))continue;
    const ph=(t.projects||[]).map(hex).find(Boolean)||null, key=ph||"—";
    if(!by.has(key))by.set(key,{project:ph,name:ph?(name.get(ph)||"проект "+ph.slice(0,6)):"Без проекта",tasks:[]});
    by.get(key).tasks.push(t.id)}
  const sc=id=>(T.get(id)||{}).score||0;
  let gs=[]; for(const g of by.values()){g.tasks.sort((a,b)=>sc(b)-sc(a)||String(inT.get(a).planned||"").localeCompare(String(inT.get(b).planned||"")));
    for(let i=0;i<g.tasks.length;i+=25)gs.push({...g,part:g.tasks.length>25?Math.floor(i/25)+1:null,tasks:g.tasks.slice(i,i+25)})}
  gs.sort((a,b)=>Math.max(...b.tasks.map(sc))-Math.max(...a.tasks.map(sc))||b.tasks.length-a.tasks.length||a.name.localeCompare(b.name));
  const take=gs.slice(0,N), items=[];
  for(const [gi,g] of take.entries())for(const id of g.tasks){const t=T.get(id)||{}, it=inT.get(id), pl=plan.placements[id]||{};
    const date=pl.where==="day"?pl.date:null, slot=pl.where==="day"?pl.date:pl.where==="none"?"без даты":(pl.where==="week"?"неделя с ":"месяц с ")+pl.start;
    items.push({n:items.length+1,group:gi+1,task:id,title:it.title,field:"Плановая дата",was:day(it.planned),proposed:date,slot,
      act:date?"планировать":"в точку",reason:it.planned?"плановая дата прошла":"без дат",sphere:(it.spheres||[])[0]||null})}
  // точка группой (карточка «Дворник v0.1»): задачам группы без точки — одна точка на всю группу, номер «Г<группа>»
  for(const [gi,g] of take.entries()){const free=g.tasks.filter(id=>!(T.get(id)||{}).node);
    for(const id of free)items.push({n:"Г"+(gi+1),group:gi+1,task:id,title:inT.get(id).title,field:"Синапс",was:null,proposed:null,
      act:"точка группой",reason:`без точки: ${free.length} из ${g.tasks.length} в группе`,sphere:(inT.get(id).spheres||[])[0]||null})}
  return {mode:"разбор",today:plan.today,info:[`разбор завала: осталось ${st.razbor.left} из ${st.razbor.candidates.length}, групп всего ${gs.length}, в этом заходе ${take.length}`],
    groups:take.map((g,i)=>({group:i+1,name:g.name+(g.part?` (часть ${g.part})`:""),project:g.project,n:g.tasks.length})),items,razborDoc:st.razbor.first?st.razbor.doc:null};
}

/* ---------- документы журнала и пакет записи ---------- */
function entries(pos,out,fill){
  fs.mkdirSync(out,{recursive:true});
  const stamp=pos.today.replace(/-/g,""), writes=[], seen=new Set();
  for(const it of pos.items){
    if(fill&&fill[it.n]!=null&&fill[it.n]!==""&&it.proposed==null&&it.field!=="Плановая дата")it.proposed=it.field==="Трудоёмкость, ч"?+fill[it.n]:String(fill[it.n]);
    it.id=`${it.task}-${stamp}-${FIELD_SUFFIX[it.field]}`;
    if(seen.has(it.id))throw new Error("две позиции с одним id журнала: "+it.id); seen.add(it.id);
    const d={task:it.task,date:pos.today,field:it.field,proposed:it.proposed,was:it.was,answer:null,final:null,sphere:it.sphere,mode:pos.mode,n:it.n,act:it.act};
    const f=path.join(out,it.id+".json"); W(f,d); writes.push({op:"set",collection:"log",doc_id:it.id,file_path:path.resolve(f)});
  }
  W(path.join(out,"writes.json"),writes); W(path.join(out,"positions.json"),pos);
  return {n:writes.length};
}

/* ---------- текст треда ---------- */
function show(pos,input){
  const node=new Map((input.nodes||[]).map(n=>[n.id,n.title]));
  const D=s=>s?s.slice(8,10)+"."+s.slice(5,7):"—";
  const line=it=>{const head=`${it.n}. «${it.title}»`;
    if(it.field==="Плановая дата")return `${head}: ${D(it.was)} → ${it.proposed?D(it.proposed):"в точку ("+(it.slot||"дальний горизонт")+")"} — ${it.reason}`;
    if(it.field==="Трудоёмкость, ч")return `${head}: часы — ${it.proposed!=null?"предлагаю "+it.proposed+" ч":"оцени"} — ${it.reason}`;
    if(it.field==="Синапс")return `${head}: точка — ${it.proposed?"«"+(node.get(it.proposed)||it.proposed)+"»":"не нашёл, подскажи"} — ${it.reason}`;
    return head};
  const out=[...pos.info];
  if(pos.mode==="разбор")for(const g of pos.groups){out.push("",`Группа ${g.group} · ${g.name} · ${g.n}`);
    for(const it of pos.items.filter(i=>i.group===g.group&&typeof i.n==="number"))out.push(line(it));
    const gs=pos.items.filter(i=>i.group===g.group&&i.n==="Г"+g.group);
    if(gs.length)out.push(`Г${g.group}. Точка для ${gs.length} задач группы без точки: ${gs[0].proposed?"«"+(node.get(gs[0].proposed)||gs[0].proposed)+"»":"не нашёл, подскажи"}`)}
  else{if(pos.items.length)out.push("");for(const it of pos.items)out.push(line(it))}
  return out.join("\n");
}

/* ---------- ответы владельца → правки Notion и строки журнала ---------- */
function apply(pos,ans,today,versions){
  const changes=[], logWrites=[], bad=[];
  for(const it of pos.items){
    let a=(ans.items||{})[it.n], byDefault=false; if(a==null){a=ans.default||null;byDefault=true} if(a==null)continue;
    if(typeof a==="string")a={answer:a};
    // «да всё» не принимает того, чего не предлагалось: часы и точка без предложения ждут явного ответа
    if(byDefault&&a.answer==="принял"&&it.proposed==null&&it.field!=="Плановая дата")continue;
    if(!ANSWERS.includes(a.answer)){bad.push(it.n+": непонятный ответ «"+a.answer+"»");continue}
    let set=null, final=null;
    if(a.answer==="снять"){set={"Статус":"Done","Дата выполнения":today,"Снято":true}}
    else if(it.field==="Плановая дата"){
      if(a.answer==="принял")final=it.proposed;
      else if(a.answer==="поправил"){if(!/^\d{4}-\d\d-\d\d$/.test(a.value||"")){bad.push(it.n+": дата не ГГГГ-ММ-ДД");continue}final=a.value}
      else if(a.answer==="в точку"||a.answer==="без даты")final=null;
      if(a.answer!=="отклонил")set={"Плановая дата":final};
    }else if(it.field==="Трудоёмкость, ч"){
      if(a.answer==="принял"){if(it.proposed==null){bad.push(it.n+": принимать нечего — часов не предлагалось");continue}final=+it.proposed}
      else if(a.answer==="поправил"){if(!(+a.value>0)){bad.push(it.n+": часы не число");continue}final=+a.value}
      else if(a.answer!=="отклонил"){bad.push(it.n+": для часов ответ «"+a.answer+"» не подходит");continue}
      if(final!=null)set={"Трудоёмкость, ч":final};
    }else if(it.field==="Синапс"){
      const id=a.answer==="поправил"?String(a.value||""):a.answer==="принял"?it.proposed:null;
      if((a.answer==="принял"||a.answer==="поправил")&&!id){bad.push(it.n+": точки нет");continue}
      if(id){final=id;set={"Синапс":MAP+"#"+id}}
      else if(a.answer!=="отклонил"){bad.push(it.n+": для точки ответ «"+a.answer+"» не подходит");continue}
    }
    if(set){const prev=changes.find(c=>c.task===it.task);if(prev)Object.assign(prev.set,set),prev.n.push(it.n);else changes.push({task:it.task,title:it.title,n:[it.n],set})}
    const w={op:"update",collection:"log",doc_id:it.id,data:{answer:a.answer,final,answeredAt:today}};
    if(versions&&versions[it.id])w.if_version=+versions[it.id];
    logWrites.push(w);
  }
  if(changes.some(c=>"Дедлайн" in c.set))throw new Error("правка дедлайна — запрещено");
  return {changes,logWrites,bad};
}

/* ---------- дифф Notion до/после по каждой задаче ---------- */
function verify(ch,before,after,doneAfter){
  const exp=new Map(ch.changes.map(c=>[c.task,c.set])), bad=[], seen=new Set();
  for(const [id,b] of before){
    const s=exp.get(id), a=after.get(id), d=doneAfter.get(id);
    if(s&&s["Снято"]){if(a)bad.push(`${id}: должна быть снята, а открыта`);else if(!d||!d.removed||d.done!==s["Дата выполнения"])bad.push(`${id}: снятие записано не так (${JSON.stringify(d||null)})`);seen.add(id);continue}
    if(!a){bad.push(`${id}: исчезла из открытых без снятия`);continue}
    const want={...b}; if(s){if("Плановая дата" in s)want.planned=s["Плановая дата"];if("Трудоёмкость, ч" in s)want.hours=s["Трудоёмкость, ч"];if("Синапс" in s)want.synapse=s["Синапс"];seen.add(id)}
    for(const k of ["planned","hours","synapse","deadline","status"])if(String(want[k]??"")!==String(a[k]??""))bad.push(`${id}: ${k} ожидалось «${want[k]??"—"}», стало «${a[k]??"—"}»${s?"":" — правки не было"}`);
  }
  for(const id of exp.keys())if(!seen.has(id))bad.push(`${id}: правка из списка не нашла задачу`);
  return {ok:!bad.length,checked:before.size,changed:exp.size,bad};
}

/* ---------- журнал: прежние строки не тронуты, новые дописаны ---------- */
function verifyLog(dbBefore,dbAfter,writes){
  const strip=o=>{const {id,...r}=o;return JSON.stringify(r,Object.keys(r).sort())};
  const A=new Map(docs(path.join(dbAfter,"log")).map(d=>[d.id,d])), bad=[];
  const B=docs(path.join(dbBefore,"log"));
  for(const b of B){const a=A.get(b.id);if(!a)bad.push(b.id+": прежняя строка пропала");else if(strip(a)!==strip(b))bad.push(b.id+": прежняя строка изменена")}
  for(const w of writes){const a=A.get(w.doc_id);if(!a){bad.push(w.doc_id+": новая строка не записалась");continue}
    if(strip({...J(w.file_path),id:w.doc_id})!==strip(a))bad.push(w.doc_id+": записано не то, что в файле")}
  return {ok:!bad.length,before:B.length,after:A.size,added:writes.length,bad};
}

if(require.main===module){
  const [cmd,...a]=process.argv.slice(2);
  try{
    switch(cmd){
      case "in": process.stdout.write(JSON.stringify(stenaIn(a[0]))); break;
      case "mode": console.log(JSON.stringify(mode(a[0],J(a[1])))); break;
      case "positions": process.stdout.write(JSON.stringify(positions(J(a[0]),J(a[1])),null,1)); break;
      case "groups": process.stdout.write(JSON.stringify(groups(J(a[0]),J(a[1]),a[2],a[3],+(a[4]||4)),null,1)); break;
      case "entries": console.log(JSON.stringify(entries(J(a[0]),a[1],a[2]?J(a[2]):null))); break;
      case "show": console.log(show(J(a[0]),J(a[1]))); break;
      case "apply": {const r=apply(J(a[0]),J(a[1]),a[2],a[3]?J(a[3]):null);W("changes.json",{changes:r.changes});W("log-writes.json",r.logWrites);
        console.log(JSON.stringify({changes:r.changes.length,logWrites:r.logWrites.length,bad:r.bad}));if(r.bad.length)process.exit(1);break}
      case "verify": {const r=verify(J(a[0]),openRows(a[1]),openRows(a[2]),doneRows(a[3]));console.log(JSON.stringify(r,null,1));process.exit(r.ok?0:1)}
      case "verify-log": {const r=verifyLog(a[0],a[1],J(a[2]));console.log(JSON.stringify(r,null,1));process.exit(r.ok?0:1)}
      default: die("команды: in · mode · positions · groups · entries · show · apply · verify · verify-log");
    }
  }catch(e){die("stena-io: "+e.message)}
}
module.exports={stenaIn,mode,positions,groups,entries,show,apply,verify,verifyLog};
