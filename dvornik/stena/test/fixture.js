/* Дворник · подставные данные для engine.js и check.js · v0.1 · 27.10.2026
   Неделя прогона начинается в пн 02.11.2026. Ничего живого: точки, задачи и календарь выдуманы. */
const P_M="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa01", P_C="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa02";
const U=id=>"https://claude.ai/artifact/NNPSJnwn5hP9fDbi4SdsPv#"+id;
const nodes=[
  {id:"A",title:"Ядро: инструмент",status:"open",x:0.05,y:0,spheres:["ИИ и технологии"],deps:[],links:[],kind:"task",notion:""},
  {id:"B",title:"Фундамент: схема",status:"open",x:0.35,y:0,spheres:["ИИ и технологии"],deps:["A"],links:[],kind:"task",notion:""},
  {id:"X",title:"Мост без шагов",status:"open",x:0.5,y:0.1,spheres:["Личное"],deps:["B"],links:[],kind:"task",notion:""},
  {id:"C",title:"Продукт",status:"open",x:0.9,y:0,spheres:["ИИ и технологии","Личное"],deps:["X"],links:[],kind:"project",notion:"https://app.notion.com/p/"+P_C},
  {id:"D",title:"Контекст в работе",status:"open",x:0,y:0.6,spheres:["Личное"],deps:[],links:["A"],kind:"task",notion:"",active:true},
  {id:"E",title:"Круг 1",status:"open",x:-0.6,y:0,spheres:["Личное"],deps:["F"],links:[],kind:"task",notion:""},
  {id:"F",title:"Круг 2",status:"open",x:-0.6,y:0.1,spheres:["Личное"],deps:["E"],links:[],kind:"task",notion:""},
  {id:"M",title:"Меркор: паспорта",status:"open",x:0.6,y:-0.3,spheres:["Меркор-ПРУФ"],deps:[],links:[],kind:"project",notion:"https://app.notion.com/p/"+P_M},
  {id:"H",title:"Сделано",status:"done",x:0.3,y:0.3,spheres:["Личное"],deps:[],links:[],kind:"task",notion:""}
];
const spheres=["ИИ и технологии","Меркор-ПРУФ","Личное"];
const T=(id,o)=>({id:"t"+String(id).padStart(30,"0"),title:"Задача "+id,status:"Not started",spheres:["Личное"],projects:[],synapse:null,hours:null,priority:null,planned:null,deadline:null,created:"2026-10-01",...o});
const tasks=[
  T(1,{title:"Шаг ядра",synapse:U("A"),hours:2,spheres:["ИИ и технологии"]}),
  T(2,{title:"Шаг фундамента",synapse:U("B"),hours:1,spheres:["ИИ и технологии"]}),
  T(3,{title:"Шаг продукта без оценки",synapse:U("C")}),
  T(4,{title:"Шаг продукта по проекту",projects:["https://app.notion.com/"+P_C],hours:1}),
  T(5,{title:"Меркор без дедлайна",spheres:["Меркор-ПРУФ"],projects:["https://app.notion.com/"+P_M],hours:3}),
  T(6,{title:"Меркор с дедлайном",spheres:["Меркор-ПРУФ"],hours:2,deadline:"2026-11-05"}),
  T(7,{title:"Дедлайн прошёл",hours:1,deadline:"2026-10-30"}),
  T(8,{title:"Закреп владельца",hours:1,planned:"2026-11-04"}),
  T(9,{title:"Без даты по решению владельца",hours:1}),
  T(10,{title:"Фоновый прогон агентов",spheres:["ИИ и технологии"]}),
  ...Array.from({length:10},(_,i)=>T(11+i,{title:"Наполнитель "+(i+1),hours:3,planned:"2026-10-15"})),
  T(21,{title:"Шаг круга 1",synapse:U("E"),hours:1}),
  T(22,{title:"Шаг круга 2",synapse:U("F"),hours:1}),
  T(23,{title:"Меркор большой с дедлайном",spheres:["Меркор-ПРУФ"],hours:20,deadline:"2026-11-12"}),
  T(24,{title:"Закрытая",status:"Done"})
];
// календарь: офис вт (полный день), ср (до 14:00), чт (полный); сессии пн 19–20 очно, ср 17–18 онлайн; сб — встреча вне дома
const cal=[];
for(let w=0;w<3;w++){const base=new Date(Date.UTC(2026,10,2+7*w));
  const d=k=>new Date(base.getTime()+k*864e5).toISOString().slice(0,10);
  cal.push({kind:"session_inperson",start:d(0)+"T19:00:00+03:00",end:d(0)+"T20:00:00+03:00"});
  cal.push({kind:"office",start:d(1)+"T09:00:00+03:00",end:d(1)+"T18:00:00+03:00"});
  cal.push({kind:"office",start:d(2)+"T10:00:00+03:00",end:d(2)+"T14:00:00+03:00"});
  cal.push({kind:"session_online",start:d(2)+"T14:00:00Z",end:d(2)+"T15:00:00Z"});   // 17–18 МСК, нарочно в UTC
  cal.push({kind:"office",start:d(3)+"T09:00:00+03:00",end:d(3)+"T18:00:00+03:00"});
  cal.push({kind:"other",away:true,start:d(5)+"T13:00:00+03:00",end:d(5)+"T17:00:00+03:00"});}
const history=[
  {planned:"2026-09-01",done:"2026-09-01"},{planned:"2026-09-02",done:"2026-09-05"},
  {planned:"2026-09-03",done:"2026-09-02"},{planned:"2026-09-04",done:"2026-09-14",removed:true}];
const prevLog=[{id:"x-20261026-d",task:"x",date:"2026-10-26",field:"Плановая дата",proposed:"2026-10-27",was:null,answer:"принял"}];
module.exports={input:{today:"2026-11-02",nodes,spheres,tasks,calendar:cal,history,log:prevLog,
  ownerUndated:[tasks[8].id],estimates:{[tasks[9].id]:{hours:2,bg:{attention:2,heavy:true}}}},prevLog};
