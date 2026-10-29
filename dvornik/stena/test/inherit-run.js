/* Дворник · test/inherit-run.js v0.1 · 29.10.2026 — наследование балла (engine 0.1.2, SPEC §3.1).
   Цепочка шаг → цель: цель «в работе», шаг сам по себе слабый. Ждём: шаг не ниже цели и помечен from; при inherit:false — свой балл. */
const path=require("path");
const G=require(path.join(__dirname,"../../../graph.js"));
const E=require(path.join(__dirname,"../engine.js"));
const {input}=require("./fixture.js");
const step={id:"zzstep",title:"Шаг к цели",status:"open",spheres:[],deps:[],links:[],x:0.5,y:0};
const goal={id:"zzgoal",title:"Цель в работе",status:"open",active:true,spheres:[],deps:["zzstep"],links:[],x:0.5,y:0.1};
const done={id:"zzdone",title:"Закрытая цель",status:"done",active:true,spheres:[],deps:["zzstep2"],links:[],x:0.5,y:0.2};
const step2={id:"zzstep2",title:"Шаг к закрытой",status:"open",spheres:[],deps:[],links:[],x:0.5,y:0.3};
const mk=inh=>E.plan({...input,nodes:[...input.nodes,step,goal,done,step2],params:{...(input.params||{}),topN:999,inherit:inh}},G);
const by=(p,id)=>p.top.find(t=>t.node===id);
const on=mk(true), off=mk(false);
const r=[
 ["шаг наследует балл цели", by(on,"zzstep").total===by(on,"zzgoal").total && by(on,"zzstep").from&&by(on,"zzstep").from.node==="zzgoal"],
 ["свой балл шага сохранён", by(on,"zzstep").own===by(off,"zzstep").total && by(on,"zzstep").own<by(on,"zzgoal").total],
 ["закрытая цель не передаёт балл", !by(on,"zzstep2").from],
 ["inherit:false — без наследования", !by(off,"zzstep").from && by(off,"zzstep").total<by(off,"zzgoal").total],
];
r.forEach(([n,ok])=>console.log((ok?"да ":"НЕТ")+"  "+n));
const bad=r.filter(x=>!x[1]).length; console.log(bad?`провалено ${bad} из ${r.length}`:`все ${r.length} проверки — да`); process.exit(bad?1:0);
