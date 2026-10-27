/* Дворник · прогон на подставных данных · v0.1 · 27.10.2026
   node test/run.js — чистый набор зелёный; каждый подставной дефект ловится своим инвариантом §8.
   Выход: код 0 — все строки «да», иначе 1. */
const path=require("path");
const G=require(path.join(__dirname,"../../../graph.js"));
const E=require(path.join(__dirname,"../engine.js"));
const C=require(path.join(__dirname,"../check.js"));
const {input,prevLog}=require("./fixture.js");
const clone=x=>JSON.parse(JSON.stringify(x));
const plan=E.plan(input,G);
const newLog=[...prevLog,...plan.logAppend];
const tid=n=>"t"+String(n).padStart(30,"0");
const brickOf=(p,id)=>{for(const d of p.days){const i=d.bricks.findIndex(b=>b.task===id&&b.role!=="приёмка");if(i>=0)return {d,i}}return null};
const moveTo=(p,id,date)=>{const f=brickOf(p,id);const b=f.d.bricks.splice(f.i,1)[0];p.days.find(d=>d.date===date).bricks.push(b);p.placements[id]={...p.placements[id],date}};

const rows=[];
const run=(name,inv,mut)=>{const p=clone(plan);const lg={prevLog:clone(prevLog),newLog:clone(newLog)};const inp=clone(input);mut&&mut(p,lg,inp);
  const r=C.check(inp,p,lg);const hit=inv?r.violations.filter(v=>v.inv.startsWith(inv)):[];
  const pass=inv?hit.length>0:r.ok;rows.push({name,expect:inv?"инвариант "+inv:"чисто",pass,got:r.violations.map(v=>v.inv.slice(0,1)+": "+v.msg).join(" | ")||"—",counts:r.counts})};

run("чистый набор",null);
run("шаг фундамента раньше шага ядра","1",p=>{const a=p.placements[tid(1)].date,b=p.placements[tid(2)].date;
  // переставляем: шаг ядра — на последний день, шаг фундамента остаётся
  moveTo(p,tid(1),p.days[p.days.length-1].date);});
run("Меркор на домашний день","2",p=>{const home=p.days.find(d=>!d.office&&d.date>=p.today);moveTo(p,tid(5),home.date)});
run("после дедлайна и не в перегрузах","3",p=>{moveTo(p,tid(6),"2026-11-12");p.overloads=p.overloads.filter(o=>o.task!==tid(6))});
run("день сверх ёмкости и не в перегрузах","4",p=>{const d=p.days.find(d=>d.bricks.length&&!p.overloads.some(o=>o.date===d.date));d.bricks[0].hours+=30});
run("задача в двух местах","5",p=>{const f=brickOf(p,tid(4));const other=p.days.find(d=>d.date!==f.d.date);other.bricks.push({...f.d.bricks[f.i]})});
run("задача потеряна","5",p=>{const id=tid(8);delete p.placements[id];const f=brickOf(p,id);if(f)f.d.bricks.splice(f.i,1)});
run("предложение двигает дедлайн","6",p=>{p.proposals.all.push({task:tid(6),field:"Дедлайн",from:"2026-11-05",to:"2026-11-20"})});
run("раскладка переписала дедлайн","6",p=>{p.tasks.find(t=>t.id===tid(6)).deadline="2026-11-20"});
run("журнал переписан","7",(p,lg)=>{lg.newLog[0]={...lg.newLog[0],answer:"отклонил"}});

for(const r of rows)console.log(`${r.pass?"да ":"НЕТ"} · ${r.name.padEnd(36)} · ждали: ${r.expect.padEnd(12)} · поймано: ${r.got}`);
console.log("\nконтроль (заведомо ненулевые на наборе):",JSON.stringify(rows[0].counts));
console.log("паспорт:",JSON.stringify(plan.passport));
console.log("перегрузы:",JSON.stringify(plan.overloads));
console.log("обучение:",JSON.stringify(plan.learn));
for(const d of plan.days)console.log(d.date,d.office?"офис":"    ",`ёмк ${d.cap.merkor}+${d.cap.own}`,`загр ${d.load.merkor}+${d.load.own}`,d.route.join("→"),d.bricks.map(b=>b.task.slice(-2)+":"+b.hours+(b.role!=="шаг"?"("+b.role+")":"")).join(" "));
for(const b of plan.buckets)console.log(b.type,b.start,b.end,`ёмк ${b.cap.merkor}+${b.cap.own}`,`загр ${b.load.merkor}+${b.load.own}`,b.tasks.map(t=>t.slice(-2)).join(" "));
console.log("топ:",plan.top.map(t=>t.title+" "+t.total).join(" · "));
console.log("заметки:",plan.notes);
process.exit(rows.every(r=>r.pass)?0:1);
