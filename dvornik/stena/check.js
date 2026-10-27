/* Дворник · check.js v0.1-draft · 27.10.2026
   Проверяющий: инварианты SPEC §8 над раскладкой engine.js. Отдельный код с чистым входом:
   ничего не берёт из engine.js и graph.js — графы, офисные дни и суммы считает сам.
   Дом — Dem-i-urge/sinapsy/dvornik/stena/check.js.
   Вызов: check(input, plan, {prevLog, newLog}) → {ok, violations:[{inv, msg, task?, date?}], counts}.
   Не прошёл — публикации нет и записи в Notion нет (SPEC §5 п. 2, §12). */
(function(root,factory){ if(typeof module==="object"&&module.exports)module.exports=factory(); else root.DvornikCheck=factory(); })(typeof self!=="undefined"?self:this,function(){
  "use strict";
  const VERSION="0.1";
  const INV={
    DEP:"1 · шаг не раньше шага точки, от которой зависит",
    MERKOR:"2 · Меркор только на офисный день",
    DEADLINE:"3 · не позже дедлайна, иначе в перегрузах",
    CAP:"4 · часы дня ≤ ёмкости, иначе день в перегрузах",
    ONE:"5 · каждая открытая задача ровно в одном месте",
    NODL:"6 · ни одно предложение не трогает дедлайн",
    LOG:"7 · журнал прошлого прогона — префикс нового"
  };
  const EPS=1e-6;
  const day=s=>s?String(s).slice(0,10):null;
  const mskDate=iso=>new Date(Date.parse(iso)+3*3600e3).toISOString().slice(0,10);
  const hex=u=>{const m=String(u||"").replace(/-/g,"").match(/[0-9a-f]{32}/i);return m?m[0].toLowerCase():null};

  function check(input,plan,opts){
    opts=opts||{};
    const V=[], add=(inv,msg,extra)=>V.push({inv:INV[inv],msg,...(extra||{})});
    const merkorSphere=(input.params&&input.params.merkorSphere)||"Меркор-ПРУФ";
    const open=(input.tasks||[]).filter(t=>t.status!=="Done");
    const T=new Map(open.map(t=>[t.id,t]));
    const PT=new Map((plan.tasks||[]).map(t=>[t.id,t]));
    const pl=plan.placements||{};
    const days=plan.days||[], dayByDate=new Map(days.map(d=>[d.date,d]));
    const buckets=plan.buckets||[];
    const overDays=new Set((plan.overloads||[]).filter(o=>o.type==="день").map(o=>o.date));
    const overDl=new Set((plan.overloads||[]).filter(o=>o.type==="дедлайн").map(o=>o.task));

    /* ---------- 5 · ровно одно место ---------- */
    const ids=Object.keys(pl);
    for(const t of open)if(!(t.id in pl))add("ONE","задача не разложена",{task:t.id});
    for(const id of ids)if(!T.has(id))add("ONE","в раскладке лишняя или закрытая задача",{task:id});
    const brickDates=new Map();   // task → даты кирпичей-шагов (не приёмок)
    for(const d of days)for(const b of d.bricks||[]){
      if(!T.has(b.task)){add("ONE","кирпич чужой задачи",{task:b.task,date:d.date});continue}
      if(b.role==="приёмка")continue;
      if(!brickDates.has(b.task))brickDates.set(b.task,[]);brickDates.get(b.task).push(d.date)}
    const inBucket=new Map(); for(const b of buckets)for(const id of b.tasks||[]){if(!inBucket.has(id))inBucket.set(id,[]);inBucket.get(id).push(b.start)}
    const undated=new Set(plan.undated||[]);
    for(const id of ids){const p=pl[id], bd=brickDates.get(id)||[], bk=inBucket.get(id)||[];
      const places=bd.length+bk.length+(undated.has(id)?1:0);
      if(places!==1){add("ONE",`задача стоит в ${places} местах`,{task:id});continue}
      if(p.where==="day"&&bd[0]!==p.date)add("ONE","кирпич и место расходятся",{task:id});
      if((p.where==="week"||p.where==="month")&&bk[0]!==p.start)add("ONE","корзина и место расходятся",{task:id});
      if(p.where==="none"&&!undated.has(id))add("ONE","«без даты» не в списке владельца",{task:id});
      if(p.where==="none"&&!(input.ownerUndated||[]).includes(id))add("ONE","«без даты» без решения владельца",{task:id});}
    const slot=id=>{const p=pl[id];return !p?null:p.where==="day"?p.date:p.where==="none"?null:p.start};

    /* ---------- 1 · зависимости ---------- */
    const nodes=input.nodes||[], N=new Map(nodes.map(n=>[n.id,n]));
    const isOpen=n=>n&&n.status!=="done";
    const tasksOf=new Map();
    for(const t of open){const pt=PT.get(t.id); const nid=pt&&pt.node;
      if(nid){ // привязка проверяется по правилу §2.3, а не принимается на веру
        const syn=String(t.synapse||"").match(/#([A-Za-z0-9_-]+)\s*$/);
        const okSyn=syn&&syn[1]===nid;
        const n=N.get(nid); const hs=new Set([hex(t.id),...(t.projects||[]).map(hex)]);
        if(!n)add("DEP","задача привязана к несуществующей точке",{task:t.id});
        else if(!okSyn&&!(syn&&N.has(syn[1]))&&!hs.has(hex(n.notion)))add("DEP","привязка к точке не следует из «Синапса» или проекта",{task:t.id});
        else if(syn&&N.has(syn[1])&&!okSyn)add("DEP","«Синапс» указывает другую точку",{task:t.id});
        if(!tasksOf.has(nid))tasksOf.set(nid,[]);tasksOf.get(nid).push(t.id)}}
    // достижимость по открытым зависимостям — для заколдованных кругов (точки, ждущие друг друга, друг друга не ждут)
    const reachMemo=new Map();
    const reach=id=>{if(reachMemo.has(id))return reachMemo.get(id);const s=new Set(),st=[id];
      while(st.length){const n=N.get(st.pop());if(!n)continue;for(const p of n.deps||[]){if(p===n.id||s.has(p)||!isOpen(N.get(p)))continue;s.add(p);st.push(p)}}
      reachMemo.set(id,s);return s};
    const mutual=(a,b)=>reach(a).has(b)&&reach(b).has(a);
    let depChecks=0;
    for(const [nid,tids] of tasksOf){
      // ближайшие вверх открытые точки с шагами; точка без шагов проходится насквозь
      const seen=new Set([nid]), st=[nid], pre=new Set();
      while(st.length){const n=N.get(st.pop());for(const p of (n&&n.deps)||[]){if(seen.has(p))continue;seen.add(p);const m=N.get(p);
        if(!isOpen(m)||mutual(nid,p))continue; if(tasksOf.has(p))pre.add(p); else st.push(p)}}
      for(const p of pre)for(const a of tasksOf.get(p))for(const b of tids){
        const sa=slot(a), sb=slot(b); if(!sa||!sb)continue; depChecks++;
        if(sb<sa)add("DEP",`шаг стоит ${sb}, а шаг точки-предшественника — ${sa}`,{task:b})}}

    /* ---------- 2 · Меркор на офисный день ---------- */
    const officeDays=new Set((input.calendar||[]).filter(e=>e.kind==="office").map(e=>mskDate(e.start)));
    const merkorTasks=open.filter(t=>(t.spheres||[]).includes(merkorSphere));
    for(const t of merkorTasks){const p=pl[t.id]; if(!p||p.where!=="day")continue;
      if(officeDays.has(p.date))continue;
      const dl=day(t.deadline);
      if(!dl){add("MERKOR",`задача Меркора без дедлайна стоит дома (${p.date})`,{task:t.id});continue}
      // исключение законно, только если офисные дни до дедлайна действительно заняты
      const h=(PT.get(t.id)||{}).hours||0;
      const free=days.filter(d=>officeDays.has(d.date)&&d.date<=dl&&d.date>=(plan.today||"")).some(d=>{
        const used=(d.bricks||[]).filter(b=>b.pool==="merkor").reduce((s,b)=>s+b.hours,0);return used+h<=d.cap.merkor+EPS});
      if(free)add("MERKOR",`задача Меркора стоит дома (${p.date}), а в офисный день до дедлайна место есть`,{task:t.id});}

    /* ---------- 3 · дедлайн ---------- */
    for(const t of open){const dl=day(t.deadline); if(!dl)continue; const s=slot(t.id);
      if(!s){add("DEADLINE","задача с дедлайном без места",{task:t.id});continue}
      if(s>dl&&!overDl.has(t.id))add("DEADLINE",`стоит ${s} при дедлайне ${dl} и не в перегрузах`,{task:t.id});}

    /* ---------- 4 · ёмкость дня (суммы — свои, не из plan.load) ---------- */
    for(const d of days){const sum=(d.bricks||[]).reduce((s,b)=>s+(+b.hours||0),0);
      if(Math.abs(d.cap.total-(d.cap.merkor+d.cap.own))>0.05)add("CAP","ёмкость дня не равна сумме пулов",{date:d.date});
      if(sum>d.cap.total+EPS&&!overDays.has(d.date))add("CAP",`${Math.round(sum*10)/10} ч при ёмкости ${d.cap.total} ч и не в перегрузах`,{date:d.date});}

    /* ---------- 6 · дедлайн не трогается ---------- */
    for(const t of open){const pt=PT.get(t.id); if(pt&&day(pt.deadline)!==day(t.deadline))add("NODL","дедлайн в раскладке изменён",{task:t.id})}
    const props=(plan.proposals&&plan.proposals.all)||[];
    for(const p of props)if(p.field&&/дедлайн/i.test(p.field))add("NODL","предложение меняет дедлайн",{task:p.task});
    for(const l of plan.logAppend||[])if(/дедлайн/i.test(l.field||""))add("NODL","строка журнала меняет дедлайн",{task:l.task});

    /* ---------- 7 · журнал только дописывается ---------- */
    if(opts.prevLog&&opts.newLog){const a=opts.prevLog,b=opts.newLog;
      if(b.length<a.length)add("LOG",`журнал укоротился: ${a.length} → ${b.length}`);
      else for(let i=0;i<a.length;i++)if(JSON.stringify(a[i])!==JSON.stringify(b[i])){add("LOG",`строка ${i+1} журнала переписана`,{task:a[i].task});break}}

    return {ok:V.length===0,version:VERSION,violations:V,
      counts:{tasks:open.length,placed:ids.length,days:days.length,depChecks,merkor:merkorTasks.length,officeDays:officeDays.size,
        withDeadline:open.filter(t=>t.deadline).length,logPrev:(opts.prevLog||[]).length,logNew:(opts.newLog||[]).length}};
  }
  return {VERSION,INV,check};
});
