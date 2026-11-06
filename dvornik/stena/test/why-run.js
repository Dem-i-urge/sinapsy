/* Дворник · test/why-run.js v0.1 · 06.11.2026
   Причина раскладки (engine 0.1.4): у каждой разложенной задачи есть why; документ стены несёт why и project;
   бэклог владельца (ownerUndated) — «без даты» с причиной «бэклог». node test/why-run.js [wall.json] */
const path=require("path"), fs=require("fs");
const G=require(path.join(__dirname,"../../../graph.js"));
const E=require(path.join(__dirname,"../engine.js"));
const C=require(path.join(__dirname,"../check.js"));
const {input}=require("./fixture.js");
let ok=0, bad=0; const t=(name,cond,info)=>{cond?ok++:bad++;console.log((cond?"да ":"нет")+"  "+name+(info?" · "+info:""))};

const inp=JSON.parse(JSON.stringify(input));
const undatedId=inp.tasks.find(x=>!x.deadline).id; inp.ownerUndated=[...(inp.ownerUndated||[]),undatedId];
const p=E.plan(inp,G);
const pl=Object.entries(p.placements);
const noWhy=pl.filter(([,x])=>!x.why);
t("у каждой разложенной задачи есть причина",noWhy.length===0,noWhy.length?noWhy.map(([id])=>id).join(", "):pl.length+" задач");
t("бэклог владельца — «без даты» с причиной",p.placements[undatedId]&&p.placements[undatedId].where==="none"&&/бэклог/.test(p.placements[undatedId].why),JSON.stringify(p.placements[undatedId]));
const kinds={}; for(const [,x] of pl){const k=x.why.split(/[ :—→(]/)[0];kinds[k]=(kinds[k]||0)+1}
t("причины различаются по путям раскладки",Object.keys(kinds).length>=3,JSON.stringify(kinds));
const res=C.check(inp,p,{prevLog:inp.log||[],newLog:[...(inp.log||[]),...p.logAppend]});
t("проверка check.js не сломалась от нового поля",res.ok,res.violations.slice(0,3).map(v=>v.inv+": "+v.msg).join(" | "));
const W=E.wall(p,res,{mode:"сухой",ranAt:"2026-11-06T12:00:00Z"});
const wt=Object.values(W.tasks);
t("документ стены несёт why у каждой задачи",wt.length>0&&wt.every(x=>typeof x.why==="string"&&x.why),wt.length+" задач");
t("документ стены несёт поле project",wt.every(x=>"project" in x),wt.filter(x=>x.project).length+" с проектом");
t("документ стены в пределах 250 КБ",Buffer.byteLength(JSON.stringify(W))<250*1024,Buffer.byteLength(JSON.stringify(W))+" Б");
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(W));
console.log(bad?`нет — ${bad} из ${ok+bad}`:`все ${ok} проверок — да`);
process.exit(bad?1:0);
