import sqlite3, hashlib, hmac, os, time, json, base64, random, csv, io, datetime as dt
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# БД: SQLite (файл campus.db). Схема простая и переносится на PostgreSQL.
DB = os.path.join(os.path.dirname(__file__), "campus.db")
SECRET = os.environ.get("SECRET_KEY", "change-me-in-production").encode()
app = FastAPI(title="Polytechnic College — Digital Campus")

def db():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys=ON"); return c

def hash_pw(p, salt=None):
    salt = salt or os.urandom(16).hex()
    return salt + "$" + hashlib.pbkdf2_hmac("sha256", p.encode(), salt.encode(), 120000).hex()

def check_pw(p, h):
    return hmac.compare_digest(hash_pw(p, h.split("$")[0]), h)

def make_token(uid):
    body = base64.urlsafe_b64encode(json.dumps({"u": uid, "e": time.time() + 86400}).encode()).decode()
    return body + "." + hmac.new(SECRET, body.encode(), "sha256").hexdigest()

def current(authorization: str = Header(default="")):
    try:
        body, sig = authorization.replace("Bearer ", "").split(".")
        assert hmac.compare_digest(sig, hmac.new(SECRET, body.encode(), "sha256").hexdigest())
        d = json.loads(base64.urlsafe_b64decode(body)); assert d["e"] > time.time()
        with db() as c: u = c.execute("SELECT * FROM users WHERE id=?", (d["u"],)).fetchone()
        assert u; return dict(u)
    except Exception:
        raise HTTPException(401, "Нужно войти в систему")

def role(*roles):
    def dep(u=Depends(current)):
        if u["role"] not in roles: raise HTTPException(403, "Недостаточно прав")
        return u
    return dep

KINDS = ["current", "test", "practical", "independent", "final"]

def init():
    with db() as c:
        c.executescript("""
CREATE TABLE IF NOT EXISTS groups(id INTEGER PRIMARY KEY, name TEXT UNIQUE, specialty TEXT, course INT);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, login TEXT UNIQUE, pw TEXT, name TEXT, role TEXT, group_id INT REFERENCES groups(id));
CREATE TABLE IF NOT EXISTS subjects(id INTEGER PRIMARY KEY, name TEXT, teacher_id INT REFERENCES users(id));
CREATE TABLE IF NOT EXISTS grades(id INTEGER PRIMARY KEY, student_id INT REFERENCES users(id) ON DELETE CASCADE, subject_id INT, kind TEXT, value INT, date TEXT);
CREATE TABLE IF NOT EXISTS grade_history(id INTEGER PRIMARY KEY, grade_id INT, old INT, new INT, by_name TEXT, ts TEXT);
CREATE TABLE IF NOT EXISTS attendance(id INTEGER PRIMARY KEY, student_id INT REFERENCES users(id) ON DELETE CASCADE, subject_id INT, date TEXT, present INT);
CREATE TABLE IF NOT EXISTS homework(id INTEGER PRIMARY KEY, subject_id INT, group_id INT, title TEXT, due TEXT);
CREATE TABLE IF NOT EXISTS news(id INTEGER PRIMARY KEY, title TEXT, body TEXT, date TEXT, author TEXT);
CREATE TABLE IF NOT EXISTS schedule(id INTEGER PRIMARY KEY, group_id INT, day INT, time TEXT, subject_id INT, room TEXT);""")
        if c.execute("SELECT COUNT(*) FROM users").fetchone()[0]: return
        random.seed(7); today = dt.date.today()
        groups = [("ИС-21", "Информационные системы", 3), ("ИС-22", "Информационные системы", 2),
                  ("ПО-21", "Программирование", 3), ("ЭМ-21", "Электромеханика", 2)]
        for g in groups: c.execute("INSERT INTO groups(name,specialty,course) VALUES(?,?,?)", g)
        c.execute("INSERT INTO users(login,pw,name,role) VALUES('admin',?,'Администратор системы','admin')", (hash_pw("admin123"),))
        tnames = ["Иванов Пётр Сергеевич", "Смирнова Анна Олеговна", "Каримов Данияр Ержанович", "Ким Елена Викторовна", "Попов Андрей Игоревич"]
        for i, n in enumerate(tnames, 1):
            c.execute("INSERT INTO users(login,pw,name,role) VALUES(?,?,?,'teacher')", (f"teacher{i}", hash_pw("teacher123"), n))
        tid = {r["login"]: r["id"] for r in c.execute("SELECT id,login FROM users")}
        subs = ["Математика", "Программирование", "Базы данных", "Физика", "Английский язык", "Веб-разработка", "Сети и ОС", "Алгоритмы"]
        for i, s in enumerate(subs): c.execute("INSERT INTO subjects(name,teacher_id) VALUES(?,?)", (s, tid[f"teacher{i % 5 + 1}"]))
        first = ["Алихан", "Мадина", "Тимур", "Аружан", "Даулет", "Софья", "Нурлан", "Алина", "Ержан", "Диана"]
        last = ["Сатыбалдиев", "Ким", "Петров", "Омарова", "Байжанов", "Ли", "Жумабеков", "Семёнова", "Ахметов", "Новикова"]
        for i in range(20):
            gid = i // 5 + 1
            c.execute("INSERT INTO users(login,pw,name,role,group_id) VALUES(?,?,?,'student',?)",
                      (f"student{i+1}", hash_pw("student123"), f"{last[i % 10]} {first[(i * 3) % 10]}", gid))
        sids = [r["id"] for r in c.execute("SELECT id FROM users WHERE role='student'")]
        for s in sids:
            for sub in range(1, 9):
                for k in ["current"] * 3 + ["test", "practical", "independent"]:
                    c.execute("INSERT INTO grades(student_id,subject_id,kind,value,date) VALUES(?,?,?,?,?)",
                              (s, sub, k, max(20, min(100, int(random.gauss(76, 14)))), str(today - dt.timedelta(days=random.randint(1, 60)))))
                for d in range(8):
                    c.execute("INSERT INTO attendance(student_id,subject_id,date,present) VALUES(?,?,?,?)",
                              (s, sub, str(today - dt.timedelta(days=d * 3)), int(random.random() > .1)))
        for gid in range(1, 5):
            for day in range(5):
                for slot, t in enumerate(["09:00", "10:40", "12:30"]):
                    c.execute("INSERT INTO schedule(group_id,day,time,subject_id,room) VALUES(?,?,?,?,?)",
                              (gid, day, t, (gid + day + slot * 3) % 8 + 1, str(100 + (day * 3 + slot * 7 + gid) % 30)))
            for sub in (2, 3, 6):
                c.execute("INSERT INTO homework(subject_id,group_id,title,due) VALUES(?,?,?,?)",
                          (sub, gid, f"Практическое задание №{sub}", str(today + dt.timedelta(days=sub + gid))))
        for t, b in [("Начало зимней сессии", "Расписание экзаменов опубликовано в разделе «Расписание»."),
                     ("День открытых дверей", "Приглашаем абитуриентов и родителей в субботу в 11:00."),
                     ("Хакатон колледжа", "Регистрация команд открыта до конца месяца."),
                     ("Обновление библиотеки", "Поступили новые учебники по базам данных и сетям.")]:
            c.execute("INSERT INTO news(title,body,date,author) VALUES(?,?,?,'Администрация')", (t, b, str(today)))

init()

# ---------- Модели ----------
class Login(BaseModel): login: str; password: str
class GradeIn(BaseModel):
    student_id: int; subject_id: int; kind: str; value: int = Field(ge=0, le=100)
class GradeEdit(BaseModel): value: int = Field(ge=0, le=100)
class AttIn(BaseModel): student_id: int; subject_id: int; present: bool
class HwIn(BaseModel): subject_id: int; group_id: int; title: str = Field(min_length=2, max_length=200); due: str
class NewsIn(BaseModel): title: str = Field(min_length=2, max_length=200); body: str = Field(min_length=2, max_length=2000)
class UserIn(BaseModel):
    login: str = Field(min_length=3, max_length=40); password: str = Field(min_length=6)
    name: str = Field(min_length=2); role: str; group_id: int | None = None
class PwIn(BaseModel): old: str; new: str = Field(min_length=6)
class NameIn(BaseModel): name: str = Field(min_length=2, max_length=100)
class GroupIn(BaseModel): name: str; specialty: str; course: int
class SubjIn(BaseModel): name: str; teacher_id: int

def q(sql, *a):
    with db() as c: return [dict(r) for r in c.execute(sql, a).fetchall()]

def own_subject(u, sid):
    if u["role"] == "teacher" and not q("SELECT 1 FROM subjects WHERE id=? AND teacher_id=?", sid, u["id"]):
        raise HTTPException(403, "Это не ваш предмет")

# ---------- Общие ----------
@app.post("/api/login")
def login(d: Login):
    r = q("SELECT * FROM users WHERE login=?", d.login.strip())
    if not r or not check_pw(d.password, r[0]["pw"]): raise HTTPException(401, "Неверный логин или пароль")
    return {"token": make_token(r[0]["id"])}

@app.get("/api/me")
def me(u=Depends(current)):
    g = q("SELECT * FROM groups WHERE id=?", u["group_id"]) if u["group_id"] else [None]
    return {"id": u["id"], "name": u["name"], "role": u["role"], "login": u["login"], "group": g[0]}

@app.post("/api/me/password")
def pw(d: PwIn, u=Depends(current)):
    if not check_pw(d.old, u["pw"]): raise HTTPException(400, "Текущий пароль неверный")
    with db() as c: c.execute("UPDATE users SET pw=? WHERE id=?", (hash_pw(d.new), u["id"]))
    return {"ok": True}

@app.post("/api/me/name")
def rename(d: NameIn, u=Depends(current)):
    with db() as c: c.execute("UPDATE users SET name=? WHERE id=?", (d.name.strip(), u["id"]))
    return {"ok": True}

@app.get("/api/news")
def news(u=Depends(current)): return q("SELECT * FROM news ORDER BY id DESC")

@app.post("/api/news")
def add_news(d: NewsIn, u=Depends(role("teacher", "admin"))):
    with db() as c: c.execute("INSERT INTO news(title,body,date,author) VALUES(?,?,?,?)", (d.title, d.body, str(dt.date.today()), u["name"]))
    return {"ok": True}

@app.delete("/api/news/{nid}")
def del_news(nid: int, u=Depends(role("admin"))):
    with db() as c: c.execute("DELETE FROM news WHERE id=?", (nid,))
    return {"ok": True}

@app.get("/api/schedule")
def schedule(group_id: int | None = None, u=Depends(current)):
    gid = u["group_id"] if u["role"] == "student" else group_id
    if u["role"] == "teacher":
        return q("""SELECT sc.*, s.name subject, g.name grp FROM schedule sc JOIN subjects s ON s.id=sc.subject_id JOIN groups g ON g.id=sc.group_id
                    WHERE s.teacher_id=? ORDER BY day,time""", u["id"])
    return q("""SELECT sc.*, s.name subject, g.name grp FROM schedule sc JOIN subjects s ON s.id=sc.subject_id JOIN groups g ON g.id=sc.group_id
                WHERE sc.group_id=? ORDER BY day,time""", gid or 1)

@app.get("/api/search")
def search(text: str, u=Depends(role("teacher", "admin"))):
    return q("SELECT u.id,u.name,u.role,g.name grp FROM users u LEFT JOIN groups g ON g.id=u.group_id WHERE u.name LIKE ? LIMIT 20", f"%{text}%")

# ---------- Студент ----------
@app.get("/api/student/summary")
def summary(u=Depends(role("student"))):
    g = q("""SELECT g.id,s.name subject,g.kind,g.value,g.date FROM grades g JOIN subjects s ON s.id=g.subject_id WHERE student_id=? ORDER BY date DESC""", u["id"])
    per = q("""SELECT s.name, ROUND(AVG(g.value),1) avg FROM grades g JOIN subjects s ON s.id=g.subject_id WHERE student_id=? GROUP BY s.id""", u["id"])
    att = q("SELECT AVG(present)*100 p FROM attendance WHERE student_id=?", u["id"])[0]["p"] or 0
    hw = q("""SELECT h.title,h.due,s.name subject FROM homework h JOIN subjects s ON s.id=h.subject_id WHERE group_id=? ORDER BY due""", u["group_id"])
    dist = {"fail": sum(1 for x in g if x["value"] < 50), "ok": sum(1 for x in g if 50 <= x["value"] < 70), "good": sum(1 for x in g if 70 <= x["value"] < 90), "top": sum(1 for x in g if x["value"] >= 90)}
    return {"grades": g, "per_subject": per, "gpa": round(sum(x["value"] for x in g) / len(g), 1) if g else 0,
            "attendance": round(att), "homework": hw, "dist": dist}

# ---------- Преподаватель ----------
@app.get("/api/teacher/options")
def options(u=Depends(role("teacher", "admin"))):
    where, a = ("", ()) if u["role"] == "admin" else ("WHERE teacher_id=?", (u["id"],))
    return {"subjects": q(f"SELECT id,name FROM subjects {where}", *a), "groups": q("SELECT id,name FROM groups")}

@app.get("/api/journal")
def journal(group_id: int, subject_id: int, kind: str = "", date_from: str = "", u=Depends(role("teacher", "admin"))):
    own_subject(u, subject_id); out = []
    for s in q("SELECT id,name FROM users WHERE role='student' AND group_id=? ORDER BY name", group_id):
        gr = q("SELECT id,kind,value,date FROM grades WHERE student_id=? AND subject_id=? AND date>=? AND (?='' OR kind=?) ORDER BY date",
               s["id"], subject_id, date_from or "0000", kind, kind)
        a = q("SELECT AVG(present)*100 p FROM attendance WHERE student_id=? AND subject_id=?", s["id"], subject_id)[0]["p"]
        out.append({**s, "grades": gr, "att": round(a or 0), "avg": round(sum(x["value"] for x in gr) / len(gr), 1) if gr else 0})
    return out

@app.post("/api/grade")
def add_grade(d: GradeIn, u=Depends(role("teacher", "admin"))):
    if d.kind not in KINDS: raise HTTPException(400, "Неверный тип оценки")
    own_subject(u, d.subject_id)
    with db() as c: c.execute("INSERT INTO grades(student_id,subject_id,kind,value,date) VALUES(?,?,?,?,?)", (d.student_id, d.subject_id, d.kind, d.value, str(dt.date.today())))
    return {"ok": True}

@app.put("/api/grade/{gid}")
def edit_grade(gid: int, d: GradeEdit, u=Depends(role("teacher", "admin"))):
    g = q("SELECT * FROM grades WHERE id=?", gid)
    if not g: raise HTTPException(404, "Оценка не найдена")
    own_subject(u, g[0]["subject_id"])
    with db() as c:
        c.execute("INSERT INTO grade_history(grade_id,old,new,by_name,ts) VALUES(?,?,?,?,?)", (gid, g[0]["value"], d.value, u["name"], dt.datetime.now().strftime("%Y-%m-%d %H:%M")))
        c.execute("UPDATE grades SET value=? WHERE id=?", (d.value, gid))
    return {"ok": True}

@app.get("/api/grade/{gid}/history")
def history(gid: int, u=Depends(role("teacher", "admin"))): return q("SELECT * FROM grade_history WHERE grade_id=? ORDER BY id DESC", gid)

@app.post("/api/attendance")
def att(d: AttIn, u=Depends(role("teacher", "admin"))):
    own_subject(u, d.subject_id); day = str(dt.date.today())
    with db() as c:
        c.execute("DELETE FROM attendance WHERE student_id=? AND subject_id=? AND date=?", (d.student_id, d.subject_id, day))
        c.execute("INSERT INTO attendance(student_id,subject_id,date,present) VALUES(?,?,?,?)", (d.student_id, d.subject_id, day, int(d.present)))
    return {"ok": True}

@app.post("/api/homework")
def add_hw(d: HwIn, u=Depends(role("teacher", "admin"))):
    own_subject(u, d.subject_id)
    with db() as c: c.execute("INSERT INTO homework(subject_id,group_id,title,due) VALUES(?,?,?,?)", (d.subject_id, d.group_id, d.title, d.due))
    return {"ok": True}

@app.get("/api/export")
def export(group_id: int, subject_id: int, u=Depends(role("teacher", "admin"))):
    rows = journal(group_id, subject_id, "", "", u); buf = io.StringIO(); buf.write("\ufeff")
    w = csv.writer(buf, delimiter=";"); w.writerow(["Студент", "Оценки", "Средний балл", "Посещаемость %"])
    for r in rows: w.writerow([r["name"], " ".join(str(g["value"]) for g in r["grades"]), r["avg"], r["att"]])
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=journal.csv"})

# ---------- Администратор ----------
@app.get("/api/admin/stats")
def stats(u=Depends(role("admin"))):
    return {"counts": {"students": q("SELECT COUNT(*) n FROM users WHERE role='student'")[0]["n"], "teachers": q("SELECT COUNT(*) n FROM users WHERE role='teacher'")[0]["n"],
                       "groups": q("SELECT COUNT(*) n FROM groups")[0]["n"], "subjects": q("SELECT COUNT(*) n FROM subjects")[0]["n"]},
            "by_group": q("SELECT g.name, ROUND(AVG(gr.value),1) avg FROM grades gr JOIN users u ON u.id=gr.student_id JOIN groups g ON g.id=u.group_id GROUP BY g.id"),
            "by_subject": q("SELECT s.name, ROUND(AVG(gr.value),1) avg FROM grades gr JOIN subjects s ON s.id=gr.subject_id GROUP BY s.id")}

@app.get("/api/admin/users")
def users(u=Depends(role("admin"))): return q("SELECT u.id,u.login,u.name,u.role,g.name grp FROM users u LEFT JOIN groups g ON g.id=u.group_id ORDER BY role,name")

@app.post("/api/admin/users")
def add_user(d: UserIn, u=Depends(role("admin"))):
    if d.role not in ("student", "teacher", "admin"): raise HTTPException(400, "Неверная роль")
    try:
        with db() as c: c.execute("INSERT INTO users(login,pw,name,role,group_id) VALUES(?,?,?,?,?)", (d.login.strip(), hash_pw(d.password), d.name.strip(), d.role, d.group_id if d.role == "student" else None))
    except sqlite3.IntegrityError: raise HTTPException(400, "Такой логин уже занят")
    return {"ok": True}

@app.delete("/api/admin/users/{uid}")
def del_user(uid: int, u=Depends(role("admin"))):
    if uid == u["id"]: raise HTTPException(400, "Нельзя удалить себя")
    with db() as c: c.execute("DELETE FROM users WHERE id=?", (uid,))
    return {"ok": True}

@app.post("/api/admin/groups")
def add_group(d: GroupIn, u=Depends(role("admin"))):
    try:
        with db() as c: c.execute("INSERT INTO groups(name,specialty,course) VALUES(?,?,?)", (d.name, d.specialty, d.course))
    except sqlite3.IntegrityError: raise HTTPException(400, "Группа уже существует")
    return {"ok": True}

@app.post("/api/admin/subjects")
def add_subject(d: SubjIn, u=Depends(role("admin"))):
    with db() as c: c.execute("INSERT INTO subjects(name,teacher_id) VALUES(?,?)", (d.name, d.teacher_id))
    return {"ok": True}

@app.get("/api/public")
def public(): return {"groups": q("SELECT * FROM groups"), "news": q("SELECT title,body,date FROM news ORDER BY id DESC LIMIT 3")}

app.mount("/", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "..", "frontend"), html=True), name="static")
