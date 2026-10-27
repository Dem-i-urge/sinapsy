/* Синапсы · graph.js v0.1 · 27.10.2026
   Расчёты графа карты «Синапсы»: один файл для карты (рисует) и Дворника (считает).
   Чистые функции: без DOM, сети и d3. Дом — Dem-i-urge/sinapsy; опубликованный файл карты — проекция.
   Использование: const G = SinapsyGraph.make(nodes, spheres); G.unlockCount(G.byId(id)) …
   В браузере — глобальный SinapsyGraph, в node — require('./graph.js'). */
(function(root,factory){ if(typeof module==="object"&&module.exports)module.exports=factory(); else root.SinapsyGraph=factory(); })(typeof self!=="undefined"?self:this,function(){
  "use strict";
  /* уровни — это кольца: уровень точки следует из её места (радиуса), отдельного поля нет.
     0 ядро · 1 фундамент (малый круг) · 2 контекст (средний) · 3 продукт (внешний); полоса перед кольцом — то, что к нему строится */
  const LEVELS=[{id:"core",name:"Ядро",r:.1},{id:"found",name:"Фундамент",r:.26},{id:"ctx",name:"Контекст",r:.55},{id:"prod",name:"Продукт",r:.86}];
  const isOpen=n=>n&&n.status!=="done";
  /* типы: проект собирается из задач — его зависимости и есть его задачи (сигнал идёт от задач к проекту) */
  const isProject=n=>!!n&&n.kind==="project";
  const rOf=n=>Math.hypot(+n.x||0,+n.y||0);
  const levelOf=n=>{const r=rOf(n);return r<.28?0:r<.42?1:r<.76?2:3};

  /* граф одного снимка данных: связи (ассоциации) и зависимости (deps у точки = что нужно сначала) */
  function make(nodes,spheres){
    nodes=nodes||[]; spheres=spheres||[];
    const map=new Map(nodes.map(n=>[n.id,n])), dep=new Map(), lk=new Map();
    const add=(m,k,v,set)=>{let x=m.get(k);if(!x){x=set?new Set():[];m.set(k,x)}set?x.add(v):x.push(v)};
    nodes.forEach(n=>{ (n.deps||[]).forEach(d=>{if(d!==n.id)add(dep,d,n.id)});
      (n.links||[]).forEach(l=>{if(l!==n.id){add(lk,n.id,l,1);add(lk,l,n.id,1)}}); });
    const byId=id=>map.get(id);
    const sphIdx=s=>spheres.indexOf(s);
    const linksOf=n=>[...(lk.get(n.id)||[])].filter(byId);
    const prereqsOf=n=>(n.deps||[]).filter(id=>id!==n.id&&byId(id));
    const dependentsOf=n=>(dep.get(n.id)||[]).filter(byId);
    const walk=(id,next)=>{const seen=new Set(),st=[id];while(st.length){const c=byId(st.pop());if(!c)continue;for(const x of next(c))if(x!==id&&!seen.has(x)){seen.add(x);st.push(x)}}return seen};
    const upstream=n=>walk(n.id,prereqsOf);
    const downstream=n=>walk(n.id,dependentsOf);
    const isBlocked=n=>isOpen(n)&&prereqsOf(n).some(id=>isOpen(byId(id)));
    /* охват: свои сферы плюс сферы всех связанных точек (только сферы, которые есть на круге) */
    const reachOf=n=>{const s=new Set((n.spheres||[]).filter(x=>sphIdx(x)>=0));
      [...linksOf(n),...prereqsOf(n),...dependentsOf(n)].forEach(id=>(byId(id).spheres||[]).forEach(x=>{if(sphIdx(x)>=0)s.add(x)}));return [...s]};
    const isRich=n=>reachOf(n).length>=2;
    const unlockCount=n=>[...downstream(n)].filter(id=>isOpen(byId(id))).length;
    const degree=n=>linksOf(n).length+prereqsOf(n).length+dependentsOf(n).length;
    const progressOf=n=>{const pre=prereqsOf(n).map(byId);return{done:pre.filter(m=>!isOpen(m)).length,total:pre.length}};
    /* критическая цепь: самая длинная цепочка незакрытых шагов в точку и из неё (по числу шагов) */
    function critOf(id){
      const mu=new Map(), md=new Map();
      const up=(i,st)=>{ if(mu.has(i))return mu.get(i); if(st.has(i))return []; st.add(i); let b=[];
        for(const p of prereqsOf(byId(i))){ if(!isOpen(byId(p)))continue; const c=up(p,st); if(c.length+1>b.length)b=[...c,p]; }
        st.delete(i); mu.set(i,b); return b; };
      const down=(i,st)=>{ if(md.has(i))return md.get(i); if(st.has(i))return []; st.add(i); let b=[];
        for(const d of dependentsOf(byId(i))){ if(!isOpen(byId(d)))continue; const c=down(d,st); if(c.length+1>b.length)b=[d,...c]; }
        st.delete(i); md.set(i,b); return b; };
      return {up:up(id,new Set()),down:down(id,new Set())};
    }
    /* узкие места: незакрытые точки, за которыми по цепочке ждёт больше всего незакрытого */
    const bottlenecks=k=>nodes.filter(isOpen).map(n=>({n,u:unlockCount(n)})).filter(x=>x.u>=3).sort((a,b)=>b.u-a.u).slice(0,k);
    /* заколдованный круг — точки в пути, которые ждут друг друга (сильная компонента графа зависимостей, Тарьян).
       Сделанная точка круг разрывает: считаются только точки в пути. */
    let loops=null;
    function findLoops(){ const ix=new Map(), low=new Map(), on=new Set(), st=[], out=[]; let i=0;
      const succ=v=>dependentsOf(v).map(byId).filter(isOpen);
      const sc=v=>{ ix.set(v.id,i); low.set(v.id,i); i++; st.push(v); on.add(v.id);
        for(const w of succ(v)){ if(!ix.has(w.id)){sc(w);low.set(v.id,Math.min(low.get(v.id),low.get(w.id)))}
          else if(on.has(w.id))low.set(v.id,Math.min(low.get(v.id),ix.get(w.id))) }
        if(low.get(v.id)===ix.get(v.id)){const comp=[];let w;do{w=st.pop();on.delete(w.id);comp.push(w.id)}while(w.id!==v.id);if(comp.length>1)out.push(comp)} };
      nodes.filter(isOpen).forEach(v=>{if(!ix.has(v.id))sc(v)}); loops=out; return out; }
    const loopOf=id=>(loops||findLoops()).find(c=>c.includes(id))||null;
    return {nodes,spheres,byId,sphIdx,linksOf,prereqsOf,dependentsOf,upstream,downstream,isOpen,isBlocked,reachOf,isRich,
      unlockCount,degree,isProject,progressOf,rOf,levelOf,critOf,bottlenecks,findLoops,loopOf};
  }
  return {VERSION:"0.1",LEVELS,make,isOpen,isProject,rOf,levelOf};
});
