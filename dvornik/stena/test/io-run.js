/* Дворник · проверка stena-io.js на подставных данных · v0.1 · 29.10.2026
   node test/io-run.js — полный цикл разбора и понедельника без сети: чистые случаи проходят,
   каждый подброшенный дефект ловится. Выход: 0 — все строки «да», иначе 1. */
const fs=require("fs"), os=require("os"), path=require("path");
const G=require(path.join(__dirname,"../../../graph.js"));
const E=require(path.join(__dirname,"../engine.js"));
const S=require(path.join(__dirname,"../stena-io.js"));
const {input}=require("./fixture.js");
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"dvornik-io-"));
const W=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(x))};
const sql=rows=>({results:[{n:rows.length,rows:rows.join("‖")}]});
const rows=[]; const ok=(name,pass,got="")=>rows.push({name,pass:!!pass,got});
const clone=x=>JSON.parse(JSON.stringify(x));

// вход без журнала: ownerUndated и оценки фикстуры не участвуют — их даст журнал
const inp={...clone(input),log:[],ownerUndated:[],estimates:{}};
inp.tasks.find(t=>t.id.endsWith("05")).projects=["https://app.notion.com/p/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa01"];
const plan=E.plan(inp,G);
const db0=path.join(tmp,"db0"); fs.mkdirSync(db0);
const projects=path.join(tmp,"projects.json"); W(projects,sql(["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa01¦Меркор: паспорта","aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa02¦Продукт"]));

// 1. режим: журнала нет → разбор
const m=S.mode(db0,inp);
ok("пустой журнал → режим «разбор»",m.mode==="разбор"&&m.razbor.first,JSON.stringify({mode:m.mode,left:m.razbor.left}));

// 2. группы: по проектам, ≤25, нумерация сквозная
const g=S.groups(inp,plan,projects,db0,4);
ok("группы разбора собраны",g.items.length>0&&g.groups.every(x=>x.n<=25)&&g.items.filter(it=>typeof it.n==="number").every((it,i)=>it.n===i+1),g.groups.map(x=>x.name+" "+x.n).join(" | "));
ok("в разборе только просроченные и без дат",g.items.every(it=>!it.was||it.was<inp.today));

ok("точка группой — позиции «Г» у задач без точки",g.items.some(it=>it.n==="Г1"&&it.field==="Синапс"),g.items.filter(it=>typeof it.n!=="number").length+" позиций");
ok("текст разбора: строка «Г» одна на группу",(S.show(g,inp).match(/^Г1\./mg)||[]).length===1);

// 3. журнал: документы и пакет; verify-log ловит правку прежней строки и недописанную
const out=path.join(tmp,"out"); S.entries(g,out,{"Г1":"D"});
const writes=JSON.parse(fs.readFileSync(path.join(out,"writes.json")));
const db1=path.join(tmp,"db1"); fs.mkdirSync(path.join(db1,"log"),{recursive:true});
for(const w of writes)fs.copyFileSync(w.file_path,path.join(db1,"log",w.doc_id+".json"));
ok("журнал дописан — сверка чистая",S.verifyLog(db0,db1,writes).ok);
const bad1=path.join(tmp,"db1b"); fs.cpSync(db1,bad1,{recursive:true}); fs.unlinkSync(path.join(bad1,"log",writes[0].doc_id+".json"));
ok("строка не записалась → ловится",!S.verifyLog(db0,bad1,writes).ok);
const db2=path.join(tmp,"db2"); fs.cpSync(db1,db2,{recursive:true});
const f0=path.join(db2,"log",writes[0].doc_id+".json"); W(f0,{...JSON.parse(fs.readFileSync(f0)),proposed:"1999-01-01"});
ok("прежняя строка изменена → ловится",!S.verifyLog(db1,db2,[]).ok);

// 4. ответы: «всё, кроме 2; 3 → 20.11; 4 снять»
const pos=JSON.parse(fs.readFileSync(path.join(out,"positions.json")));
const ans={default:"принял",items:{"2":"отклонил","3":{answer:"поправил",value:"2026-11-20"},"4":"снять"}};
const r=S.apply(pos,ans,inp.today,null);
ok("ответы разобраны без ошибок",!r.bad.length&&r.logWrites.length===pos.items.length,JSON.stringify(r.bad));
ok("отклонённое в Notion не пишется",!r.changes.some(c=>c.n.includes(2)));
ok("снятие = Done + дата + галка",r.changes.find(c=>c.n.includes(4)).set["Снято"]===true);
ok("точка группой легла на все задачи группы",r.changes.filter(c=>c.set["Синапс"]).length===pos.items.filter(i=>i.n==="Г1").length-pos.items.filter(i=>i.n==="Г1"&&r.changes.some(c=>c.task===i.task&&c.set["Снято"])).length);
const posNo=JSON.parse(JSON.stringify(pos)); for(const i of posNo.items)if(i.n==="Г1")i.proposed=null;
ok("«всё» не принимает точку без предложения",!S.apply(posNo,{default:"принял"},inp.today).changes.some(c=>c.set["Синапс"]));
ok("непонятный ответ не проходит",S.apply(pos,{items:{"1":"может быть"}},inp.today).bad.length===1);

// 5. дифф Notion до/после
const T=new Map(inp.tasks.filter(t=>t.status!=="Done").map(t=>[t.id,t]));
const row=t=>[t.id,t.title,t.status,"[]","[]",t.synapse||"",t.hours==null?"":t.hours,"",t.planned||"",t.deadline||"","2026-10-01"].join("¦");
const before=path.join(tmp,"open0.json"); W(before,sql([...T.values()].map(row)));
const aft=clone([...T.values()]), removed=[];
for(const c of r.changes){const t=aft.find(x=>x.id===c.task);
  if(c.set["Снято"]){removed.push(t.id);continue}
  if("Плановая дата" in c.set)t.planned=c.set["Плановая дата"];
  if("Синапс" in c.set)t.synapse=c.set["Синапс"];
  if("Трудоёмкость, ч" in c.set)t.hours=c.set["Трудоёмкость, ч"]}
const after=path.join(tmp,"open1.json"); W(after,sql(aft.filter(t=>!removed.includes(t.id)).map(row)));
const done=path.join(tmp,"done1.json"); W(done,sql(removed.map(id=>[id,"",inp.today,"__YES__","","[]","2026-10-01"].join("¦"))));
const chf=path.join(tmp,"changes.json"); W(chf,{changes:r.changes});
const run=(a,b,c)=>{const cp=require("child_process").spawnSync(process.execPath,[path.join(__dirname,"../stena-io.js"),"verify",chf,a,b,c],{encoding:"utf8"});return {code:cp.status,out:cp.stdout}};
const v1=run(before,after,done); ok("дифф совпал с подтверждённым",v1.code===0,v1.out.slice(0,200));
const extra=clone(aft); const victim=extra.find(t=>!removed.includes(t.id)&&!r.changes.some(c=>c.task===t.id)); victim.planned="2026-12-31";
const after2=path.join(tmp,"open2.json"); W(after2,sql(extra.filter(t=>!removed.includes(t.id)).map(row)));
ok("лишняя правка → ловится",run(before,after2,done).code===1);
const miss=clone(aft); const ch1=r.changes.find(c=>"Плановая дата" in c.set&&!c.set["Снято"]); miss.find(t=>t.id===ch1.task).planned=T.get(ch1.task).planned;
const after3=path.join(tmp,"open3.json"); W(after3,sql(miss.filter(t=>!removed.includes(t.id)).map(row)));
ok("пропущенная правка → ловится",run(before,after3,done).code===1);
const dl=clone(aft); const t6=dl.find(t=>t.deadline); t6.deadline="2026-12-31";
const after4=path.join(tmp,"open4.json"); W(after4,sql(dl.filter(t=>!removed.includes(t.id)).map(row)));
ok("тронутый дедлайн → ловится",run(before,after4,done).code===1);

// 6. журнал ответов → вход следующего прогона: «без даты» и оценки часов
const db3=path.join(tmp,"db3"); fs.cpSync(db1,db3,{recursive:true});
for(const w of r.logWrites){const f=path.join(db3,"log",w.doc_id+".json");W(f,{...JSON.parse(fs.readFileSync(f)),...w.data})}
const m2=S.mode(db3,{...inp,tasks:inp.tasks.filter(t=>!removed.includes(t.id))});
ok("после ответов кандидатов меньше",m2.razbor.left<m.razbor.left,m.razbor.left+" → "+m2.razbor.left);
const h=path.join(db3,"log","t9-20261102-h.json"); W(h,{task:"t9",date:"2026-11-02",field:"Трудоёмкость, ч",proposed:2,answer:null,mode:"понедельник"});
const u=path.join(db3,"log","t8-20261102-d.json"); W(u,{task:"t8",date:"2026-11-02",field:"Плановая дата",proposed:null,answer:"без даты",mode:"понедельник"});
const st=S.stenaIn(db3);
ok("журнал → оценки и «без даты»",st.estimates.t9&&st.estimates.t9.hours===2&&st.ownerUndated.includes("t8"),JSON.stringify({e:st.estimates,u:st.ownerUndated}));

// 7. понедельник: позиции, заполнение часов и точки моделью, текст треда
const p2=S.positions(inp,plan);
ok("позиции понедельника пронумерованы, перегрузы — справкой",p2.items.every((it,i)=>it.n===i+1&&it.field)&&p2.info.length===plan.proposals.top.filter(x=>!x.field).length);
// часы и точка в верхние 25 фикстуры не попадают — дописываем по позиции, как их отдал бы движок
for(const [f,id] of [["Трудоёмкость, ч","t000000000000000000000000000003"],["Синапс","t000000000000000000000000000007"]])
  if(!p2.items.some(it=>it.field===f))p2.items.push({n:p2.items.length+1,task:id,title:"подставная",field:f,was:null,proposed:null,reason:"проверка",sphere:"Личное",act:"предложение"});
const hrs=p2.items.find(it=>it.field==="Трудоёмкость, ч"), syn=p2.items.find(it=>it.field==="Синапс");
const fill={}; if(hrs)fill[hrs.n]=1.5; if(syn)fill[syn.n]="D";
const out2=path.join(tmp,"out2"); S.entries(p2,out2,fill);
const p2f=JSON.parse(fs.readFileSync(path.join(out2,"positions.json")));
ok("предложения модели легли в позиции",(!hrs||p2f.items.find(i=>i.n===hrs.n).proposed===1.5)&&(!syn||p2f.items.find(i=>i.n===syn.n).proposed==="D"),JSON.stringify(fill));
const txt=S.show(p2f,inp); ok("текст треда собран",txt.split("\n").length>=p2f.items.length,txt.split("\n").slice(0,3).join(" / "));
const r2=S.apply(p2f,{default:"принял"},inp.today);
ok("принятая точка → ссылка карты с #id",!syn||r2.changes.some(c=>c.set["Синапс"]==="https://claude.ai/artifact/NNPSJnwn5hP9fDbi4SdsPv#D"));

let fail=0; for(const x of rows){if(!x.pass)fail++;console.log((x.pass?"да  ":"НЕТ ")+x.name+(x.got?" · "+x.got:""))}
console.log(fail?`не сошлось: ${fail} из ${rows.length}`:`все ${rows.length} проверок — да`);
fs.rmSync(tmp,{recursive:true,force:true});
process.exit(fail?1:0);
