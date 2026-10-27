/* Дворник · adapt.js v0.1-draft · 27.10.2026
   Собирает вход engine.js из выгрузок прогона. Сеть не трогает: файлы кладёт задача, прочитав источники.
   node adapt.js <dir> <today> > input.json, где в <dir>:
     open.json  — ответ SQL по открытым «Задачам» (запрос ниже, одна строка group_concat);
     done.json  — ответ SQL по закрытым (запрос ниже);
     nodes/     — ArtifactData list nodes с out_dir (id — имя файла, а не поле тела: мель Лоции 27.10);
     spheres.json — meta/spheres карты ({list:[…]});
     calendar.json — [{kind, start, end, away?}] — события уже разобраны декодером Диспетчерской:
       kind ∈ office | session_online | session_inperson | other; имена встреч сюда не попадают (клиника).
     stena.json (необязательно) — {log, ownerUndated, estimates, params} из хранилища стены.
   Запросы (разделитель полей ¦, строк ‖ — одна строка ответа уходит в файл целиком, без постраничной выдачи):
     open: SELECT count(*) n, group_concat(substr(url,-32)||'¦'||"Задача"||'¦'||coalesce("Статус",'')||'¦'||coalesce("Сфера",'')||'¦'||
           coalesce("Проект",'')||'¦'||coalesce("Синапс",'')||'¦'||coalesce("Трудоёмкость, ч",'')||'¦'||coalesce("Приоритет",'')||'¦'||
           coalesce("date:Плановая дата:start",'')||'¦'||coalesce("date:Дедлайн:start",'')||'¦'||substr(createdTime,1,10),'‖') rows
           FROM <Задачи> WHERE "Статус"<>'Done' OR "Статус" IS NULL
     done: SELECT count(*) n, group_concat(substr(url,-32)||'¦'||coalesce("date:Плановая дата:start",'')||'¦'||
           coalesce("date:Дата выполнения:start",'')||'¦'||coalesce("Снято",'')||'¦'||coalesce("Трудоёмкость, ч",'')||'¦'||
           coalesce("Сфера",'')||'¦'||substr(createdTime,1,10),'‖') rows FROM <Задачи> WHERE "Статус"='Done' */
const fs=require("fs"), path=require("path");
const J=(p)=>JSON.parse(fs.readFileSync(p,"utf8"));
const arr=s=>{if(!s)return [];try{return JSON.parse(s)}catch(e){return []}};
function rowsOf(file){const d=J(file);const r=(d.results||d)[0];const rows=r.rows?r.rows.split("‖"):[];
  if(+r.n!==rows.length)throw new Error(`${path.basename(file)}: n=${r.n}, строк ${rows.length} — выгрузка неполная`);return rows.map(x=>x.split("¦"))}
function adapt(dir,today){
  const open=rowsOf(path.join(dir,"open.json")).map(f=>{if(f.length!==11)throw new Error("открытая задача: полей "+f.length+" в «"+f[1]+"»");
    return {id:f[0],title:f[1],status:f[2]||"Not started",spheres:arr(f[3]),projects:arr(f[4]),synapse:f[5]||null,hours:f[6]===""?null:+f[6],
      priority:f[7]||null,planned:f[8]||null,deadline:f[9]||null,created:f[10]}});
  const history=rowsOf(path.join(dir,"done.json")).map(f=>({id:f[0],planned:f[1]||null,done:f[2]||null,removed:f[3]==="__YES__",hours:f[4]===""?null:+f[4],spheres:arr(f[5]),created:f[6]}));
  const nd=path.join(dir,"nodes");
  const nodes=fs.readdirSync(nd).filter(f=>f.endsWith(".json")).map(f=>{const d=J(path.join(nd,f));return {...(d.data||d),id:path.basename(f,".json")}});
  const spheres=(J(path.join(dir,"spheres.json")).list)||[];
  const calendar=J(path.join(dir,"calendar.json"));
  const st=fs.existsSync(path.join(dir,"stena.json"))?J(path.join(dir,"stena.json")):{};
  return {today,tasks:open,history,nodes,spheres,calendar,log:st.log||[],ownerUndated:st.ownerUndated||[],estimates:st.estimates||{},params:st.params||{}};
}
if(require.main===module){const [dir,today]=process.argv.slice(2);if(!dir||!/^\d{4}-\d\d-\d\d$/.test(today||"")){console.error("node adapt.js <dir> <ГГГГ-ММ-ДД>");process.exit(2)}
  process.stdout.write(JSON.stringify(adapt(dir,today)))}
module.exports={adapt};
