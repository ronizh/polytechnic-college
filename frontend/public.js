// Публичные страницы, язык, анимации. Логика кабинетов — в app.js.
const U = id => id.startsWith("img/") ? id : `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&q=70`;
const IM = {hero:"img/facade.jpg", facade:"img/facade.jpg", entrance:"img/entrance.jpg", lobby:"img/lobby.jpg", code:"1498050108023-c5249f4df085", code2:"1517694712202-14dd9538aa97", team:"1522202176988-66273c2fd55f",
  lab:"1519389950473-47ba0277781c", hall:"img/lobby.jpg", class:"1580582932707-520aed937b7b", grad:"1523050854058-8df90110c9f1", pc:"1581091226825-a6a2a5aee158"};
const ph = (k, c = "") => `<div class="ph ${c}"><img src="${U(IM[k] || IM.hero)}" alt="" loading="lazy" onerror="this.remove()"></div>`;
const I18N = {
  ru: {nav:["Главная","О колледже","Специальности","Новости","Контакты"], title:"Образование, которое создаёт будущее", sub:"Современное техническое образование: IT, программирование и инженерия с реальной практикой в лабораториях.",
       about:"Узнать о колледже", cab:"Личный кабинет", spec:"Популярные специальности", adv:"Наши преимущества", labs:"Современные лаборатории", news:"Новости колледжа", gal:"Жизнь колледжа",
       stats:["студентов","преподавателей","специальности","трудоустройство, %"], more:"Подробнее"},
  en: {nav:["Home","About","Programs","News","Contacts"], title:"Education that creates the future", sub:"Modern technical education: IT, programming and engineering with hands-on practice in real labs.",
       about:"Discover the college", cab:"My account", spec:"Popular programs", adv:"Why us", labs:"Modern laboratories", news:"College news", gal:"Campus life",
       stats:["students","teachers","programs","employment, %"], more:"Read more"}};
let lang = localStorage.lang || "ru", page = "home";
const t = () => I18N[lang];
$("#lang").textContent = lang.toUpperCase();
$("#lang").onclick = () => { lang = lang === "ru" ? "en" : "ru"; localStorage.lang = lang; $("#lang").textContent = lang.toUpperCase(); if (!ME) home(); };
$("#burger").onclick = () => document.body.classList.toggle("open");
document.addEventListener("click", e => { if (e.target.closest("#nav button") ) document.body.classList.remove("open"); });

const SPECS = [
  ["Информационные системы","Проектирование и сопровождение корпоративных систем, базы данных, аналитика.","code","3 г. 10 мес."],
  ["Программирование","Веб, мобильная и серверная разработка. Командные проекты с первого курса.","pc","3 г. 10 мес."],
  ["Электромеханика","Автоматика, робототехника и промышленные контроллеры на современном оборудовании.","lab","2 г. 10 мес."]];
const footer = () => `<footer class="foot rv"><div><img class="foot-logo" src="img/logo.png" alt="Almaty Polytechnic College"><p>Современное техническое образование в сердце Алматы.</p></div>
  <div><b>Контакты</b><p>г. Алматы, Ауэзовский район,<br>мкр. Тастак-1, д. 1В (ул. Сурикова)<br>Индекс 050061<br>+7 (727) 000-00-00<br>info@polytech.example</p></div><div><b>Приёмная комиссия</b><p>Пн–Пт 8:30–17:30<br>Сб 10:00–14:00</p></div></footer>`;

const loc = () => `<section class="sec loc rv" id="loc"><div class="card"><h2>Как нас найти</h2><p>г. Алматы, Ауэзовский район, мкр. Тастак-1, д. 1В (ул. Сурикова), индекс 050061.</p><p class="mute">Приёмная комиссия: Пн–Пт 8:30–17:30, Сб 10:00–14:00.</p></div>
  <iframe title="Карта: Almaty Polytechnic College" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=Almaty+Polytechnic+College+Тастак-1+1В+Алматы&output=embed"></iframe></section>`;
function pubNav() {
  const keys = ["home","about","programs","news","contacts"];
  $("#nav").innerHTML = t().nav.map((n,i)=>`<button data-p="${keys[i]}" class="${keys[i]===page?"on":""}">${n}</button>`).join("");
  $("#nav").onclick = e => { const b = e.target.closest("button"); if (!b) return; if (b.dataset.p==="contacts") return ($("#loc")||$(".foot")).scrollIntoView({behavior:"smooth"}); page = b.dataset.p; home(); scrollTo(0,0); };
}
async function home() {
  document.body.classList.remove("app"); pubNav();
  const d = await fetch("/api/public").then(r=>r.json()).catch(()=>({news:[],groups:[]})), L = t();
  const newsCards = d.news.map((n,i)=>`<article class="newsc rv">${ph(["team","lab","class"][i%3])}<div><small>${n.date}</small><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></div></article>`).join("");
  const specCards = SPECS.map(s=>`<article class="spec rv">${ph(s[2])}<div class="glass"><h3>${s[0]}</h3><p>${s[1]}</p><span class="tag">${s[3]}</span><button class="glassbtn" data-go="programs">${L.more}</button></div></article>`).join("");
  const stats = [1503,114,12,94].map((n,i)=>`<div><b data-n="${n}">0</b><span>${L.stats[i]}</span></div>`).join("");
  const views = {
    home: `<section class="hx">${ph("hero","bg")}<div class="hx-in"><div class="eyebrow">ALMATY POLYTECHNIC COLLEGE</div><h1>${L.title}</h1><p>${L.sub}</p>
        <div class="row"><button class="primary lg" data-go="about">${L.about}</button><button class="glassbtn lg" id="cab">${L.cab}</button></div></div>
        <div class="glass float"><b>Приём 2026</b><span>Заявки открыты до 25 августа</span></div></section>
      <section class="stats rv">${stats}</section>
      <section class="sec"><h2 class="rv">${L.spec}</h2><div class="specs">${specCards}</div></section>
      <section class="sec adv"><h2 class="rv">${L.adv}</h2><div class="advg">
        <div class="rv big-adv">Практика с первого курса<p>60% программы — проекты и лабораторные работы.</p></div>
        <div class="rv">Партнёры-работодатели<p>Стажировки в IT-компаниях.</p></div><div class="rv">Цифровой кампус<p>Журнал, расписание и задания онлайн.</p></div></div></section>
      <section class="labs rv">${ph("lab","bg")}<div class="glass"><h2>${L.labs}</h2><p>Компьютерные классы на 120 мест, сетевая лаборатория, мастерская робототехники.</p></div></section>
      <section class="sec"><h2 class="rv">${L.news}</h2><div class="newsg">${newsCards}</div></section>
      <section class="sec"><h2 class="rv">${L.gal}</h2><div class="gal">${["facade","team","code2","lobby","class"].map(k=>`<div class="rv">${ph(k)}</div>`).join("")}</div></section>${loc()}${footer()}`,
    about: `<section class="pg"><h1 class="rv">${L.about}</h1><div class="two rv"><div><p>Almaty Polytechnic College работает с 1940 года и готовит специалистов для IT и инженерной отрасли. Мы соединяем сильную теорию, современные лаборатории и работу над реальными проектами вместе с партнёрами из индустрии.</p><p>Сегодня в колледже учатся более тысячи студентов, а выпускники работают в технологических компаниях региона.</p></div>${ph("entrance")}</div>
      <div class="two rv rev">${ph("class")}<div><h2>Преподаватели-практики</h2><p>Наши преподаватели работают в индустрии и ведут курсы по реальным кейсам: от баз данных до промышленной автоматики.</p></div></div></section>
      <section class="stats rv">${stats}</section>
      <section class="sec"><h2 class="rv">${L.adv}</h2><div class="advg"><div class="rv big-adv">Практика с первого курса<p>60% программы — проекты и лабораторные работы.</p></div><div class="rv">Партнёры-работодатели<p>Стажировки в IT-компаниях.</p></div><div class="rv">Цифровой кампус<p>Журнал, расписание и задания онлайн.</p></div></div></section>${footer()}`,
    programs: `<section class="pg"><h1 class="rv">${L.nav[2]}</h1><div class="specs">${specCards}</div></section>${footer()}`,
    news: `<section class="pg"><h1 class="rv">${L.nav[3]}</h1><div class="newsg">${newsCards}</div></section>${footer()}`};
  $("#main").innerHTML = views[page] || views.home;
  $("#cab")?.addEventListener("click", loginView);
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{page=b.dataset.go;home();scrollTo(0,0)});
}

// Плавная смена страниц, появление блоков при прокрутке, счётчики
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target);
  e.target.querySelectorAll?.("[data-n]").forEach(c=>{const n=+c.dataset.n;let v=0;const st=setInterval(()=>{v+=Math.ceil(n/40);if(v>=n){v=n;clearInterval(st)}c.textContent=v},25)}); } }), {threshold:.12});
new MutationObserver(() => { const m = $("#main"); m.classList.remove("swap"); void m.offsetWidth; m.classList.add("swap");
  m.querySelectorAll(".rv:not(.in)").forEach(el=>io.observe(el)); document.querySelectorAll(".stats").forEach(el=>io.observe(el)); }).observe($("#main"), {childList:true});
start();
