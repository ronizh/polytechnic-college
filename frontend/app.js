const $ = s => document.querySelector(s), esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const KIND = {current:"Текущая",test:"Контрольная",practical:"Практическая",independent:"Самостоятельная",final:"Итоговая"};
const DAYS = ["Пн","Вт","Ср","Чт","Пт"];
let T = localStorage.token, ME = null, charts = [], opts = null;
document.documentElement.dataset.theme = localStorage.theme || "light";

function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400)}
async function api(p, o = {}) {
  const r = await fetch("/api" + p, {method:o.method||"GET", headers:{"Content-Type":"application/json", Authorization:"Bearer " + T}, body:o.body?JSON.stringify(o.body):undefined});
  if (!r.ok) { const e = await r.json().catch(()=>({})); if (r.status===401 && ME) logout(); throw new Error(typeof e.detail==="string"?e.detail:"Проверьте введённые данные"); }
  return r;
}
const j = async (p, o) => (await api(p, o)).json();
const act = async (p, o, msg) => { try { await api(p, o); if (msg) toast(msg); return true } catch (e) { toast(e.message); return false } };
function chart(id, cfg){ charts.forEach(c=>c.destroy()); charts=[]; charts.push(new Chart($(id), cfg)) }
function mkChart(id, cfg){ charts.push(new Chart($(id), cfg)) }
const band = v => v>=90?5:v>=70?4:v>=50?3:2;
const chip = g => `<button class="chip g${band(g.value)}" data-id="${g.id}" title="${KIND[g.kind]}, ${g.date}">${g.value}</button>`;

$("#theme").onclick = () => { const d = document.documentElement.dataset.theme==="dark"?"light":"dark"; document.documentElement.dataset.theme=d; localStorage.theme=d; };
$("#authbtn").onclick = () => ME ? logout() : loginView();
function logout(){ localStorage.removeItem("token"); T=null; ME=null; start(); }

async function start() {
  charts.forEach(c=>c.destroy()); charts=[];
  if (T) { try { ME = await j("/me"); } catch { ME = null; } }
  document.body.classList.toggle("app",!!ME); document.body.classList.remove("open"); $("#who").textContent=ME?ME.name:"";
  if (!ME) { $("#nav").innerHTML=""; $("#authbtn").textContent="Войти"; return home(); }
  $("#authbtn").textContent = "Выйти";
  const tabs = {
    student:[["Обзор",stuView],["Расписание",schedView],["Новости",newsView],["Профиль",profileView]],
    teacher:[["Журнал",journalView],["Задания",hwView],["Расписание",schedView],["Новости",newsView],["Профиль",profileView]],
    admin:[["Аналитика",statsView],["Пользователи",usersView],["Журнал",journalView],["Учебная часть",structView],["Новости",newsView],["Профиль",profileView]]}[ME.role];
  $("#nav").innerHTML = tabs.map((t,i)=>`<button data-i="${i}">${t[0]}</button>`).join("");
  $("#nav").onclick = e => { const b=e.target.closest("button"); if(!b) return; document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("on",x===b)); tabs[b.dataset.i][1](); };
  $("#nav button").click();
}

async function home() {
  const p = await fetch("/api/public").then(r=>r.json());
  $("#main").innerHTML = `<section class="hero"><h1>Колледж, в котором всё учебное — в одном месте</h1>
    <p>Оценки, расписание, домашние задания и новости для студентов, преподавателей и администрации.</p>
    <button class="primary" id="go">Личный кабинет</button></section>
    <h2>Специальности</h2><div class="grid">${p.groups.map(g=>`<div class="card"><h3>${esc(g.specialty)}</h3><span class="tag">${esc(g.name)}</span> <span class="mute">${g.course} курс</span></div>`).join("")}</div>
    <h2>Новости</h2><div class="grid">${p.news.map(n=>`<div class="card"><h3>${esc(n.title)}</h3><p class="mute">${esc(n.body)}</p><small>${n.date}</small></div>`).join("")}</div>
    <h2>Контакты</h2><div class="card">г. Алматы · +7 (727) 000-00-00 · info@polytech.example · Пн–Пт 8:30–17:30</div>`;
  $("#go").onclick = loginView;
}

function loginView() {
  $("#main").innerHTML = `<div class="login"><div class="card"><h2>Вход в систему</h2>
    <input id="l" placeholder="Логин" autocomplete="username"><input id="p" type="password" placeholder="Пароль" autocomplete="current-password">
    <div id="e" class="err"></div><button class="primary" id="ok">Войти</button>
    <small class="mute">Демо: student1 / student123 · teacher1 / teacher123 · admin / admin123</small></div></div>`;
  const go = async () => { try { const r = await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({login:$("#l").value,password:$("#p").value})});
    const d = await r.json(); if(!r.ok) throw new Error(d.detail||"Ошибка"); T=d.token; localStorage.token=T; start(); } catch(e){ $("#e").textContent=e.message } };
  $("#ok").onclick = go; $("#p").onkeydown = e => { if (e.key === "Enter") go(); }; $("#l").focus();
}

async function stuView() {
  const s = await j("/student/summary");
  $("#main").innerHTML = `<h1>${esc(ME.name)}</h1><p class="mute">${esc(ME.group.name)} · ${esc(ME.group.specialty)} · ${ME.group.course} курс</p>
  <div class="grid"><div class="card"><h3>Средний балл (GPA)</h3><div class="big">${s.gpa}</div></div>
  <div class="card"><h3>Посещаемость</h3><div class="big">${s.attendance}%</div></div>
  <div class="card"><h3>Оценок получено</h3><div class="big">${s.grades.length}</div></div></div>
  <div class="grid"><div class="card"><h3>Средний балл по предметам</h3><canvas id="c1"></canvas></div>
  <div class="card"><h3>Распределение оценок</h3><canvas id="c2"></canvas></div></div>
  <div class="grid"><div class="card"><h3>Домашние задания и дедлайны</h3>${s.homework.map(h=>`<p><b>${esc(h.title)}</b><br><span class="mute">${esc(h.subject)} · до ${h.due}</span></p>`).join("")}</div>
  <div class="card wrap"><h3>Последние оценки</h3><table>${s.grades.slice(0,10).map(g=>`<tr><td>${esc(g.subject)}</td><td class="mute">${KIND[g.kind]}</td><td>${chip(g)}</td></tr>`).join("")}</table></div></div>`;
  chart("#c1",{type:"bar",data:{labels:s.per_subject.map(x=>x.name),datasets:[{data:s.per_subject.map(x=>x.avg),backgroundColor:"#2ea0ff",borderRadius:6}]},options:{plugins:{legend:{display:false}},scales:{y:{min:0,max:100}}}});
  mkChart("#c2",{type:"doughnut",data:{labels:["0–49","50–69","70–89","90–100"],datasets:[{data:["fail","ok","good","top"].map(k=>s.dist[k]),backgroundColor:["#d64545","#e0a030","#4a90e2","#1f9d63"]}]}});
}

async function schedView() {
  let gid = ME.group?.id, groups = [];
  if (ME.role==="admin") { groups = await j("/teacher/options").then(o=>o.groups); gid = gid || groups[0].id; }
  const draw = async () => {
    const rows = await j("/schedule" + (ME.role==="admin" ? "?group_id="+gid : ""));
    $("#main").innerHTML = `<h1>Расписание</h1>${ME.role==="admin"?`<div class="row"><select id="sg">${groups.map(g=>`<option value="${g.id}" ${g.id==gid?"selected":""}>${esc(g.name)}</option>`).join("")}</select></div>`:""}
    <div class="grid">${DAYS.map((d,i)=>`<div class="card"><h3>${d}</h3>${rows.filter(r=>r.day===i).map(r=>`<p><b>${r.time}</b> ${esc(r.subject)}<br><span class="mute">ауд. ${esc(r.room)}${ME.role==="teacher"?" · "+esc(r.grp):""}</span></p>`).join("")||'<p class="mute">Занятий нет</p>'}</div>`).join("")}</div>`;
    if ($("#sg")) $("#sg").onchange = e => { gid = e.target.value; draw(); };
  };
  draw();
}

async function newsView() {
  const n = await j("/news"), canEdit = ME.role !== "student";
  $("#main").innerHTML = `<h1>Новости</h1>${canEdit?`<div class="card" style="margin-bottom:16px"><h3>Опубликовать объявление</h3><div class="row"><input id="nt" placeholder="Заголовок"><input id="nb" placeholder="Текст" style="flex:1"><button class="primary" id="np">Опубликовать</button></div></div>`:""}
  <div class="grid">${n.map(x=>`<div class="card"><h3>${esc(x.title)}</h3><p class="mute">${esc(x.body)}</p><small>${x.date} · ${esc(x.author)}</small>${ME.role==="admin"?` <button class="ghost" data-del="${x.id}">Удалить</button>`:""}</div>`).join("")}</div>`;
  if (canEdit) $("#np").onclick = async () => { if (await act("/news",{method:"POST",body:{title:$("#nt").value,body:$("#nb").value}},"Опубликовано")) newsView(); };
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{ if(await act("/news/"+b.dataset.del,{method:"DELETE"},"Удалено")) newsView(); });
}

async function journalView() {
  opts = opts || await j("/teacher/options");
  const st = window.jst = window.jst || {};
  st.g = st.g || opts.groups[0].id; st.s = st.s || opts.subjects[0]?.id; st.k = st.k || ""; st.d = st.d || "";
  const rows = await j(`/journal?group_id=${st.g}&subject_id=${st.s}&kind=${st.k}&date_from=${st.d}`);
  $("#main").innerHTML = `<h1>Электронный журнал</h1><div class="row">
    <select id="fg">${opts.groups.map(g=>`<option value="${g.id}" ${g.id==st.g?"selected":""}>${esc(g.name)}</option>`).join("")}</select>
    <select id="fs">${opts.subjects.map(g=>`<option value="${g.id}" ${g.id==st.s?"selected":""}>${esc(g.name)}</option>`).join("")}</select>
    <select id="fk"><option value="">Все типы</option>${Object.entries(KIND).map(([k,v])=>`<option value="${k}" ${k==st.k?"selected":""}>${v}</option>`).join("")}</select>
    <input id="fd" type="date" value="${st.d}" title="Оценки с даты"><input id="fq" placeholder="Поиск студента">
    <button class="ghost" id="ex">Экспорт в Excel</button><button class="ghost" id="pr">Печать / PDF</button></div>
  <div class="card wrap"><table id="jt"><tr><th>Студент</th><th>Оценки</th><th>Ср.</th><th>Посещ.</th><th>Новая оценка</th><th>Сегодня</th></tr>
  ${rows.map(r=>`<tr data-n="${esc(r.name.toLowerCase())}"><td>${esc(r.name)}</td><td>${r.grades.map(chip).join("")}</td><td>${r.avg}</td><td>${r.att}%</td>
   <td><select data-k="${r.id}">${Object.entries(KIND).map(([k,v])=>`<option value="${k}">${v}</option>`).join("")}</select>
   <input type="number" min="0" max="100" value="80" data-v="${r.id}" style="width:82px"><button class="primary" data-add="${r.id}">+</button></td>
   <td><button class="ghost" data-p="${r.id}:1">Был</button> <button class="ghost" data-p="${r.id}:0">Н</button></td></tr>`).join("")}</table></div>
  <p class="mute">Нажмите на оценку, чтобы изменить её — история изменений сохраняется.</p>`;
  const set = (id,key) => $(id).onchange = e => { st[key]=e.target.value; journalView(); };
  set("#fg","g"); set("#fs","s"); set("#fk","k"); set("#fd","d");
  $("#fq").oninput = e => document.querySelectorAll("#jt tr[data-n]").forEach(tr=>tr.hidden=!tr.dataset.n.includes(e.target.value.toLowerCase()));
  $("#pr").onclick = () => print();
  $("#ex").onclick = async () => { const b = await (await api(`/export?group_id=${st.g}&subject_id=${st.s}`)).blob(); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="journal.csv"; a.click(); };
  document.querySelectorAll("[data-add]").forEach(b=>b.onclick=async()=>{ const id=b.dataset.add;
    if (await act("/grade",{method:"POST",body:{student_id:+id,subject_id:+st.s,kind:$(`[data-k="${id}"]`).value,value:+$(`[data-v="${id}"]`).value}},"Оценка сохранена")) journalView(); });
  document.querySelectorAll("[data-p]").forEach(b=>b.onclick=async()=>{ const [id,p]=b.dataset.p.split(":");
    if (await act("/attendance",{method:"POST",body:{student_id:+id,subject_id:+st.s,present:p==="1"}},"Посещаемость отмечена")) journalView(); });
  document.querySelectorAll(".chip").forEach(c=>c.onclick=async()=>{ const h = await j(`/grade/${c.dataset.id}/history`);
    const v = prompt("Новая оценка (0–100):\n" + (h.length ? "История:\n"+h.map(x=>`${x.ts}: ${x.old}→${x.new} (${x.by_name})`).join("\n") : "Изменений ещё не было"), c.textContent);
    if (v && await act("/grade/"+c.dataset.id,{method:"PUT",body:{value:+v}},"Оценка изменена")) journalView(); });
}

async function hwView() {
  opts = opts || await j("/teacher/options");
  $("#main").innerHTML = `<h1>Домашние задания</h1><div class="card"><div class="row">
    <select id="hs">${opts.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
    <select id="hg">${opts.groups.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select>
    <input id="ht" placeholder="Название задания" style="flex:1"><input id="hd" type="date"><button class="primary" id="hb">Добавить задание</button></div></div>`;
  $("#hb").onclick = async () => { if (await act("/homework",{method:"POST",body:{subject_id:+$("#hs").value,group_id:+$("#hg").value,title:$("#ht").value,due:$("#hd").value}},"Задание добавлено")) $("#ht").value=""; };
}

async function statsView() {
  const s = await j("/admin/stats");
  $("#main").innerHTML = `<h1>Аналитика</h1><div class="grid">${Object.entries({students:"Студентов",teachers:"Преподавателей",groups:"Групп",subjects:"Предметов"}).map(([k,v])=>`<div class="card"><h3>${v}</h3><div class="big">${s.counts[k]}</div></div>`).join("")}</div>
  <div class="grid"><div class="card"><h3>Средний балл по группам</h3><canvas id="c1"></canvas></div><div class="card"><h3>Средний балл по предметам</h3><canvas id="c2"></canvas></div></div>`;
  const mk = (a,t)=>({type:t,data:{labels:a.map(x=>x.name),datasets:[{data:a.map(x=>x.avg),backgroundColor:"#2ea0ff",borderRadius:6}]},options:{plugins:{legend:{display:false}},scales:{y:{min:0,max:100}}}});
  chart("#c1",mk(s.by_group,"bar")); mkChart("#c2",mk(s.by_subject,"bar"));
}

async function usersView() {
  const [u, o] = await Promise.all([j("/admin/users"), j("/teacher/options")]);
  $("#main").innerHTML = `<h1>Пользователи</h1><div class="card" style="margin-bottom:16px"><h3>Добавить пользователя</h3><div class="row">
    <input id="un" placeholder="ФИО"><input id="ul" placeholder="Логин"><input id="up" type="password" placeholder="Пароль (от 6 символов)">
    <select id="ur"><option value="student">Студент</option><option value="teacher">Преподаватель</option><option value="admin">Администратор</option></select>
    <select id="ug">${o.groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join("")}</select><button class="primary" id="ua">Добавить</button></div></div>
  <div class="row"><input id="us" placeholder="Поиск по имени"></div>
  <div class="card wrap"><table id="ut">${u.map(x=>`<tr data-n="${esc(x.name.toLowerCase())}"><td>${esc(x.name)}</td><td class="mute">${esc(x.login)}</td><td><span class="tag">${x.role}</span></td><td>${esc(x.grp||"")}</td><td><button class="ghost" data-del="${x.id}">Удалить</button></td></tr>`).join("")}</table></div>`;
  $("#us").oninput = e => document.querySelectorAll("#ut tr").forEach(tr=>tr.hidden=!tr.dataset.n.includes(e.target.value.toLowerCase()));
  $("#ua").onclick = async () => { if (await act("/admin/users",{method:"POST",body:{name:$("#un").value,login:$("#ul").value,password:$("#up").value,role:$("#ur").value,group_id:+$("#ug").value}},"Пользователь добавлен")) usersView(); };
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{ if(confirm("Удалить пользователя?") && await act("/admin/users/"+b.dataset.del,{method:"DELETE"},"Удалено")) usersView(); });
}

async function structView() {
  const [u] = await Promise.all([j("/admin/users")]); const t = u.filter(x=>x.role==="teacher");
  $("#main").innerHTML = `<h1>Учебная часть</h1><div class="grid"><div class="card"><h3>Новая группа</h3><div class="row"><input id="gn" placeholder="Название"><input id="gs" placeholder="Специальность"><input id="gc" type="number" min="1" max="4" value="1" style="width:80px"><button class="primary" id="ga">Создать группу</button></div></div>
  <div class="card"><h3>Новый предмет</h3><div class="row"><input id="sn" placeholder="Название"><select id="st">${t.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select><button class="primary" id="sa">Добавить предмет</button></div></div></div>`;
  $("#ga").onclick = async () => { if (await act("/admin/groups",{method:"POST",body:{name:$("#gn").value,specialty:$("#gs").value,course:+$("#gc").value}},"Группа создана")) { opts=null; structView(); } };
  $("#sa").onclick = async () => { if (await act("/admin/subjects",{method:"POST",body:{name:$("#sn").value,teacher_id:+$("#st").value}},"Предмет добавлен")) { opts=null; structView(); } };
}

function profileView() {
  $("#main").innerHTML = `<h1>Профиль</h1><div class="grid"><div class="card"><h3>Данные</h3><div class="row"><input id="pn" value="${esc(ME.name)}" style="flex:1"><button class="primary" id="ps">Сохранить имя</button></div><p class="mute">Логин: ${esc(ME.login)}</p></div>
  <div class="card"><h3>Смена пароля</h3><div class="row"><input id="o" type="password" placeholder="Текущий"><input id="n" type="password" placeholder="Новый (от 6 символов)"><button class="primary" id="pc">Сменить пароль</button></div></div></div>`;
  $("#ps").onclick = async () => { if (await act("/me/name",{method:"POST",body:{name:$("#pn").value}},"Имя сохранено")) { ME.name=$("#pn").value; } };
  $("#pc").onclick = async () => { if (await act("/me/password",{method:"POST",body:{old:$("#o").value,new:$("#n").value}},"Пароль изменён")) { $("#o").value=$("#n").value=""; } };
}
