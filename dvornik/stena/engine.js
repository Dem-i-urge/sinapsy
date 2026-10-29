/* Дворник · engine.js v0.1.2-draft · 29.10.2026
   Планировщик стены: чистая функция plan(data, graph) → раскладка. Без сети, без DOM, без часов:
   «сегодня» приходит во входе. Спецификация — sinapsy/dvornik/SPEC.md §3–5; проверяет результат check.js.
   Дом — Dem-i-urge/sinapsy/dvornik/stena/engine.js; опубликованный файл стены — проекция.
   В node: const E=require('./engine.js'); E.plan(data, require('../../graph.js')).
   В браузере: глобальный DvornikEngine, граф — глобальный SinapsyGraph. */
(function(root,factory){ if(typeof module==="object"&&module.exports)module.exports=factory(); else root.DvornikEngine=factory(); })(typeof self!=="undefined"?self:this,function(){
  "use strict";
  const VERSION="0.1.2";

  /* ---------- параметры по умолчанию (SPEC §3.1, §3.5, §4); meta/params стены их перекрывает ---------- */
  const DEFAULTS={
    window:[10,19],            // рабочее окно дня, часы МСК
    homeShare:0.5,             // доля свободного времени дома, идущая на задачи
    officeOwnShare:0.25,       // доля офисного времени на свои задачи; остальное — Меркор
    travel:{"home|office":1,"home|cabinet":1,"office|cabinet":0.5,"home|other":1,"office|other":1,"cabinet|other":1},
    merkorSphere:"Меркор-ПРУФ",
    defaultHours:1,            // часы задачи без оценки — до оценки владельца или Дворника
    heavyPerWeek:2,            // тяжёлых фоновых прогонов в неделю (мель «Карман модели»)
    dayWeeks:3,                // кирпичами по дням — недели 1–3
    weekWeeks:8,               // по неделям — до конца второго месяца
    months:24,                 // по месяцам — дальше, пока всё не разложено
    weights:{unlock:1,found:3,prod:2,reach:0.5,active:2},
    capFactor:1,               // поправка ёмкости по реальным закрытым часам (§3.4); ставит Архитектор
    inherit:true,              // балл шага не ниже самой важной открытой точки, которая его ждёт (§3.1, калибровка 29.10)
    topN:10, proposalLimit:25
  };
  const merge=(a,b)=>{const o={...a};for(const k in b||{})o[k]=(b[k]&&typeof b[k]==="object"&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==="object")?merge(a[k],b[k]):b[k];return o};

  /* ---------- даты: всё в МСК (UTC+3, без перехода на летнее время), строки ГГГГ-ММ-ДД ---------- */
  const MSK=3*3600e3, DAY=864e5;
  const d2n=s=>Date.UTC(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10))/DAY;   // номер дня
  const n2d=n=>new Date(n*DAY).toISOString().slice(0,10);
  const addD=(s,k)=>n2d(d2n(s)+k);
  const dow=s=>(new Date(d2n(s)*DAY).getUTCDay()+6)%7;                        // 0 = пн
  const monday=s=>addD(s,-dow(s));
  const monthStart=s=>s.slice(0,8)+"01";
  const nextMonth=s=>{let y=+s.slice(0,4),m=+s.slice(5,7)+1;if(m>12){m=1;y++}return y+"-"+String(m).padStart(2,"0")+"-01"};
  const toMsk=iso=>{const t=Date.parse(iso)+MSK;return{date:new Date(t).toISOString().slice(0,10),h:((t%DAY)+DAY)%DAY/3600e3}};
  const dateOnly=s=>s?String(s).slice(0,10):null;
  const median=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
  const quant=(a,q)=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(q*b.length))]};
  const r1=x=>Math.round(x*10)/10;

  /* ---------- ёмкость дня по модели перемещений (§4) ---------- */
  function dayCapacity(date,events,P){
    const [w0,w1]=P.window;
    const evs=events.filter(e=>e.date===date).sort((a,b)=>a.s-b.s);
    const office=evs.filter(e=>e.kind==="office");
    // где владелец: офис, кабинет (очная сессия), дом (онлайн), «другое место» (прочее с местом вне дома)
    const placeOf=e=>e.kind==="office"?"office":e.kind==="session_inperson"?"cabinet":e.kind==="session_online"?"home":e.away?"other":"home";
    const tt=(a,b)=>a===b?0:(P.travel[a+"|"+b]??P.travel[b+"|"+a]??1);
    const busy=[], route=["home"]; let travel=0, at="home";
    for(const e of evs){
      const p=placeOf(e);
      if(p!==at){const t=tt(at,p);travel+=t;busy.push([e.s-t,e.s]);route.push(p);at=p}
      if(e.kind!=="office")busy.push([e.s,e.e]);
    }
    if(at!=="home"){const last=evs[evs.length-1];const t=tt(at,"home");travel+=t;busy.push([last.e,last.e+t]);route.push("home")}
    // офисное время — отдельный пул; в окне дома оно занято
    let officeH=0; for(const o of office){officeH+=Math.max(0,o.e-o.s);busy.push([o.s,o.e])}
    // свободное время окна = окно − объединение занятого
    const iv=busy.map(([a,b])=>[Math.max(a,w0),Math.min(b,w1)]).filter(([a,b])=>b>a).sort((x,y)=>x[0]-y[0]);
    let used=0,cs=null,ce=null; for(const [a,b] of iv){if(cs===null){cs=a;ce=b}else if(a<=ce)ce=Math.max(ce,b);else{used+=ce-cs;cs=a;ce=b}} if(cs!==null)used+=ce-cs;
    const homeFree=Math.max(0,(w1-w0)-used);
    const f=P.capFactor;
    const merkor=r1(officeH*(1-P.officeOwnShare)*f);
    const own=r1((officeH*P.officeOwnShare+homeFree*P.homeShare)*f);
    return {date,dow:dow(date),office:officeH>0,route,travel:r1(travel),officeH:r1(officeH),homeFree:r1(homeFree),
      cap:{merkor,own,total:r1(merkor+own)},load:{merkor:0,own:0,total:0},bricks:[]};
  }

  /* ---------- главная функция ---------- */
  function plan(data,graphLib){
    const G=graphLib||(typeof SinapsyGraph!=="undefined"?SinapsyGraph:null);
    if(!G)throw new Error("нет graph.js");
    const P=merge(DEFAULTS,data.params||{});
    const start=data.today;
    const nodes=data.nodes||[], spheres=data.spheres||[];
    const g=G.make(nodes,spheres);
    const notes=[];

    /* --- задачи: только открытые; снятое сюда не приходит --- */
    const tasks=(data.tasks||[]).filter(t=>t.status!=="Done").map(t=>({...t,
      deadline:dateOnly(t.deadline), planned:dateOnly(t.planned), spheres:t.spheres||[], projects:t.projects||[]}));
    const byTask=new Map(tasks.map(t=>[t.id,t]));
    const ownerUndated=new Set(data.ownerUndated||[]);   // «в точку» по решению владельца (из журнала)
    const est=data.estimates||{};                          // предложения Дворника из журнала: {hours, bg:{attention,heavy}}

    /* --- обучение (§3.4): коэффициент часов по журналу; стартовый ряд «план → факт» по истории --- */
    const learn=learnFrom(data.log||[],data.history||[],tasks,P);

    /* --- привязка задачи к точке (§2.3): «Синапс» → id; иначе проект или сама задача в поле notion точки --- */
    const hex=u=>{const m=String(u||"").replace(/-/g,"").match(/[0-9a-f]{32}/i);return m?m[0].toLowerCase():null};
    const nodeByNotion=new Map();
    for(const n of nodes){const h=hex(n.notion);if(h){if(!nodeByNotion.has(h))nodeByNotion.set(h,[]);nodeByNotion.get(h).push(n)}}

    /* --- балл точки (§3.1) --- */
    const W=P.weights, scoreCache=new Map(), ownCache=new Map();
    // наследование: точка не ниже самой важной открытой точки, которая ждёт её по цепочке
    // (сигнал идёт от цели к шагам — «снаружи внутрь»); own — собственный балл, from — откуда унаследован
    function nodeScore(n){
      if(scoreCache.has(n.id))return scoreCache.get(n.id);
      const o=ownScore(n); let s=o;
      if(P.inherit&&g.isOpen(n)){let best=null;
        for(const id of g.downstream(n)){const m=g.byId(id);if(!g.isOpen(m))continue;const x=ownScore(m);
          if(x.total>o.total&&(!best||x.total>best.total||(x.total===best.total&&m.id<best.id)))best={total:x.total,id:m.id,title:m.title}}
        if(best)s={total:best.total,own:o.total,parts:o.parts,level:o.level,from:{node:best.id,title:best.title}}}
      scoreCache.set(n.id,s); return s;
    }
    function ownScore(n){
      if(ownCache.has(n.id))return ownCache.get(n.id);
      const lvl=g.levelOf(n);
      // закрытая точка дерево не держит: её зависимые её уже не ждут (isBlocked считает только открытых)
      const unlock=g.isOpen(n)?g.unlockCount(n):0;
      const found=lvl<=1?1:0;
      const prod=(lvl===3||g.dependentsOf(n).some(id=>{const m=g.byId(id);return g.isOpen(m)&&g.levelOf(m)===3}))?1:0;
      const reach=g.reachOf(n).length;
      const active=n.active&&g.isOpen(n)?1:0;
      const parts={unlock,found,prod,reach,active};
      const s={total:r1(W.unlock*unlock+W.found*found+W.prod*prod+W.reach*reach+W.active*active),parts,level:lvl};
      ownCache.set(n.id,s); return s;
    }
    for(const t of tasks){
      let n=null, how=null;
      const syn=String(t.synapse||"").match(/#([A-Za-z0-9_-]+)\s*$/);
      if(syn&&g.byId(syn[1])){n=g.byId(syn[1]);how="синапс"}
      if(!n){
        const cands=[...(nodeByNotion.get(hex(t.id))||[]),...t.projects.flatMap(p=>nodeByNotion.get(hex(p))||[])];
        if(cands.length){n=cands.sort((a,b)=>nodeScore(b).total-nodeScore(a).total||(a.id<b.id?-1:1))[0];how=nodeByNotion.has(hex(t.id))?"задача":"проект"}
      }
      t.node=n?n.id:null; t.bind=how;
      t.score=n?nodeScore(n).total:0;
      t.merkor=t.spheres.includes(P.merkorSphere);
      // часы: владелец — истина; иначе оценка Дворника × коэффициент; иначе стартовые
      const e=est[t.id];
      if(t.hours!=null&&t.hours!==""){t.h=+t.hours;t.hSrc="владелец"}
      else if(e&&e.hours){t.h=r1(e.hours*learn.hoursCoef(t));t.hSrc="Дворник"}
      else {t.h=P.defaultHours;t.hSrc="нет оценки"}
      t.bg=e&&e.bg?{attention:+e.bg.attention||t.h,heavy:!!e.bg.heavy}:null;
      if(t.bg)t.h=t.bg.attention;
    }

    /* --- шаги-предшественники (§3.2 п. 2): задачи ближайших вверх по графу открытых точек, у которых есть шаги;
           точка без шагов пропускается насквозь; точки одного заколдованного круга друг друга не ждут --- */
    const tasksOfNode=new Map(); for(const t of tasks)if(t.node){if(!tasksOfNode.has(t.node))tasksOfNode.set(t.node,[]);tasksOfNode.get(t.node).push(t.id)}
    const loops=g.findLoops(), loopIdx=new Map(); loops.forEach((c,i)=>c.forEach(id=>loopIdx.set(id,i)));
    const sameLoop=(a,b)=>loopIdx.has(a)&&loopIdx.get(a)===loopIdx.get(b);
    const prereqNodeCache=new Map();
    function stepPrereqNodes(nid){
      if(prereqNodeCache.has(nid))return prereqNodeCache.get(nid);
      const out=new Set(), seen=new Set([nid]), st=[nid];
      while(st.length){const c=g.byId(st.pop());
        for(const p of g.prereqsOf(c)){ if(seen.has(p))continue; seen.add(p); const m=g.byId(p);
          if(!g.isOpen(m)||sameLoop(nid,p))continue;
          if(tasksOfNode.has(p))out.add(p); else st.push(p); } }
      prereqNodeCache.set(nid,out); return out;
    }
    const preTasks=new Map();
    for(const t of tasks){const s=new Set(); if(t.node)for(const p of stepPrereqNodes(t.node))for(const id of tasksOfNode.get(p))s.add(id); preTasks.set(t.id,s)}

    /* --- срочность: собственный дедлайн или закреплённая владельцем будущая плановая дата,
           переданная вверх по графу шагам-предшественникам (внутренняя величина, в Notion не пишется) --- */
    const own=t=>{let d=t.deadline; if(t.planned&&t.planned>=start)d=d&&d<t.planned?d:t.planned; return d};
    const due=new Map(tasks.map(t=>[t.id,own(t)]));
    const succTasks=new Map(tasks.map(t=>[t.id,[]])); for(const [id,s] of preTasks)for(const p of s)succTasks.get(p).push(id);
    // распространение: пока меняется (граф шагов ацикличен вне кругов; ограничение итераций — страховка)
    for(let it=0,ch=true;ch&&it<50;it++){ch=false;for(const t of tasks)for(const sId of succTasks.get(t.id)){const d=due.get(sId);if(d&&(!due.get(t.id)||d<due.get(t.id))){due.set(t.id,d);ch=true}}}

    /* --- сетка: дни недель 1–3, недели до конца второго месяца, месяцы дальше --- */
    const events=(data.calendar||[]).flatMap(e=>{const a=toMsk(e.start),b=toMsk(e.end);
      if(a.date!==b.date)return [{...e,date:a.date,s:a.h,e:24},{...e,date:b.date,s:0,e:b.h}];   // через полночь
      return [{...e,date:a.date,s:a.h,e:b.h}]});
    const dayEnd=addD(monday(start),7*P.dayWeeks-1);
    const days=[]; for(let d=start;d<=dayEnd;d=addD(d,1))days.push(dayCapacity(d,events,P));
    const dayIx=new Map(days.map((d,i)=>[d.date,i]));
    const avg=k=>days.reduce((s,d)=>s+d.cap[k],0)/Math.max(1,days.length);
    const perDay={merkor:avg("merkor"),own:avg("own")};
    const X=nextMonth(addD(monday(start),7*P.weekWeeks));       // с этой даты — месяцы
    const buckets=[];
    for(let s=addD(dayEnd,1);s<X;s=addD(s,7)){const e=addD(s,6)<X?addD(s,6):addD(X,-1);buckets.push({type:"week",start:s,end:e})}
    for(let s=X,i=0;i<P.months;i++,s=nextMonth(s))buckets.push({type:"month",start:s,end:addD(nextMonth(s),-1)});
    for(const b of buckets){const n=d2n(b.end)-d2n(b.start)+1;b.cap={merkor:r1(perDay.merkor*n),own:r1(perDay.own*n)};b.load={merkor:0,own:0};b.tasks=[]}

    /* --- раскладка: Кан по графу шагов, из готовых — самый срочный, затем балл, затем порядок владельца --- */
    const PR={"Высокий":0,"Средний":1,"Низкий":2};
    const key=t=>[due.get(t.id)||"9999",-t.score,PR[t.priority]??3,t.planned||"9999",t.created||"",t.id];
    const cmp=(a,b)=>{const x=key(a),y=key(b);for(let i=0;i<x.length;i++){if(x[i]<y[i])return -1;if(x[i]>y[i])return 1}return 0};
    const placed=new Map(), overloads=[], heavyByWeek=new Map(), why=new Map();
    const slotStart=pl=>pl.where==="day"?pl.date:pl.where==="none"?null:pl.start;
    const pending=new Map(tasks.map(t=>[t.id,preTasks.get(t.id).size]));
    let ready=tasks.filter(t=>pending.get(t.id)===0);
    const undated=[];

    function fitsDay(d,t,pool){
      const need=t.bg?t.h/2:t.h;
      if(d.load[pool]+need>d.cap[pool]+1e-9)return false;
      if(t.bg){const i=dayIx.get(d.date)+1;if(i>=days.length)return false;   // приёмка — на следующий день
        const nx=days[i];
        if(nx.load.own+(t.h-need)>nx.cap.own+1e-9)return false;
        const wk=monday(d.date); if(t.bg.heavy&&(heavyByWeek.get(wk)||0)>=P.heavyPerWeek)return false;}
      return true;
    }
    function putDay(d,t,pool,flag){
      if(t.bg){const half=r1(t.h/2),nx=days[dayIx.get(d.date)+1];
        d.bricks.push({task:t.id,hours:half,pool,role:"постановка"});d.load[pool]+=half;
        nx.bricks.push({task:t.id,hours:r1(t.h-half),pool:"own",role:"приёмка"});nx.load.own+=r1(t.h-half);
        if(t.bg.heavy){const wk=monday(d.date);heavyByWeek.set(wk,(heavyByWeek.get(wk)||0)+1)}}
      else{d.bricks.push({task:t.id,hours:t.h,pool,role:flag||"шаг"});d.load[pool]+=t.h}
      for(const x of [d,t.bg?days[dayIx.get(d.date)+1]:null])if(x){x.load.merkor=r1(x.load.merkor);x.load.own=r1(x.load.own);x.load.total=r1(x.load.merkor+x.load.own)}
      placed.set(t.id,{where:"day",date:d.date,pool,...(flag?{exception:flag}:{})});
    }
    function putBucket(b,t,pool){b.tasks.push(t.id);b.load[pool]=r1(b.load[pool]+t.h);placed.set(t.id,{where:b.type,start:b.start,pool})}

    function place(t){
      if(ownerUndated.has(t.id)&&!t.deadline){placed.set(t.id,{where:"none"});undated.push(t.id);return}
      let floor=start; for(const p of preTasks.get(t.id)){const s=slotStart(placed.get(p));if(s&&s>floor)floor=s}
      const D=t.deadline, pool=t.merkor?"merkor":"own";
      const okDay=d=>d.date>=floor&&(!t.merkor||d.office);
      // 1) закреп владельца: будущая плановая дата в пределах дней
      if(t.planned&&t.planned>=floor&&dayIx.has(t.planned)){const d=days[dayIx.get(t.planned)];
        if(okDay(d)&&fitsDay(d,t,pool)){putDay(d,t,pool);return}}
      // 2) первый подходящий день не позже дедлайна
      for(const d of days){if(D&&d.date>D)break;if(okDay(d)&&fitsDay(d,t,pool)){putDay(d,t,pool);return}}
      // 3) Меркор с дедлайном, не влезший в офисные дни до него — домой (исключение §3.2 п. 3)
      if(t.merkor&&D)for(const d of days){if(d.date>D)break;if(d.date>=floor&&!d.office&&fitsDay(d,t,"own")){putDay(d,t,"own","Меркор дома: офисные дни до дедлайна заняты");return}}
      // 4) дедлайн в пределах дней, но места нет — перегруз, ставим на последний допустимый день до дедлайна
      if(D&&D<=dayEnd){
        const cand=days.filter(d=>d.date<=D&&d.date>=start&&(!t.merkor||d.office));
        const d=cand.length?cand.reduce((a,b)=>(b.cap[pool]-b.load[pool]>a.cap[pool]-a.load[pool]?b:a)):days[Math.min(days.length-1,Math.max(0,dayIx.get(D)??0))];
        const forced={...t,bg:null}; putDay(d,forced,pool,D<start?"дедлайн уже прошёл":"дедлайн не помещается");
        const maxCap=Math.max(...days.filter(x=>!t.merkor||x.office).map(x=>x.cap[pool]),0);
        overloads.push({type:"дедлайн",task:t.id,deadline:D,placed:d.date,reason:D<start?"дедлайн уже прошёл":floor>D?"предшественники встают позже дедлайна":
          t.h>maxCap?`задача (${t.h} ч) крупнее любого дня (${r1(maxCap)} ч) — разбить на шаги`:"до дедлайна нет места"});return}
      // 5) корзины недель и месяцев: сначала корзина закрепа владельца, затем по ёмкости — не раньше предшественников и не позже дедлайна
      if(t.planned&&t.planned>dayEnd&&t.planned>=floor){const b=buckets.find(b=>b.start<=t.planned&&t.planned<=b.end&&(!D||b.start<=D));
        if(b&&b.load[pool]+t.h<=b.cap[pool]+1e-9){putBucket(b,t,pool);return}}
      for(const b of buckets){if(b.end<floor)continue;if(D&&b.start>D)break;if(b.load[pool]+t.h<=b.cap[pool]+1e-9){putBucket(b,t,pool);return}}
      if(D){const cand=buckets.filter(b=>b.start<=D&&b.end>=floor);const b=cand[cand.length-1]||buckets[0];putBucket(b,t,pool);
        overloads.push({type:"дедлайн",task:t.id,deadline:D,placed:b.start,reason:"до дедлайна нет места"});return}
      const b=buckets[buckets.length-1];putBucket(b,t,pool);notes.push("горизонт месяцев исчерпан: "+t.id);
    }
    while(ready.length){
      ready.sort(cmp); const t=ready.shift(); place(t);
      for(const s of succTasks.get(t.id)){pending.set(s,pending.get(s)-1);if(pending.get(s)===0)ready.push(byTask.get(s))}
    }
    // задачи в кругах зависимостей шагов (не должно быть: круги исключены) — разложить без учёта предшественников
    for(const t of tasks)if(!placed.has(t.id)){notes.push("шаг в круге зависимостей: "+t.id);preTasks.set(t.id,new Set());place(t)}

    /* --- перегрузы дней (§3.2 п. 4) --- */
    for(const d of days)if(d.load.total>d.cap.total+1e-9)overloads.push({type:"день",date:d.date,load:d.load.total,cap:d.cap.total});

    /* --- предложения для треда (§5 п. 4): перегрузы → переносы → часы → «Синапс» --- */
    const nm=id=>(byTask.get(id)||{}).title||id;
    const where=pl=>pl.where==="day"?pl.date:pl.where==="none"?"без даты":(pl.where==="week"?"неделя с ":"месяц с ")+pl.start;
    const moves=[];
    for(const t of tasks){const pl=placed.get(t.id); if(pl.where==="none")continue;
      const newDate=pl.where==="day"?pl.date:null;
      if(t.planned===newDate)continue;
      if(pl.where!=="day"&&t.planned&&t.planned>=start){const b=buckets.find(b=>b.start===pl.start);if(b&&b.start<=t.planned&&t.planned<=b.end)continue}
      let reason=!t.planned?"без плановой даты":t.planned<start?"плановая дата прошла":
        t.merkor&&dayIx.has(t.planned)&&!days[dayIx.get(t.planned)].office?"Меркор — на офисный день":
        [...preTasks.get(t.id)].some(p=>{const s=slotStart(placed.get(p));return s&&s>t.planned})?"раньше предшественников нельзя":
        dayIx.has(t.planned)?"в тот день нет места":"дальний горизонт";
      moves.push({task:t.id,title:t.title,field:"Плановая дата",from:t.planned,to:newDate,slot:where(pl),reason,score:t.score});
    }
    moves.sort((a,b)=>(a.to?0:1)-(b.to?0:1)||b.score-a.score||(a.to||"").localeCompare(b.to||""));
    const hoursAsk=tasks.filter(t=>t.hSrc==="нет оценки"&&placed.get(t.id).where==="day").sort((a,b)=>b.score-a.score)
      .map(t=>({task:t.id,title:t.title,field:"Трудоёмкость, ч",from:null,to:null,reason:"нет оценки; в раскладке стоит "+P.defaultHours+" ч"}));
    const synAsk=tasks.filter(t=>!t.node).map(t=>({task:t.id,title:t.title,field:"Синапс",from:null,to:null,reason:"задача без точки"}));
    const over=overloads.map(o=>o.type==="день"?{field:null,reason:`перегруз ${o.date}: ${o.load} ч при ёмкости ${o.cap} ч`}:
      {task:o.task,title:nm(o.task),field:null,reason:`дедлайн ${o.deadline}: ${o.reason}`});
    const all=[...over,...moves,...hoursAsk,...synAsk];

    /* --- верхние N открытых точек по баллу — калибровка весов (§7 п. 6); шагов может не быть --- */
    const top=nodes.filter(n=>g.isOpen(n)).map(n=>({node:n.id,title:n.title,...nodeScore(n),steps:(tasksOfNode.get(n.id)||[]).length}))
      .sort((a,b)=>b.total-a.total||a.title.localeCompare(b.title)).slice(0,P.topN);

    /* --- точки по неделям и месяцам (дальний горизонт стены) --- */
    for(const b of buckets){const m=new Map();for(const id of b.tasks){const t=byTask.get(id),k=t.node||"—";if(!m.has(k))m.set(k,{node:t.node,title:t.node?g.byId(t.node).title:"без точки",hours:0,n:0});const x=m.get(k);x.hours=r1(x.hours+t.h);x.n++}
      b.points=[...m.values()].sort((a,c)=>c.hours-a.hours)}

    /* --- паспорт данных --- */
    const evKinds={}; for(const e of data.calendar||[])evKinds[e.kind]=(evKinds[e.kind]||0)+1;
    const passport={
      today:start, open:tasks.length, overduePlan:tasks.filter(t=>t.planned&&t.planned<start).length,
      noDates:tasks.filter(t=>!t.planned&&!t.deadline).length, withDeadline:tasks.filter(t=>t.deadline).length,
      merkor:tasks.filter(t=>t.merkor).length, noNode:tasks.filter(t=>!t.node).length,
      bind:{синапс:tasks.filter(t=>t.bind==="синапс").length,проект:tasks.filter(t=>t.bind==="проект").length,задача:tasks.filter(t=>t.bind==="задача").length},
      hours:{владелец:tasks.filter(t=>t.hSrc==="владелец").length,Дворник:tasks.filter(t=>t.hSrc==="Дворник").length,нет:tasks.filter(t=>t.hSrc==="нет оценки").length},
      nodes:nodes.length, loops:loops.length, calendar:evKinds, officeDays:days.filter(d=>d.office).length,
      capacity:{days:r1(days.reduce((s,d)=>s+d.cap.total,0)),perDayOwn:r1(perDay.own),perWeekMerkor:r1(perDay.merkor*7)},
      placed:{days:[...placed.values()].filter(p=>p.where==="day").length,weeks:[...placed.values()].filter(p=>p.where==="week").length,
        months:[...placed.values()].filter(p=>p.where==="month").length,none:undated.length}
    };

    /* --- строки журнала «предложено» (дописываются задачей; check.js сверяет префикс).
           Только показанные в треде позиции (≤ proposalLimit): непоказанное не предлагалось, а журнал
           не должен расти на сотни строк за прогон (хранилище стены — до 25 000 документов) --- */
    const stamp=start.replace(/-/g,"");
    const logAppend=all.slice(0,P.proposalLimit).filter(p=>p.task&&p.field).map(p=>({id:`${p.task}-${stamp}-${p.field==="Плановая дата"?"d":p.field==="Синапс"?"s":"h"}`,
      task:p.task,date:start,field:p.field,proposed:p.to,was:p.from,answer:null}));

    return {
      version:VERSION, engine:"engine.js "+VERSION, graph:"graph.js "+(G.VERSION||"?"), today:start, params:P,
      passport, learn:learn.report, top,
      days:days.map(d=>({date:d.date,dow:d.dow,office:d.office,route:d.route,travel:d.travel,officeH:d.officeH,homeFree:d.homeFree,cap:d.cap,load:d.load,bricks:d.bricks})),
      buckets:buckets.filter(b=>b.tasks.length||b.type==="week").map(b=>({type:b.type,start:b.start,end:b.end,cap:b.cap,load:b.load,tasks:b.tasks,points:b.points})),
      placements:Object.fromEntries(placed), undated, overloads,
      tasks:tasks.map(t=>({id:t.id,title:t.title,node:t.node,bind:t.bind,score:t.score,hours:t.h,hSrc:t.hSrc,deadline:t.deadline,planned:t.planned,merkor:t.merkor,spheres:t.spheres,bg:t.bg,pre:[...preTasks.get(t.id)]})),
      proposals:{all,top:all.slice(0,P.proposalLimit)}, logAppend, notes
    };
  }

  /* ---------- обучение (§3.4) ---------- */
  function learnFrom(log,history,tasks,P){
    const sph=t=>(t.spheres||[])[0]||"—";
    // часы: «владелец / Дворник» по поправленным позициям журнала
    const rat=log.filter(l=>l.field==="Трудоёмкость, ч"&&l.proposed>0&&l.answer&&l.final>0).map(l=>({s:l.sphere||"—",r:l.final/l.proposed}));
    const allR=median(rat.map(x=>x.r));
    const bySph={}; for(const x of rat)(bySph[x.s]=bySph[x.s]||[]).push(x.r);
    const hoursCoef=t=>{const a=bySph[sph(t)];return a&&a.length>=5?median(a):allR??1};
    // стартовый ряд: сдвиг «факт − план» в днях по закрытым не снятым задачам
    const sh=history.filter(h=>!h.removed&&h.planned&&h.done).map(h=>d2n(dateOnly(h.done))-d2n(dateOnly(h.planned)));
    const late=sh.filter(x=>x>0);
    return {hoursCoef, report:{
      hoursCoef:allR==null?"нет данных (правок часов в журнале нет)":r1(allR), hoursEdits:rat.length,
      startSeries:{n:sh.length,median:median(sh),p75:quant(sh,0.75),p90:quant(sh,0.9),lateShare:sh.length?Math.round(100*late.length/sh.length):null,lateMedian:median(late)},
      removedExcluded:history.filter(h=>h.removed).length
    }};
  }

  /* ---------- документ стены plan/current (SPEC §2.2): проекция раскладки под лимит 256 КБ на документ.
     Задачи — только те, что стоят кирпичами или в перегрузах; дальний горизонт — точками без задач.
     wall(plan, checkResult, {mode, ranAt}) → объект для записи в plan/current ---------- */
  function wall(p,res,meta){
    meta=meta||{};
    const need=new Set(); for(const d of p.days)for(const b of d.bricks)need.add(b.task);
    for(const o of p.overloads)if(o.task)need.add(o.task);
    for(const x of p.proposals.top)if(x.task)need.add(x.task);
    const T={}; for(const t of p.tasks)if(need.has(t.id))T[t.id]={title:t.title,node:t.node,hours:t.hours,hSrc:t.hSrc,
      deadline:t.deadline,planned:t.planned,merkor:t.merkor,sphere:(t.spheres||[])[0]||null,bg:t.bg?1:0,where:(p.placements[t.id]||{}).date||null};
    const nodeTitle={}; for(const t of p.top)nodeTitle[t.node]=t.title;
    for(const b of p.buckets)for(const x of b.points)if(x.node)nodeTitle[x.node]=x.title;
    return {
      schema:"stena/plan 1", mode:meta.mode||"живой", ranAt:meta.ranAt||null, version:p.version, engine:p.engine, graph:p.graph, today:p.today,
      check:res?{ok:!!res.ok,violations:(res.violations||[]).slice(0,30),nViolations:(res.violations||[]).length,counts:res.counts||{}}:null,
      passport:p.passport, learn:p.learn, top:p.top, overloads:p.overloads,
      days:p.days.map(d=>({...d,bricks:d.bricks.map(b=>({task:b.task,hours:b.hours,pool:b.pool,role:b.role}))})),
      buckets:p.buckets.map(b=>({type:b.type,start:b.start,end:b.end,cap:b.cap,load:b.load,n:b.tasks.length,points:b.points})),
      tasks:T, nodeTitle,
      proposals:{total:p.proposals.all.length,top:p.proposals.top.map(x=>({task:x.task||null,field:x.field||null,from:x.from||null,to:x.to||null,slot:x.slot||null,reason:x.reason}))},
      params:{window:p.params.window,homeShare:p.params.homeShare,officeOwnShare:p.params.officeOwnShare,capFactor:p.params.capFactor,
        defaultHours:p.params.defaultHours,heavyPerWeek:p.params.heavyPerWeek,weights:p.params.weights,proposalLimit:p.params.proposalLimit},
      notes:p.notes
    };
  }

  return {VERSION,DEFAULTS,plan,wall,dayCapacity,_dates:{d2n,n2d,addD,dow,monday,toMsk}};
});
