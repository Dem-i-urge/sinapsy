/* Дворник · dvornik.js v0.1.1-draft · 27.10.2026
   Прогон: вход → engine.js → check.js → plan.json, wall.json (документ стены plan/current) и отчёт для треда.
   node dvornik.js <input.json> <graph.js> [out-dir] [--dry]   (--dry — сухой прогон: стена помечает, что в Notion не писалось)
   graph.js — тот, что опубликован рядом с картой (SPEC §5 п. 2), а не копия из git.
   Код выхода: 0 — проверка пройдена; 1 — не пройдена (публикации и записи в Notion нет); 2 — ошибка входа. */
const fs=require("fs"), path=require("path");
const argv=process.argv.slice(2), dry=argv.includes("--dry"), [inFile,graphFile,outDir=path.dirname(inFile)]=argv.filter(a=>a!=="--dry");
if(!inFile||!graphFile){console.error("node dvornik.js <input.json> <graph.js> [out-dir]");process.exit(2)}
const G=require(path.resolve(graphFile)), E=require("./engine.js"), C=require("./check.js");
const input=JSON.parse(fs.readFileSync(inFile,"utf8"));
const plan=E.plan(input,G);
const prevLog=input.log||[], newLog=[...prevLog,...plan.logAppend];
const res=C.check(input,plan,{prevLog,newLog});
fs.writeFileSync(path.join(outDir,"plan.json"),JSON.stringify(plan,null,1));
fs.writeFileSync(path.join(outDir,"check.json"),JSON.stringify(res,null,1));
const W=E.wall(plan,res,{mode:dry?"сухой":"живой",ranAt:new Date().toISOString()}), wj=JSON.stringify(W);
if(Buffer.byteLength(wj)>250*1024){console.error("wall.json больше 250 КБ ("+Buffer.byteLength(wj)+" Б): документ стены не запишется");process.exit(2)}
fs.writeFileSync(path.join(outDir,"wall.json"),wj);
const P=plan.passport, out=[];
const DOW=["пн","вт","ср","чт","пт","сб","вс"];
out.push(`Дворник ${plan.version} · ${plan.graph} · прогон на ${plan.today}`);
out.push(`Паспорт: открыто ${P.open} · просрочено по плану ${P.overduePlan} · без дат ${P.noDates} · с дедлайном ${P.withDeadline} · Меркор ${P.merkor} · без точки ${P.noNode} (привязка: синапс ${P.bind.синапс}, проект ${P.bind.проект}, задача ${P.bind.задача}) · часы: владелец ${P.hours.владелец}, Дворник ${P.hours.Дворник}, нет ${P.hours.нет}`);
out.push(`Карта: ${P.nodes} точек, кругов ${P.loops} · календарь: ${Object.entries(P.calendar).map(([k,v])=>k+" "+v).join(", ")} · офисных дней ${P.officeDays}`);
out.push(`Ёмкость дней: ${P.capacity.days} ч · свои задачи ≈ ${P.capacity.perDayOwn} ч/день · Меркор ≈ ${P.capacity.perWeekMerkor} ч/нед`);
out.push(`Раскладка: по дням ${P.placed.days} · по неделям ${P.placed.weeks} · по месяцам ${P.placed.months} · без даты по решению ${P.placed.none}`);
out.push(`Проверка: ${res.ok?"пройдена":"НЕ ПРОЙДЕНА"} · нарушений ${res.violations.length} · контроль: задач ${res.counts.tasks}, сверок зависимостей ${res.counts.depChecks}, офисных дней ${res.counts.officeDays}, задач Меркора ${res.counts.merkor}`);
for(const v of res.violations.slice(0,20))out.push(`  ✗ ${v.inv}: ${v.msg}${v.task?" · "+v.task:""}${v.date?" · "+v.date:""}`);
out.push("");
out.push("Перегрузы:");
const T=new Map(plan.tasks.map(t=>[t.id,t]));
for(const o of plan.overloads)out.push(o.type==="день"?`  день ${o.date}: ${o.load} ч при ёмкости ${o.cap} ч`:`  «${T.get(o.task).title}» — дедлайн ${o.deadline}, стоит ${o.placed}: ${o.reason}`);
if(!plan.overloads.length)out.push("  нет");
out.push("");
out.push("Верхние "+plan.top.length+" точек по баллу (калибровка весов):");
plan.top.forEach((t,i)=>out.push(`  ${i+1}. ${t.title} — ${t.total} (держит ${t.parts.unlock}${t.parts.found?", фундамент":""}${t.parts.prod?", у продукта":""}, охват ${t.parts.reach}${t.parts.active?", в работе":""}) · шагов ${t.steps}`));
out.push("");
out.push("Дни:");
for(const d of plan.days)out.push(`  ${d.date} ${DOW[d.dow]} ${d.office?"офис":"    "} · ёмкость ${d.cap.merkor}+${d.cap.own} · занято ${d.load.merkor}+${d.load.own} · ${d.route.join("→")} · ${d.bricks.map(b=>`«${T.get(b.task).title.slice(0,40)}» ${b.hours}${b.role==="шаг"?"":" ("+b.role+")"}`).join("; ")}`);
out.push("");
out.push("Дальше:");
for(const b of plan.buckets)if(b.tasks.length)out.push(`  ${b.type==="week"?"неделя":"месяц"} ${b.start} · ${b.load.merkor}+${b.load.own} из ${b.cap.merkor}+${b.cap.own} ч · ${b.points.slice(0,4).map(p=>p.title+" "+p.hours+" ч").join(", ")}${b.points.length>4?" …":""}`);
out.push("");
out.push(`Предложения (первые ${plan.proposals.top.length} из ${plan.proposals.all.length}):`);
plan.proposals.top.forEach((p,i)=>out.push(`  ${i+1}. ${p.title?"«"+p.title+"» ":""}${p.field?p.field+": "+(p.from||"—")+" → "+(p.to||p.slot||"?")+" · ":""}${p.reason}`));
out.push("");
out.push("Стартовый ряд «план → факт»: "+JSON.stringify(plan.learn.startSeries)+" · снятых исключено "+plan.learn.removedExcluded);
if(plan.notes.length)out.push("Заметки: "+plan.notes.join("; "));
fs.writeFileSync(path.join(outDir,"report.txt"),out.join("\n"));
console.log(out.join("\n"));
process.exit(res.ok?0:1);
