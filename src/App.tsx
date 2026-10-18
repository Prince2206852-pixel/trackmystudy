import { useEffect, useMemo, useState } from 'react';
import { Activity, AlarmClock, ArrowDownToLine, BarChart3, CalendarDays, Check, ChevronDown, CircleHelp, Clock3, Download, Flame, MoreHorizontal, Pause, Pencil, Play, Plus, RotateCcw, Settings2, Sparkles, Target, Trash2, Trophy, X } from 'lucide-react';

type Task = { id: string; name: string; targetMinutes: number; color: string; archived?: boolean };
type Session = { id: string; taskId: string; startedAt: number; endedAt: number; durationSeconds: number; dateKey: string };
type ActiveTimer = { taskId: string; startedAt: number; elapsedBeforeStart: number };
type Store = { tasks: Task[]; sessions: Session[]; activeTimer: ActiveTimer | null; elapsedByTask: Record<string, number>; dailyTargetMinutes: number; streak: number };
const STORE_KEY = 'trackmystudy-v1';
const colors = ['#7c8cff', '#b28aff', '#48c9a6', '#ffb86b', '#ff7d9a', '#58b8f4'];
const defaults: Task[] = [
  { id: 'task-1', name: 'Task 1', targetMinutes: 60, color: '#7c8cff' },
  { id: 'task-2', name: 'Task 2', targetMinutes: 60, color: '#b28aff' },
  { id: 'task-3', name: 'Task 3', targetMinutes: 60, color: '#48c9a6' },
];
const initial: Store = { tasks: defaults, sessions: [], activeTimer: null, elapsedByTask: {}, dailyTargetMinutes: 420, streak: 0 };
const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const fmt = (seconds: number) => { const total = Math.max(0, Math.floor(seconds)); const h = Math.floor(total/3600); const m = Math.floor((total%3600)/60); const s = total%60; return h ? `${h}h ${String(m).padStart(2,'0')}m` : m ? `${m}m` : `${s}s`; };
const fmtShort = (minutes: number) => minutes >= 60 ? `${Math.floor(minutes/60)}h${minutes%60 ? ` ${minutes%60}m` : ''}` : `${minutes}m`;
const loadStore = (): Store => { try { const raw = localStorage.getItem(STORE_KEY); if (raw) return { ...initial, ...JSON.parse(raw) }; } catch {} return initial; };
const saveFile = (name: string, text: string, type = 'application/json') => { const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); };

export default function App() {
  const [store, setStore] = useState<Store>(loadStore);
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState<'today'|'insights'|'settings'>('today');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingActiveTime, setEditingActiveTime] = useState(false);
  const [showAddSession, setShowAddSession] = useState(false);
  const [manualTaskId, setManualTaskId] = useState('');
  const [manualHours, setManualHours] = useState('0');
  const [manualMinutes, setManualMinutes] = useState('30');
  const [sessionHours, setSessionHours] = useState('0');
  const [sessionMinutes, setSessionMinutes] = useState('0');
  const [taskName, setTaskName] = useState('');
  const [taskHours, setTaskHours] = useState('1');
  const [taskMinutes, setTaskMinutes] = useState('0');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [period, setPeriod] = useState<'week'|'month'|'year'>('week');
  const [toast, setToast] = useState('');

  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }, [store]);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(''), 2400); return () => clearTimeout(id); }, [toast]);

  const todaySessions = useMemo(() => store.sessions.filter(s => s.dateKey === dayKey()), [store.sessions, now]);
  const todayByTask = useMemo(() => {
    const map: Record<string, number> = {};
    todaySessions.forEach(s => map[s.taskId] = (map[s.taskId] || 0) + s.durationSeconds);
    if (store.activeTimer) {
      const active = store.activeTimer;
      const activeToday = dayKey(new Date(active.startedAt)) === dayKey();
      if (activeToday) map[active.taskId] = (map[active.taskId] || 0) + active.elapsedBeforeStart + Math.max(0, (now-active.startedAt)/1000);
    }
    return map;
  }, [todaySessions, store.activeTimer, now]);
  const todaySeconds = Object.values(todayByTask).reduce((a,b) => a+b, 0);
  const totalTarget = store.tasks.filter(t=>!t.archived).reduce((a,t)=>a+t.targetMinutes, 0) * 60;
  const overallPercent = totalTarget ? Math.min(100, Math.round(todaySeconds/totalTarget*100)) : 0;
  const activeTask = store.tasks.find(t => t.id === store.activeTimer?.taskId);
  const activeElapsed = store.activeTimer ? store.activeTimer.elapsedBeforeStart + Math.max(0, (now-store.activeTimer.startedAt)/1000) : 0;

  function startTimer(task: Task) {
    if (store.activeTimer?.taskId === task.id) return;
    let sessions = [...store.sessions];
    let elapsedByTask = { ...store.elapsedByTask };
    if (store.activeTimer) {
      const old = store.activeTimer;
      const duration = old.elapsedBeforeStart + Math.max(0, (Date.now()-old.startedAt)/1000);
      sessions.push({ id: crypto.randomUUID(), taskId: old.taskId, startedAt: Date.now()-duration*1000, endedAt: Date.now(), durationSeconds: duration, dateKey: dayKey(new Date(old.startedAt)) });
      elapsedByTask[old.taskId] = (elapsedByTask[old.taskId] || 0) + duration;
    }
    setStore({ ...store, sessions, elapsedByTask, activeTimer: { taskId: task.id, startedAt: Date.now(), elapsedBeforeStart: 0 } });
    setToast(`${task.name} timer started`);
  }
  function pauseTimer() {
    if (!store.activeTimer) return;
    const a = store.activeTimer; const end = Date.now(); const duration = a.elapsedBeforeStart + Math.max(0, (end-a.startedAt)/1000);
    const session: Session = { id: crypto.randomUUID(), taskId: a.taskId, startedAt: end-duration*1000, endedAt: end, durationSeconds: duration, dateKey: dayKey(new Date(a.startedAt)) };
    setStore({ ...store, sessions: [...store.sessions, session], elapsedByTask: { ...store.elapsedByTask, [a.taskId]: (store.elapsedByTask[a.taskId]||0)+duration }, activeTimer: null });
    setToast('Study time saved');
  }
  function finishTask(task: Task) { if (store.activeTimer?.taskId === task.id) pauseTimer(); else setToast(`${task.name} is ready for your next session`); }
  function openNewTask() { setEditing(null); setTaskName(''); setTaskHours('1'); setTaskMinutes('0'); setShowTaskForm(true); }
  function openEditTask(task: Task) { setEditing(task); setTaskName(task.name); setTaskHours(String(Math.floor(task.targetMinutes/60))); setTaskMinutes(String(task.targetMinutes%60)); setShowTaskForm(true); }
  function saveTask(e: React.FormEvent) { e.preventDefault(); const mins = Math.max(1, Number(taskHours||0)*60 + Number(taskMinutes||0)); if (!taskName.trim()) return;
    if (editing) setStore({ ...store, tasks: store.tasks.map(t => t.id===editing.id ? { ...t, name: taskName.trim(), targetMinutes: mins } : t) });
    else setStore({ ...store, tasks: [...store.tasks, { id: crypto.randomUUID(), name: taskName.trim(), targetMinutes: mins, color: colors[store.tasks.length%colors.length] }] });
    setShowTaskForm(false); setToast(editing ? 'Task updated' : 'Task added');
  }
  function openEditActiveTime() {
    if (!store.activeTimer) return;
    const totalMinutes = Math.max(0, Math.round(activeElapsed / 60));
    setSessionHours(String(Math.floor(totalMinutes / 60)));
    setSessionMinutes(String(totalMinutes % 60));
    setEditingActiveTime(true);
  }
  function saveActiveTimeEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!store.activeTimer) return;
    const totalSeconds = Math.max(0, (Number(sessionHours || 0) * 60 + Number(sessionMinutes || 0)) * 60);
    setStore({ ...store, activeTimer: { ...store.activeTimer, startedAt: Date.now(), elapsedBeforeStart: totalSeconds } });
    setEditingActiveTime(false);
    setToast('Active study time corrected');
  }
  function openAddSession() {
    setManualTaskId(store.tasks[0]?.id || '');
    setManualHours('0');
    setManualMinutes('30');
    setShowAddSession(true);
  }
  function saveManualSession(e: React.FormEvent) {
    e.preventDefault();
    const task = store.tasks.find(t => t.id === manualTaskId);
    if (!task) { setToast('Please select a task first'); return; }
    const totalSeconds = Math.max(0, (Number(manualHours || 0) * 60 + Number(manualMinutes || 0)) * 60);
    if (totalSeconds <= 0) { setToast('Enter a study duration greater than zero'); return; }
    const endedAt = Date.now();
    const session: Session = {
      id: crypto.randomUUID(), taskId: task.id, startedAt: endedAt - totalSeconds * 1000,
      endedAt, durationSeconds: totalSeconds, dateKey: dayKey()
    };
    setStore({ ...store, sessions: [...store.sessions, session], elapsedByTask: { ...store.elapsedByTask, [task.id]: (store.elapsedByTask[task.id] || 0) + totalSeconds } });
    setShowAddSession(false);
    setToast(`Added ${fmt(totalSeconds)} to ${task.name}`);
  }
  function openEditSession(session: Session) {
    setEditingSession(session);
    const totalMinutes = Math.max(0, Math.round(session.durationSeconds / 60));
    setSessionHours(String(Math.floor(totalMinutes / 60)));
    setSessionMinutes(String(totalMinutes % 60));
  }
  function saveSessionEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSession) return;
    const totalSeconds = Math.max(0, (Number(sessionHours || 0) * 60 + Number(sessionMinutes || 0)) * 60);
    setStore({
      ...store,
      sessions: store.sessions.map(session => session.id === editingSession.id
        ? { ...session, durationSeconds: totalSeconds, endedAt: session.startedAt + totalSeconds * 1000 }
        : session)
    });
    setEditingSession(null);
    setToast('Study time corrected');
  }
  function removeTask(id: string) { if (store.activeTimer?.taskId === id) { setToast('Pause the active timer before removing this task'); return; } setStore({ ...store, tasks: store.tasks.filter(t=>t.id!==id) }); setDeleteId(null); setToast('Task removed'); }
  function exportData() { saveFile(`trackmystudy-backup-${dayKey()}.json`, JSON.stringify({ ...store, exportedAt: new Date().toISOString() }, null, 2)); setToast('Backup exported'); }
  function importData(e: React.ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(String(reader.result)); if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.sessions)) throw new Error(); setStore({ ...initial, ...parsed, activeTimer: null }); setToast('Backup restored'); } catch { setToast('That backup file could not be read'); } }; reader.readAsText(file); e.target.value=''; }

  const chartData = useMemo(() => {
    const today = new Date();
    const count = period==='week' ? 7 : period==='month' ? 30 : 12;
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(today);
      if (period==='year') d.setMonth(today.getMonth()-(count-1-i), 1);
      else d.setDate(today.getDate()-(count-1-i));
      const key = period==='year' ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : dayKey(d);
      const total = store.sessions.filter(s => period==='year' ? s.dateKey.startsWith(key) : s.dateKey===key).reduce((a,s)=>a+s.durationSeconds,0);
      return { label: period==='year' ? d.toLocaleDateString('en',{month:'short'}) : period==='month' ? String(d.getDate()) : d.toLocaleDateString('en',{weekday:'short'}), total };
    });
  }, [store.sessions, period]);
  const maxChart = Math.max(3600, ...chartData.map(d=>d.total));
  const reportTotal = chartData.reduce((a,d)=>a+d.total,0);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={21}/></div><div><div className="brand-name">track<span>my</span>study</div><div className="brand-tag">MAKE EVERY HOUR COUNT</div></div></div>
      <div className="side-label">WORKSPACE</div>
      <button className={`nav-item ${view==='today'?'active':''}`} onClick={()=>setView('today')}><CalendarDays size={18}/>Today <span className="nav-dot"/></button>
      <button className={`nav-item ${view==='insights'?'active':''}`} onClick={()=>setView('insights')}><BarChart3 size={18}/>Insights</button>
      <button className={`nav-item ${view==='settings'?'active':''}`} onClick={()=>setView('settings')}><Settings2 size={18}/>Settings</button>
      <div className="sidebar-bottom"><div className="focus-card"><div className="focus-icon"><Sparkles size={17}/></div><strong>One session at a time.</strong><p>Progress is built one focused hour after another.</p><div className="focus-line"><span/></div></div><div className="offline-note"><span className="online-dot"/> Your data stays on this device</div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="mobile-brand"><div className="brand-mark"><Activity size={19}/></div><span>track<span>my</span>study</span></div><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{view==='today'?'Today':view==='insights'?'Insights':'Settings'}</strong></div><div className="top-actions"><span className="date-chip"><CalendarDays size={15}/>{new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</span><button className="icon-button" aria-label="Export backup" title="Export backup" onClick={exportData}><Download size={17}/></button><div className="avatar">S</div></div></header>
      {view==='today' && <>
        <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR PERSONAL STUDY SPACE</div><h1>Make today <span>count.</span></h1><p className="subhead">A little progress every day adds up to remarkable results.</p></div><div className="welcome-date"><span>{new Date().toLocaleDateString('en',{weekday:'long'})}</span><strong>{new Date().getDate()}</strong><span>{new Date().toLocaleDateString('en',{month:'long',year:'numeric'})}</span></div></section>
        <section className="overview-grid">
          <div className="hero-stat card"><div className="stat-top"><div><span className="stat-label">TOTAL STUDY TIME</span><div className="hero-time">{fmt(todaySeconds)}</div><div className="stat-sub">of {fmtShort(totalTarget/60)} planned today</div></div><div className="ring-wrap"><svg viewBox="0 0 100 100" className="progress-ring"><circle cx="50" cy="50" r="42" className="ring-track"/><circle cx="50" cy="50" r="42" className="ring-progress" style={{strokeDasharray:`${Math.min(100,overallPercent)*2.639} 263.9`}}/></svg><div className="ring-center"><strong>{overallPercent}%</strong><span>DONE</span></div></div></div><div className="stat-divider"/><div className="stat-bottom"><div className="mini-stat"><span className="mini-icon blue"><Clock3 size={16}/></span><div><strong>{fmt(Math.max(0,totalTarget-todaySeconds))}</strong><span>Time remaining</span></div></div><div className="mini-stat"><span className="mini-icon purple"><Target size={16}/></span><div><strong>{store.tasks.filter(t=>(todayByTask[t.id]||0)>=t.targetMinutes*60).length}/{store.tasks.length}</strong><span>Tasks completed</span></div></div></div></div>
          <div className={`active-card card ${activeTask?'is-running':''}`}><div className="active-heading"><span className="live-dot"/>{activeTask?'CURRENTLY FOCUSING':'FOCUS SESSION'}</div>{activeTask ? <><div className="active-task-name">{activeTask.name}</div><div className="timer-display">{fmt(activeElapsed)}</div><p className="active-helper">Stay in the zone. You're doing great.</p><div className="timer-actions"><button className="primary-button pause-button" onClick={pauseTimer}><Pause size={17} fill="currentColor"/> Pause session</button><button className="round-button" onClick={openEditActiveTime} aria-label="Adjust study time" title="Adjust study time"><Pencil size={16}/></button><button className="round-button" onClick={()=>{pauseTimer();}} aria-label="Finish session"><Check size={18}/></button></div></> : <><div className="empty-timer-icon"><Play size={24} fill="currentColor"/></div><div className="empty-timer-title">Ready to focus?</div><p className="active-helper">Choose a task below and start your next session.</p><button className="primary-button start-choose" onClick={()=>document.getElementById('task-list')?.scrollIntoView({behavior:'smooth',block:'start'})}>Choose a task <ArrowDownToLine size={16}/></button></>}<div className="active-footer"><span><span className="tiny-shield">✓</span> Timer saves automatically</span><span>Stay focused <Sparkles size={13}/></span></div></div>
        </section>
        <section className="tasks-section" id="task-list"><div className="section-heading"><div><div className="heading-title-row"><h2>Today's plan</h2><span className="count-pill">{store.tasks.length} tasks</span></div><p className="section-sub">Your goals, one focused session at a time.</p></div><button className="outline-button" onClick={openNewTask}><Plus size={17}/> Add task</button></div>
          {store.tasks.length===0 ? <div className="empty-tasks card"><div className="empty-timer-icon"><Target size={23}/></div><h3>Your day is a blank canvas.</h3><p>Add your first task and start building momentum.</p><button className="primary-button" onClick={openNewTask}><Plus size={17}/> Create a task</button></div> : <div className="task-list">{store.tasks.map((task,index)=>{ const seconds=todayByTask[task.id]||0; const target=task.targetMinutes*60; const pct=target?Math.min(100,Math.floor(seconds/target*100)):0; const status=pct>=100?'complete':pct<50?'low':pct>=80?'high':'mid'; const isActive=store.activeTimer?.taskId===task.id; return <article className={`task-card card ${isActive?'task-active':''}`} key={task.id}><div className="task-color" style={{background:task.color}}/><div className="task-main"><div className="task-title-row"><h3>{task.name}</h3>{isActive&&<span className="running-pill"><span/> RUNNING</span>}</div><div className="task-meta"><span>{fmt(seconds)} <i>/</i> {fmtShort(task.targetMinutes)}</span><span className="meta-dot">·</span><span>{Math.max(0,Math.ceil((target-seconds)/60))===0?'Target reached':`${fmtShort(Math.ceil(Math.max(0,target-seconds)/60))} left`}</span></div><div className="task-progress"><div className={`task-progress-fill ${status}`} style={{width:`${pct}%`,background:pct>=100?'#48c9a6':pct<50?'#ff7188':pct>=80?'#f4b65f':task.color}}/></div></div><div className={`task-percent ${status}`}>{pct}%</div><div className="task-actions">{isActive?<button className="task-control pause-control" onClick={pauseTimer} title="Pause"><Pause size={16} fill="currentColor"/></button>:<button className="task-control" onClick={()=>startTimer(task)} title={store.activeTimer?'Switch to this task':'Start task'}><Play size={16} fill="currentColor"/></button>}<button className="task-more" title="Edit task" onClick={()=>openEditTask(task)}><MoreHorizontal size={19}/></button></div></article>; })}</div>}
          <div className="task-legend"><span><i className="legend-dot red"/> Below 50%</span><span><i className="legend-dot amber"/> 50–99%</span><span><i className="legend-dot green"/> Target reached</span><span className="legend-note"><CircleHelp size={13}/> Progress is based on time tracked</span></div>
        </section>
        <section className="sessions-section">
          <div className="section-heading">
            <div><div className="heading-title-row"><h2>Study sessions</h2><span className="count-pill">{store.sessions.length}</span></div><p className="section-sub">Add study time manually or correct a saved session.</p></div>
            <button className="outline-button" onClick={openAddSession}><Plus size={16}/> Add study time</button>
          </div>
          {store.sessions.length === 0
            ? <div className="sessions-empty card">Saved sessions will appear here after you pause a timer.</div>
            : <div className="session-list">
                {[...store.sessions].sort((a,b)=>b.endedAt-a.endedAt).slice(0,10).map(session => {
                  const task = store.tasks.find(t=>t.id===session.taskId);
                  return <article className="session-row card" key={session.id}>
                    <div className="session-main">
                      <strong>{task?.name || 'Removed task'}</strong>
                      <span>{new Date(session.endedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · {new Date(session.endedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    <strong className="session-duration">{fmt(session.durationSeconds)}</strong>
                    <button className="session-edit-button" title="Edit study time" aria-label="Edit study time" onClick={()=>openEditSession(session)}><Pencil size={15}/><span>Edit time</span></button>
                  </article>;
                })}
              </div>}
        </section>
        <section className="bottom-grid"><div className="card week-card"><div className="card-heading"><div><h2>This week</h2><p>Your consistency at a glance</p></div><button className="text-button" onClick={()=>setView('insights')}>View insights <span>↗</span></button></div><div className="week-bars">{Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const key=dayKey(d);const secs=store.sessions.filter(s=>s.dateKey===key).reduce((a,s)=>a+s.durationSeconds,0)+(store.activeTimer&&dayKey(new Date(store.activeTimer.startedAt))===key?activeElapsed:0);const max= Math.max(7*3600,...Array.from({length:7},(_,j)=>{const x=new Date();x.setDate(x.getDate()-(6-j));return store.sessions.filter(s=>s.dateKey===dayKey(x)).reduce((a,s)=>a+s.durationSeconds,0)}));return <div className="week-bar-col" key={key}><div className="bar-value">{secs>=3600?`${(secs/3600).toFixed(1)}h`:secs>=60?`${Math.round(secs/60)}m`:''}</div><div className="bar-track"><div className={`bar-fill ${key===dayKey()?'today-bar':''}`} style={{height:`${Math.max(secs>0?4:0,secs/max*100)}%`}}/></div><span className={key===dayKey()?'day-current':''}>{d.toLocaleDateString('en',{weekday:'short'}).slice(0,2)}</span></div>})}</div></div><div className="card tip-card"><div className="tip-icon"><Flame size={19}/></div><div className="tip-label">A GENTLE REMINDER</div><h3>Consistency beats intensity.</h3><p>You don't need a perfect day. Just show up, focus on one thing, and keep moving forward.</p><div className="tip-footer"><span>YOUR DAILY MOTTO</span><span>✦</span></div></div></section>
      </>}
      {view==='insights' && <section className="page-section"><div className="eyebrow"><span className="eyebrow-line"/> YOUR PROGRESS</div><h1>See how far <span>you've come.</span></h1><p className="subhead">Your effort, turned into a clearer picture of progress.</p><div className="insight-summary"><div className="card insight-metric"><span className="stat-label">TRACKED IN THIS PERIOD</span><strong>{fmt(reportTotal)}</strong><span className="stat-sub">Across {chartData.length} {period==='week'?'days':period==='month'?'days':'months'}</span></div><div className="card insight-metric"><span className="stat-label">DAILY AVERAGE</span><strong>{fmt(reportTotal/(period==='year'?365:chartData.length))}</strong><span className="stat-sub">Based on selected period</span></div><div className="card insight-metric"><span className="stat-label">TOTAL SESSIONS</span><strong>{store.sessions.filter(s=>period==='year'?s.dateKey.startsWith(String(new Date().getFullYear())):period==='month'?s.dateKey.startsWith(dayKey().slice(0,7)):new Date(s.dateKey).getTime()>=startOfDay(new Date(Date.now()-6*86400000))).length}</strong><span className="stat-sub">Saved focus sessions</span></div></div><div className="card chart-card"><div className="card-heading"><div><h2>Study activity</h2><p>Time you invested over time</p></div><div className="period-switch">{(['week','month','year'] as const).map(p=><button className={period===p?'selected':''} key={p} onClick={()=>setPeriod(p)}>{p==='week'?'7 days':p==='month'?'30 days':'12 months'}</button>)}</div></div><div className="chart-area"><div className="y-labels"><span>{fmt(maxChart)}</span><span>{fmt(maxChart*.75)}</span><span>{fmt(maxChart*.5)}</span><span>{fmt(maxChart*.25)}</span><span>0</span></div><div className="chart-plot"><div className="chart-gridlines"><i/><i/><i/><i/><i/></div><div className="chart-bars">{chartData.map((d,i)=><div className="chart-col" key={`${d.label}-${i}`}><div className="chart-bar-wrap"><div className={`chart-bar ${i===chartData.length-1?'last-bar':''}`} style={{height:`${Math.max(d.total>0?2:0,d.total/maxChart*100)}%`}} title={`${d.label}: ${fmt(d.total)}`}/></div><span>{d.label}</span></div>)}</div></div></div><div className="chart-legend"><span className="legend-dot blue-dot"/> Study hours</div></div><div className="card breakdown-card"><div className="card-heading"><div><h2>Task breakdown</h2><p>Total time recorded for each task</p></div></div>{store.tasks.map(t=>{const sec=store.sessions.filter(s=>s.taskId===t.id).reduce((a,s)=>a+s.durationSeconds,0)+(store.activeTimer?.taskId===t.id?activeElapsed:0);const all=store.sessions.reduce((a,s)=>a+s.durationSeconds,0)+activeElapsed;return <div className="breakdown-row" key={t.id}><span className="breakdown-swatch" style={{background:t.color}}/><span className="breakdown-name">{t.name}</span><div className="breakdown-track"><span style={{width:`${all?sec/all*100:0}%`,background:t.color}}/></div><strong>{fmt(sec)}</strong></div>})}</div></section>}
      {view==='settings' && <section className="page-section"><div className="eyebrow"><span className="eyebrow-line"/> YOUR PREFERENCES</div><h1>Keep it <span>your way.</span></h1><p className="subhead">Simple settings to keep your study tracker working for you.</p><div className="settings-list"><div className="card settings-card"><div className="settings-icon"><Target size={19}/></div><div className="settings-main"><h3>Daily study target</h3><p>Set the total number of minutes you want to study each day.</p><div className="target-control"><button onClick={()=>setStore({...store,dailyTargetMinutes:Math.max(30,store.dailyTargetMinutes-30)})}>−</button><strong>{fmtShort(store.dailyTargetMinutes)}</strong><button onClick={()=>setStore({...store,dailyTargetMinutes:store.dailyTargetMinutes+30})}>+</button></div><span className="settings-hint">The dashboard target is currently based on the sum of your task targets. This setting is saved for future dashboard options.</span></div></div><div className="card settings-card"><div className="settings-icon"><Download size={19}/></div><div className="settings-main"><h3>Backup your data</h3><p>Export your tasks and study history to a file. Keep it somewhere safe.</p><button className="outline-button" onClick={exportData}><Download size={16}/> Export backup</button></div></div><div className="card settings-card"><div className="settings-icon"><ArrowDownToLine size={19}/></div><div className="settings-main"><h3>Restore a backup</h3><p>Import a previous TrackMyStudy backup. This replaces the data currently stored on this device.</p><label className="outline-button file-button"><ArrowDownToLine size={16}/> Choose backup file<input type="file" accept="application/json,.json" onChange={importData}/></label></div></div><div className="card privacy-card"><div className="privacy-check"><Check size={17}/></div><div><h3>Your data belongs to you.</h3><p>TrackMyStudy stores your study plan and sessions in this browser on this device. There is no account and nothing is uploaded to a server. Clearing browser data may erase your records, so export a backup periodically.</p></div></div></div></section>}
      <footer className="footer"><span>© {new Date().getFullYear()} TrackMyStudy</span><span><span className="online-dot"/> Made for your next focused hour</span><span>V1.0 · Your data stays yours</span></footer>
    </main>
    <nav className="mobile-nav"><button className={view==='today'?'active':''} onClick={()=>setView('today')}><CalendarDays size={19}/><span>Today</span></button><button className={view==='insights'?'active':''} onClick={()=>setView('insights')}><BarChart3 size={19}/><span>Insights</span></button><button className={view==='settings'?'active':''} onClick={()=>setView('settings')}><Settings2 size={19}/><span>Settings</span></button></nav>
    {showTaskForm&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowTaskForm(false)}}><form className="task-modal" onSubmit={saveTask}><div className="modal-heading"><div><span className="eyebrow">YOUR DAILY PLAN</span><h2>{editing?'Edit task':'Create a task'}</h2><p>Make a little room for what matters.</p></div><button type="button" className="icon-button" onClick={()=>setShowTaskForm(false)}><X size={18}/></button></div><label className="field-label">Task name</label><input className="text-input" autoFocus value={taskName} onChange={e=>setTaskName(e.target.value)} placeholder="e.g. Java concurrency" maxLength={60} required/><label className="field-label">Daily target</label><div className="duration-inputs"><div><input className="text-input" type="number" min="0" max="24" value={taskHours} onChange={e=>setTaskHours(e.target.value)} required/><span>Hours</span></div><div><input className="text-input" type="number" min="0" max="59" value={taskMinutes} onChange={e=>setTaskMinutes(e.target.value)} required/><span>Minutes</span></div></div>{editing&&<button type="button" className="delete-task" onClick={()=>{setShowTaskForm(false);setDeleteId(editing.id)}}><Trash2 size={15}/> Remove this task</button>}<div className="modal-actions"><button type="button" className="outline-button" onClick={()=>setShowTaskForm(false)}>Cancel</button><button type="submit" className="primary-button"><Check size={16}/>{editing?'Save changes':'Add to my plan'}</button></div></form></div>}
    {showAddSession&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowAddSession(false)}}>
      <form className="task-modal" onSubmit={saveManualSession}>
        <div className="modal-heading"><div><span className="eyebrow">STUDY HISTORY</span><h2>Add study time</h2><p>Select a task and enter the time you actually studied.</p></div><button type="button" className="icon-button" aria-label="Close" onClick={()=>setShowAddSession(false)}><X size={18}/></button></div>
        <label className="field-label">Select task</label>
        <select className="text-input" value={manualTaskId} onChange={e=>setManualTaskId(e.target.value)} required>
          <option value="" disabled>Choose a task</option>
          {store.tasks.map(task=><option key={task.id} value={task.id}>{task.name}</option>)}
        </select>
        <label className="field-label">Actual study duration</label>
        <div className="duration-inputs"><div><input className="text-input" type="number" min="0" max="24" value={manualHours} onChange={e=>setManualHours(e.target.value)} required/><span>Hours</span></div><div><input className="text-input" type="number" min="0" max="59" value={manualMinutes} onChange={e=>setManualMinutes(e.target.value)} required/><span>Minutes</span></div></div>
        <p className="session-edit-note">This adds a session for today. Your task totals and charts will update automatically.</p>
        <div className="modal-actions"><button type="button" className="outline-button" onClick={()=>setShowAddSession(false)}>Cancel</button><button type="submit" className="primary-button"><Check size={16}/>Save study time</button></div>
      </form>
    </div>}
    {editingActiveTime&&store.activeTimer&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditingActiveTime(false)}}>
      <form className="task-modal" onSubmit={saveActiveTimeEdit}>
        <div className="modal-heading"><div><span className="eyebrow">CURRENT SESSION</span><h2>Adjust study time</h2><p>Correct the timer without stopping your session.</p></div><button type="button" className="icon-button" aria-label="Close" onClick={()=>setEditingActiveTime(false)}><X size={18}/></button></div>
        <div className="session-edit-context">{activeTask?.name || 'Active task'} · Current tracked time: {fmt(activeElapsed)}</div>
        <label className="field-label">Actual study duration</label>
        <div className="duration-inputs"><div><input className="text-input" type="number" min="0" max="24" value={sessionHours} onChange={e=>setSessionHours(e.target.value)} required/><span>Hours</span></div><div><input className="text-input" type="number" min="0" max="59" value={sessionMinutes} onChange={e=>setSessionMinutes(e.target.value)} required/><span>Minutes</span></div></div>
        <p className="session-edit-note">For example, change 5 hours to 1 hour. The timer will continue counting from the corrected duration.</p>
        <div className="modal-actions"><button type="button" className="outline-button" onClick={()=>setEditingActiveTime(false)}>Cancel</button><button type="submit" className="primary-button"><Check size={16}/>Save time</button></div>
      </form>
    </div>}
    {editingSession&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setEditingSession(null)}}>
      <form className="task-modal" onSubmit={saveSessionEdit}>
        <div className="modal-heading"><div><span className="eyebrow">STUDY HISTORY</span><h2>Edit study time</h2><p>Correct the duration for this saved session.</p></div><button type="button" className="icon-button" aria-label="Close" onClick={()=>setEditingSession(null)}><X size={18}/></button></div>
        <div className="session-edit-context">{store.tasks.find(t=>t.id===editingSession.taskId)?.name || 'Removed task'} · {new Date(editingSession.endedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
        <label className="field-label">Actual study duration</label>
        <div className="duration-inputs"><div><input className="text-input" type="number" min="0" max="24" value={sessionHours} onChange={e=>setSessionHours(e.target.value)} required/><span>Hours</span></div><div><input className="text-input" type="number" min="0" max="59" value={sessionMinutes} onChange={e=>setSessionMinutes(e.target.value)} required/><span>Minutes</span></div></div>
        <p className="session-edit-note">Example: change 5 hours to 1 hour and save. Your totals and charts will recalculate.</p>
        <div className="modal-actions"><button type="button" className="outline-button" onClick={()=>setEditingSession(null)}>Cancel</button><button type="submit" className="primary-button"><Check size={16}/>Save time</button></div>
      </form>
    </div>}
    {deleteId&&<div className="modal-backdrop"><div className="confirm-modal"><div className="delete-icon"><Trash2 size={20}/></div><h2>Remove this task?</h2><p>Past study sessions will remain in your history, but this task will disappear from today's plan.</p><div className="modal-actions"><button className="outline-button" onClick={()=>setDeleteId(null)}>Keep task</button><button className="danger-button" onClick={()=>removeTask(deleteId)}>Remove task</button></div></div></div>}
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}
