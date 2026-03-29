import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Home,
  FileText,
  UserRound,
  LogOut,
  Search,
  ClipboardList,
  CheckCircle2,
  CalendarDays,
  Pencil,
  Save,
  X,
  Users,
} from 'lucide-react'

const supabaseUrl = 'https://mhdbyhuqycwrhjevaxld.supabase.co'
const supabaseAnonKey = 'sb_publishable_vBUNEU_plkZJIH3o3bJYSg_i9ygIxGL'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const TYPE_LABELS: Record<string, string> = {
  phd_one_on_one: '博士单独汇报',
  master_grade_meeting: '硕士年级会议',
  phd_group_meeting: '博士大组会',
  master_group_meeting: '硕士大组会',
}

const BLOCK_LABELS: Record<string, string> = {
  morning: '上午',
  afternoon: '下午',
  evening: '晚上',
  allday: '全天',
}

const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
  cancelled: '已取消',
}

const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  scheduled: '已安排',
  completed: '已完成',
  cancelled: '已取消',
}

const DURATION_MINUTES: Record<string, number> = {
  phd_one_on_one: 30,
  master_grade_meeting: 60,
  phd_group_meeting: 90,
  master_group_meeting: 90,
}

function fmtDate(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('zh-CN')
}

function fmtDateTime(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('zh-CN', { hour12: false })
}

function currentMonthFirstDay() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function downloadCsv(rows: Array<Record<string, unknown>>, filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map((r) =>
      headers.map((h) => `"${String(r[h] ?? '').replaceAll('"', '""')}"`).join(',')
    ),
  ].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function Pill({ tone = 'slate', children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

function Header({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="header">
      <div>
        <div className="eyebrow">课题组内部使用</div>
        <h1 className="title">{title}</h1>
        {subtitle ? <div className="subtitle">{subtitle}</div> : null}
      </div>
      {action}
    </div>
  )
}

function roleText(role?: string) {
  if (role === 'phd') return '博士'
  if (role === 'master') return '硕士'
  if (role === 'teacher') return '老师'
  return role || '未知'
}
function studentStatusText(v?: string) {
  if (v === 'enrolled') return '在读'
  if (v === 'visiting_abroad') return '留学'
  if (v === 'graduated') return '毕业'
  return v || '未知'
}
function leaderScopeText(v?: string) {
  if (v === 'phd') return '博士负责人'
  if (v === 'master') return '硕士负责人'
  if (v === 'direction_group') return '方向小组负责人'
  return '无'
}
async function signOutAndReload() {
  await supabase.auth.signOut()
  location.reload()
}

function latestRequestOfType(requests: any[], meetingType: string) {
  return requests
    .filter((r) => r.meeting_type === meetingType)
    .sort((a, b) => {
      const ta = new Date(a.updated_at || a.submitted_at || a.created_at || 0).getTime()
      const tb = new Date(b.updated_at || b.submitted_at || b.created_at || 0).getTime()
      return tb - ta
    })[0]
}

function lifecycleForApplicant(requests: any[], meetingType: string) {
  const latest = latestRequestOfType(requests, meetingType)
  if (!latest) return { label: '待申请', tone: 'orange' }

  if (latest.meeting_id) {
    if (latest.schedule_status === 'completed') return { label: '已完成', tone: 'green' }
    if (latest.schedule_status === 'scheduled') return { label: '待开会', tone: 'indigo' }
    if (latest.schedule_status === 'cancelled') return { label: '待再次申请', tone: 'rose' }
  }

  if (latest.status === 'pending') return { label: '待安排', tone: 'indigo' }
  if (latest.status === 'approved') return { label: '待开会', tone: 'indigo' }
  if (latest.status === 'rejected' || latest.status === 'cancelled') return { label: '待再次申请', tone: 'rose' }

  return { label: '待申请', tone: 'orange' }
}

function AuthView({ onDone }: { onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    password2: '',
    role: 'phd',
    studentStatus: 'enrolled',
    isLeader: false,
    leaderScope: '',
  })

  const setField = (k: string, v: any) => setForm((s) => ({ ...s, [k]: v }))

  async function login() {
    setBusy(true)
    setMsg('登录中...')
    const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password })
    setBusy(false)
    if (error) return setMsg(error.message)
    setMsg('登录成功，正在进入...')
    await onDone()
  }

  async function register() {
    if (!form.name.trim()) return setMsg('姓名不能为空')
    if (!form.email.trim()) return setMsg('邮箱不能为空')
    if (!form.password || form.password.length < 6) return setMsg('密码至少 6 位')
    if (form.password !== form.password2) return setMsg('两次密码不一致')
    if (form.isLeader && !form.leaderScope) return setMsg('负责人必须选择负责人范围')

    setBusy(true)
    setMsg('注册中...')
    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          name: form.name.trim(),
          role: form.role,
          student_status: form.studentStatus,
          is_group_leader: form.isLeader,
          leader_scope: form.isLeader ? form.leaderScope : null,
        },
      },
    })
    setBusy(false)
    if (error) return setMsg(error.message)
    setMsg('注册成功，请直接登录')
    setMode('login')
  }

  return (
    <div className="screen">
      <div className="phone-shell">
        <Header title="组会小助手" subtitle="登录后按角色自动进入学生端或老师端。" />
        <Card className="auth-card">
          <div className="segmented">
            <button className={mode === 'login' ? 'seg active' : 'seg'} onClick={() => setMode('login')}>登录</button>
            <button className={mode === 'register' ? 'seg active' : 'seg'} onClick={() => setMode('register')}>注册</button>
          </div>
          {mode === 'register' ? (
            <div className="form-stack">
              <div><label>姓名</label><input value={form.name} onChange={(e) => setField('name', e.target.value)} /></div>
              <div><label>邮箱</label><input value={form.email} onChange={(e) => setField('email', e.target.value)} /></div>
              <div className="grid-two">
                <div><label>密码</label><input type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} /></div>
                <div><label>确认密码</label><input type="password" value={form.password2} onChange={(e) => setField('password2', e.target.value)} /></div>
              </div>
              <div className="grid-two">
                <div>
                  <label>身份</label>
                  <select value={form.role} onChange={(e) => setField('role', e.target.value)}>
                    <option value="teacher">老师</option>
                    <option value="phd">博士</option>
                    <option value="master">硕士</option>
                  </select>
                </div>
                <div>
                  <label>状态</label>
                  <select value={form.studentStatus} onChange={(e) => setField('studentStatus', e.target.value)}>
                    <option value="enrolled">在读</option>
                    <option value="visiting_abroad">留学</option>
                    <option value="graduated">毕业</option>
                  </select>
                </div>
              </div>
              <label className="check-row"><input type="checkbox" checked={form.isLeader} onChange={(e) => setField('isLeader', e.target.checked)} />是否负责人</label>
              {form.isLeader ? (
                <div>
                  <label>负责人范围</label>
                  <select value={form.leaderScope} onChange={(e) => setField('leaderScope', e.target.value)}>
                    <option value="">请选择</option>
                    <option value="phd">博士负责人</option>
                    <option value="master">硕士负责人</option>
                    <option value="direction_group">方向小组负责人</option>
                  </select>
                </div>
              ) : null}
              <button disabled={busy} className="primary-btn" onClick={register}>注册</button>
            </div>
          ) : (
            <div className="form-stack">
              <div><label>邮箱</label><input value={form.email} onChange={(e) => setField('email', e.target.value)} /></div>
              <div><label>密码</label><input type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} /></div>
              <button disabled={busy} className="primary-btn" onClick={login}>登录</button>
            </div>
          )}
          <div className="helper-box">{msg || '手机端优先布局，老师端包含审批、导出与日历浮层。'}</div>
        </Card>
      </div>
    </div>
  )
}

function buildStudentTasks(profile: any, requests: any[], directionMonthCompleted: boolean) {
  const tasks: Array<{ key: string; title: string; tone: string; value: string; clickable?: boolean }> = []

  if (profile?.role === 'phd') {
    if (profile?.effective_need_one_on_one) {
      const life = lifecycleForApplicant(requests, 'phd_one_on_one')
      tasks.push({
        key: 'phd_one_on_one',
        title: '博士单独汇报',
        tone: life.tone,
        value: life.label,
        clickable: true,
      })
    }
    tasks.push({
      key: 'phd_group_meeting',
      title: '博士大组会',
      tone: 'indigo',
      value: profile?.is_group_leader && profile?.leader_scope === 'phd'
        ? lifecycleForApplicant(requests, 'phd_group_meeting').label
        : '待安排',
      clickable: !!(profile?.is_group_leader && profile?.leader_scope === 'phd'),
    })
  }

  if (profile?.role === 'master') {
  tasks.push({
    key: 'master_grade_meeting',
    title: '硕士年级会议',
    tone: lifecycleForApplicant(requests, 'master_grade_meeting').tone,
    value: lifecycleForApplicant(requests, 'master_grade_meeting').label,
    clickable: true,
  })

  tasks.push({
    key: 'master_group_meeting',
    title: '硕士大组会',
    tone: profile?.is_group_leader && profile?.leader_scope === 'master'
      ? lifecycleForApplicant(requests, 'master_group_meeting').tone
      : 'indigo',
    value: profile?.is_group_leader && profile?.leader_scope === 'master'
      ? lifecycleForApplicant(requests, 'master_group_meeting').label
      : '待安排',
    clickable: !!(profile?.is_group_leader && profile?.leader_scope === 'master'),
  })
}

  tasks.push({
    key: 'direction_group',
    title: '方向小组会',
    tone: directionMonthCompleted ? 'green' : 'slate',
    value: directionMonthCompleted ? '已完成' : '待本组安排',
    clickable: false,
  })

  return tasks
}

function StudentHome({
  profile,
  requests,
  directionMonthCompleted,
  directionCanEdit,
  directionParticipants,
  refreshAll,
  onNavigate,
}: any) {
  const cards = useMemo(() => buildStudentTasks(profile, requests, directionMonthCompleted), [profile, requests, directionMonthCompleted])
  const [directionOpen, setDirectionOpen] = useState(false)
  const [directionPicked, setDirectionPicked] = useState<string[]>([])
  const [directionMsg, setDirectionMsg] = useState('')

  async function submitDirectionCompleted() {
    setDirectionMsg('提交中...')
    const { error } = await supabase.rpc('set_direction_group_month_complete', {
      p_target_month: currentMonthFirstDay(),
      p_participant_ids: directionPicked,
      p_note: '前端登记本月方向小组会已完成',
    })
    if (error) return setDirectionMsg(error.message)
    setDirectionMsg('登记成功')
    setDirectionOpen(false)
    await refreshAll()
  }

  return (
    <div className="screen">
      <div className="phone-shell">
        <Header
          title="组会小助手"
          action={
            <div className="header-actions">
              <button className="chip-btn" onClick={() => onNavigate('profile')}>我的信息</button>
              <button className="chip-btn" onClick={signOutAndReload}><LogOut size={16} />退出</button>
            </div>
          }
        />
        <Card className="hero-card">
          <div className="hero-kicker">本月提醒</div>
          <div className="hero-title">按你的身份动态更新会议状态</div>
          <div className="hero-desc">
            生命周期：待申请 → 待安排 → 待开会；如果老师拒绝，则回到待再次申请。方向小组会所有人都显示，只有方向负责人可以登记完成并选择成员。
          </div>
        </Card>

        <div className="mini-grid">
          {cards.map((c) => (
            <button
              key={c.key}
              className={`mini-card tone-${c.tone}`}
              onClick={() => {
                if (c.clickable) onNavigate('apply')
                if (c.key === 'direction_group' && directionCanEdit) setDirectionOpen(true)
              }}
            >
              <div className="mini-label">{c.title}</div>
              <div className="mini-value">{c.value}</div>
            </button>
          ))}
        </div>

        {directionCanEdit ? (
          <Card>
            <div className="section-head">
              <div className="section-title">方向小组会管理</div>
              <button className="chip-btn" onClick={() => setDirectionOpen(true)}><Users size={16} />登记完成</button>
            </div>
            <div className="helper-box">
              只有方向负责人可以将本月方向小组会登记为“已完成”，并选择本次参会成员。成员首页会自动显示为“已完成”。
            </div>
          </Card>
        ) : null}

        <Card>
          <div className="section-head">
            <div className="section-title">这个月需要参加的会议</div>
            <button className="chip-btn" onClick={() => onNavigate('home')}>学生首页</button>
          </div>
          <div className="stack">
            {!requests.length ? <div className="list-card muted">暂无申请记录</div> : requests.map((r: any) => (
              <div key={r.request_id} className="list-card">
                <div className="list-top">
                  <div className="list-title">{TYPE_LABELS[r.meeting_type] || r.meeting_type}</div>
                  <Pill tone={r.meeting_id ? (r.schedule_status === 'completed' ? 'green' : 'indigo') : (r.status === 'pending' ? 'orange' : r.status === 'approved' ? 'indigo' : 'rose')}>
                    {r.meeting_id ? (SCHEDULE_STATUS_LABELS[r.schedule_status] || r.schedule_status) : (REQUEST_STATUS_LABELS[r.status] || r.status)}
                  </Pill>
                </div>
                <div className="list-sub">{r.topic}</div>
                <div className="list-note">
                  {r.meeting_id
                    ? `${fmtDate(r.meeting_date)} ${BLOCK_LABELS[r.time_block] || ''} · ${fmtDateTime(r.scheduled_start_at)}`
                    : [1,2,3].map((i) => {
                        const d = r[`candidate_${i}_date`]
                        const b = r[`candidate_${i}_block`]
                        return d ? `${fmtDate(d)} ${BLOCK_LABELS[b] || ''}` : null
                      }).filter(Boolean).join(' / ')}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {directionOpen ? (
          <div className="overlay" onClick={() => setDirectionOpen(false)}>
            <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
              <div className="section-head">
                <div className="section-title">登记方向小组会已完成</div>
                <button className="chip-btn" onClick={() => setDirectionOpen(false)}>关闭</button>
              </div>
              <div className="form-stack">
                <div className="helper-box">选择本月方向小组会的参会成员。提交后，这些成员首页的“方向小组会”状态会自动显示为已完成。</div>
                <div>
                  <label>参会成员</label>
                  <div className="chips-wrap">
                    {directionParticipants.map((p: any) => {
                      const active = directionPicked.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          className={active ? 'chip active' : 'chip'}
                          onClick={() => setDirectionPicked((s) => active ? s.filter((x) => x !== p.id) : [...s, p.id])}
                        >
                          {p.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <button className="primary-btn" onClick={submitDirectionCompleted}>提交已完成</button>
                <div className="helper-box">{directionMsg || '本操作会更新月度完成状态与成员名单。'}</div>
              </div>
            </div>
          </div>
        ) : null}

        <StudentBottomNav current="home" onNavigate={onNavigate} />
      </div>
    </div>
  )
}

function StudentApply({ profile, participants, onNavigate, refreshAll }: any) {
  const [meetingType, setMeetingType] = useState('')
  const [topic, setTopic] = useState('')
  const [requestNote, setRequestNote] = useState('')
  const [c1Date, setC1Date] = useState('')
  const [c1Block, setC1Block] = useState('')
  const [c2Date, setC2Date] = useState('')
  const [c2Block, setC2Block] = useState('')
  const [c3Date, setC3Date] = useState('')
  const [c3Block, setC3Block] = useState('')
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [msg, setMsg] = useState('')

  const allowedMeetingTypes = useMemo(() => {
  const list: string[] = []

  if (profile?.role === 'phd' && profile?.effective_need_one_on_one) {
    list.push('phd_one_on_one')
  }

  if (profile?.role === 'phd' && profile?.is_group_leader && profile?.leader_scope === 'phd') {
    list.push('phd_group_meeting')
  }

  if (profile?.role === 'master') {
    list.push('master_grade_meeting')
  }

  if (profile?.role === 'master' && profile?.is_group_leader && profile?.leader_scope === 'master') {
    list.push('master_group_meeting')
  }

  return list
}, [profile])

  useEffect(() => {
    if (!meetingType && allowedMeetingTypes.length) setMeetingType(allowedMeetingTypes[0])
  }, [allowedMeetingTypes, meetingType])

  async function submit() {
    setMsg('提交中...')
    const { error } = await supabase.rpc('submit_meeting_request', {
      p_meeting_type: meetingType,
      p_topic: topic.trim(),
      p_request_note: requestNote.trim() || null,
      p_candidate_1_date: c1Date || null,
      p_candidate_1_block: c1Block || null,
      p_candidate_2_date: c2Date || null,
      p_candidate_2_block: c2Block || null,
      p_candidate_3_date: c3Date || null,
      p_candidate_3_block: c3Block || null,
      p_participant_ids: selectedParticipants,
    })
    if (error) return setMsg(error.message)
    setMsg('提交成功，当前状态已变为待安排')
    setTopic(''); setRequestNote(''); setC1Date(''); setC1Block(''); setC2Date(''); setC2Block(''); setC3Date(''); setC3Block('')
    setSelectedParticipants([])
    await refreshAll()
  }

  return (
    <div className="screen">
      <div className="phone-shell">
        <Header title="申请会议" action={<button className="chip-btn" onClick={signOutAndReload}><LogOut size={16} />退出</button>} />
        <Card>
          <div className="section-head">
            <div className="section-title">会议申请</div>
            <Pill tone="indigo">多日候选</Pill>
          </div>
          <div className="form-stack">
            <div>
              <label>会议类型</label>
              <select value={meetingType} onChange={(e) => setMeetingType(e.target.value)}>
                {allowedMeetingTypes.map((v) => <option key={v} value={v}>{TYPE_LABELS[v]}</option>)}
              </select>
            </div>
            <div><label>主题</label><textarea value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="阶段进展、问题梳理" /></div>
            <div><label>附加说明（可选）</label><textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} /></div>
            {[
              ['候选 1', c1Date, setC1Date, c1Block, setC1Block],
              ['候选 2', c2Date, setC2Date, c2Block, setC2Block],
              ['候选 3', c3Date, setC3Date, c3Block, setC3Block],
            ].map(([label, date, setDate, block, setBlock]: any) => (
              <div key={label} className="candidate-box">
                <div><label>{label} - 日期</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                <div>
                  <label>{label} - 时间段</label>
                  <select value={block} onChange={(e) => setBlock(e.target.value)}>
                    <option value="">请选择</option>
                    {Object.entries(BLOCK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            ))}
            <div>
              <label>多人会议参会人（发起人会自动加入）</label>
              <div className="chips-wrap">
                {participants.map((p: any) => {
                  const active = selectedParticipants.includes(p.id)
                  return <button key={p.id} className={active ? 'chip active' : 'chip'} onClick={() => setSelectedParticipants((s) => active ? s.filter((x) => x !== p.id) : [...s, p.id])}>{p.name}</button>
                })}
              </div>
            </div>
            <div className="helper-box">状态流转：待申请 → 待安排 → 待开会 → 已完成。若老师拒绝或取消，则变为待再次申请。</div>
            <button className="primary-btn" onClick={submit}>提交申请</button>
            <div className="helper-box">{msg || '系统只允许你发起与你身份和负责人范围匹配的会议类型。'}</div>
          </div>
        </Card>
        <StudentBottomNav current="apply" onNavigate={onNavigate} />
      </div>
    </div>
  )
}

function buildTodoSummary(profile: any, requests: any[], directionMonthCompleted: boolean) {
  const lines: string[] = []

  if (profile?.role === 'phd' && profile?.effective_need_one_on_one) {
    const life = lifecycleForApplicant(requests, 'phd_one_on_one').label
    lines.push(`博士单独汇报：当前状态为“${life}”`)
  }

  if (profile?.role === 'phd' && profile?.is_group_leader && profile?.leader_scope === 'phd') {
    const life = lifecycleForApplicant(requests, 'phd_group_meeting').label
    lines.push(`你是博士负责人：本月还需关注博士大组会，当前状态为“${life}”`)
  }

  if (profile?.role === 'master' && profile?.is_group_leader && profile?.leader_scope === 'master') {
    const life = lifecycleForApplicant(requests, 'master_grade_meeting').label
    lines.push(`你是硕士负责人：本月还需关注硕士年级会议，当前状态为“${life}”`)
  }

  if (profile?.is_group_leader && profile?.leader_scope === 'direction_group') {
    lines.push('你是方向小组负责人：本月需在组会完成后登记“已完成”，并选择参会成员')
  } else {
    lines.push(`方向小组会：当前状态为“${directionMonthCompleted ? '已完成' : '待本组安排'}”`)
  }

  if (!lines.length) {
    lines.push('系统会根据你的身份、状态和负责人范围，自动判断你本月需要处理的组会事项。')
  }

  return lines
}

function StudentProfile({ profile, onNavigate, refreshAll, requests, directionMonthCompleted }: any) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({
    role: profile?.role || 'phd',
    student_status: profile?.student_status || 'enrolled',
    is_group_leader: !!profile?.is_group_leader,
    leader_scope: profile?.leader_scope || '',
  })

  const summaryLines = useMemo(
    () => buildTodoSummary(profile, requests, directionMonthCompleted),
    [profile, requests, directionMonthCompleted]
  )

  useEffect(() => {
    setForm({
      role: profile?.role || 'phd',
      student_status: profile?.student_status || 'enrolled',
      is_group_leader: !!profile?.is_group_leader,
      leader_scope: profile?.leader_scope || '',
    })
  }, [profile])

  async function save() {
    if (form.role === 'teacher') {
      return setMsg('个人资料页暂不支持把学生直接改成老师')
    }
    if (form.is_group_leader && !form.leader_scope) {
      return setMsg('负责人必须选择负责人范围')
    }
    setSaving(true)
    setMsg('保存中...')
    const payload: any = {
      role: form.role,
      student_status: form.student_status,
      is_group_leader: form.is_group_leader,
      leader_scope: form.is_group_leader ? form.leader_scope : null,
    }
    const { error } = await supabase.from('profiles').update(payload).eq('id', profile.id)
    setSaving(false)
    if (error) return setMsg(`保存失败：${error.message}`)
    setMsg('保存成功，身份相关会议分类会自动刷新')
    setEditing(false)
    await refreshAll()
  }

  return (
    <div className="screen">
      <div className="phone-shell">
        <Header
          title="我的信息"
          action={
            <div className="header-actions">
              {!editing ? (
                <button className="chip-btn" onClick={() => setEditing(true)}><Pencil size={16} />编辑</button>
              ) : (
                <>
                  <button className="chip-btn" onClick={() => setEditing(false)}><X size={16} />取消</button>
                  <button className="chip-btn" onClick={save} disabled={saving}><Save size={16} />保存</button>
                </>
              )}
              <button className="chip-btn" onClick={signOutAndReload}><LogOut size={16} />退出</button>
            </div>
          }
        />

        <Card>
          <div className="section-head">
            <div className="section-title">个人资料</div>
            <Pill tone="green">{editing ? '编辑中' : '可编辑'}</Pill>
          </div>
          {!editing ? (
            <div className="profile-grid">
              <div className="info-card"><div className="info-label">身份</div><div className="info-value">{roleText(profile?.role)}</div></div>
              <div className="info-card"><div className="info-label">状态</div><div className="info-value">{studentStatusText(profile?.student_status)}</div></div>
              <div className="info-card"><div className="info-label">是否负责人</div><div className="info-value">{profile?.is_group_leader ? '是' : '否'}</div></div>
              <div className="info-card"><div className="info-label">负责人范围</div><div className="info-value">{leaderScopeText(profile?.leader_scope)}</div></div>
            </div>
          ) : (
            <div className="form-stack">
              <div>
                <label>身份</label>
                <select value={form.role} onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}>
                  <option value="phd">博士</option>
                  <option value="master">硕士</option>
                </select>
              </div>
              <div>
                <label>状态</label>
                <select value={form.student_status} onChange={(e) => setForm((s) => ({ ...s, student_status: e.target.value }))}>
                  <option value="enrolled">在读</option>
                  <option value="visiting_abroad">留学</option>
                  <option value="graduated">毕业</option>
                </select>
              </div>
              <label className="check-row"><input type="checkbox" checked={form.is_group_leader} onChange={(e) => setForm((s) => ({ ...s, is_group_leader: e.target.checked }))} />是否负责人</label>
              {form.is_group_leader ? (
                <div>
                  <label>负责人范围</label>
                  <select value={form.leader_scope} onChange={(e) => setForm((s) => ({ ...s, leader_scope: e.target.value }))}>
                    <option value="">请选择</option>
                    <option value="phd">博士负责人</option>
                    <option value="master">硕士负责人</option>
                    <option value="direction_group">方向小组负责人</option>
                  </select>
                </div>
              ) : null}
              <div className="helper-box">{msg || '这里可以在硕士与博士之间切换。保存后，首页会议分类和本账号摘要会自动刷新。'}</div>
            </div>
          )}
        </Card>

        <Card>
          <div className="section-title">本账号当前应做事项摘要</div>
          <div className="summary-list">
            {summaryLines.map((line, idx) => (
              <div key={idx} className="summary-item">{line}</div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="section-title">组会机制说明</div>
          <div className="helper-box strong-box">
            状态流转：待申请 → 待安排 → 待开会 → 已完成；如老师拒绝或取消，则状态变为：待再次申请。
          </div>

          <div className="matrix-wrap">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>角色</th>
                  <th>博士单独汇报</th>
                  <th>博士大组会</th>
                  <th>硕士年级会议</th>
                  <th>方向小组会</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>在读博士</td>
                  <td>自己申请</td>
                  <td>看通知；博士负责人需组织</td>
                  <td>✕</td>
                  <td>默认显示；被登记参会后为已完成</td>
                </tr>
                <tr>
                  <td>留学博士</td>
                  <td>可主动申请</td>
                  <td>看通知；博士负责人需组织</td>
                  <td>✕</td>
                  <td>默认显示；被登记参会后为已完成</td>
                </tr>
                <tr>
                  <td>硕士</td>
                  <td>✕</td>
                  <td>自己可申请</td>
                  <td>看通知；硕士负责人需组织</td>
                  <td>默认显示；被登记参会后为已完成</td>
                </tr>
                <tr>
                  <td>博士负责人</td>
                  <td>自己申请</td>
                  <td>负责发起 / 组织</td>
                  <td>✕</td>
                  <td>若同时是方向负责人，可登记完成</td>
                </tr>
                <tr>
                  <td>硕士负责人</td>
                  <td>✕</td>
                  <td>自己可申请</td>
                  <td>负责发起 / 组织</td>
                  <td>若同时是方向负责人，可登记完成</td>
                </tr>
                <tr>
                  <td>方向小组负责人</td>
                  <td>按本人身份判断</td>
                  <td>按本人身份判断</td>
                  <td>按本人身份判断</td>
                  <td>负责登记“本月已完成”并选择参会成员</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="helper-box">
            提醒机制：系统会根据你的身份、状态和负责人范围，自动显示本月需要处理的会议事项；老师审批后，学生端状态会自动更新。
          </div>
        </Card>

        <StudentBottomNav current="profile" onNavigate={onNavigate} />
      </div>
    </div>
  )
}

function StudentBottomNav({ current, onNavigate }: any) {
  const items = [
    { id: 'home', label: '首页', icon: Home },
    { id: 'apply', label: '申请', icon: FileText },
    { id: 'profile', label: '我的', icon: UserRound },
  ]
  return (
    <div className="bottom-nav">
      {items.map((item) => {
        const Icon = item.icon
        const active = current === item.id
        return (
          <button key={item.id} className={active ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate(item.id)}>
            <Icon size={18} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function CalendarOverlay({ rows }: { rows: any[] }) {
  const grouped = useMemo(() => {
    const m: Record<string, any[]> = {}
    rows.forEach((r) => {
      const key = r.meeting_date
      if (!m[key]) m[key] = []
      m[key].push(r)
    })
    return m
  }, [rows])

  const keys = Object.keys(grouped).sort()
  const [selected, setSelected] = useState(keys[0] || '')
  const now = new Date()
  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <div className="calendar-wrap">
      <div className="section-head">
        <div className="section-title">本月安排</div>
        <Pill tone="indigo">点击日期看详情</Pill>
      </div>
      <div className="calendar-week">
        {['一','二','三','四','五','六','日'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="calendar-grid">
        {days.map((d) => {
          const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const has = !!grouped[dateKey]?.length
          const active = selected === dateKey
          return (
            <button key={d} className={active ? 'day-box active' : 'day-box'} onClick={() => has && setSelected(dateKey)}>
              <div className="day-num">{d}</div>
              {has ? <div className="day-tag">有会</div> : null}
            </button>
          )
        })}
      </div>
      <div className="calendar-detail">
        <div className="calendar-title">{selected ? fmtDate(selected) : '暂无安排'}</div>
        {(grouped[selected] || []).map((r) => (
          <div className="calendar-item" key={r.meeting_id}>
            <div>
              <div className="calendar-item-title">{fmtDateTime(r.scheduled_start_at)} · {r.topic}</div>
              <div className="calendar-item-sub">{TYPE_LABELS[r.meeting_type] || r.meeting_type}</div>
            </div>
            <Pill tone={r.schedule_status === 'completed' ? 'green' : 'indigo'}>
              {SCHEDULE_STATUS_LABELS[r.schedule_status] || r.schedule_status}
            </Pill>
          </div>
        ))}
        {!grouped[selected]?.length ? <div className="muted">当天暂无安排</div> : null}
      </div>
    </div>
  )
}

function TeacherView({ pendingRows, scheduledRows, completedRows, refreshAll }: any) {
  const [tab, setTab] = useState<'pending'|'scheduled'|'completed'|'export'>('pending')
  const [selected, setSelected] = useState<any>(null)
  const [candidateNo, setCandidateNo] = useState(1)
  const [startTime, setStartTime] = useState('15:30')
  const [teacherNote, setTeacherNote] = useState('')
  const [msg, setMsg] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [exportRows, setExportRows] = useState<any[]>([])
  const [exportStart, setExportStart] = useState('')
  const [exportEnd, setExportEnd] = useState('')
  const [exportType, setExportType] = useState('')
  const [exportStatus, setExportStatus] = useState('')

  const duration = DURATION_MINUTES[selected?.meeting_type || 'phd_one_on_one'] || 60
  const endTime = useMemo(() => {
    const [h, m] = startTime.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return ''
    const total = h * 60 + m + duration
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }, [startTime, duration])

  async function approve() {
    if (!selected) return setMsg('请先选择一条申请')
    setMsg('处理中...')
    const v2 = await supabase.rpc('approve_meeting_request_v2', {
      p_request_id: selected.request_id,
      p_selected_candidate_no: candidateNo,
      p_start_time: startTime,
      p_teacher_note: teacherNote || null,
    })
    if (!v2.error) {
      setMsg('审批通过，学生侧状态将显示为待开会')
      setSelected(null)
      setTeacherNote('')
      await refreshAll()
      return
    }

    const date = selected[`candidate_${candidateNo}_date`]
    const block = selected[`candidate_${candidateNo}_block`]
    if (!date || !block) return setMsg(v2.error.message)

    const startIso = new Date(`${date}T${startTime}:00`).toISOString()
    const endIso = new Date(new Date(`${date}T${startTime}:00`).getTime() + duration * 60000).toISOString()

    const fallback = await supabase.rpc('approve_meeting_request', {
      p_request_id: selected.request_id,
      p_meeting_date: date,
      p_time_block: block,
      p_scheduled_start_at: startIso,
      p_scheduled_end_at: endIso,
      p_teacher_note: teacherNote || null,
    })
    if (fallback.error) return setMsg(fallback.error.message)

    setMsg('审批通过，学生侧状态将显示为待开会')
    setSelected(null)
    setTeacherNote('')
    await refreshAll()
  }

  async function reject() {
    if (!selected) return setMsg('请先选择一条申请')
    const { error } = await supabase.rpc('reject_meeting_request', {
      p_request_id: selected.request_id,
      p_teacher_note: teacherNote || '老师已拒绝该申请',
    })
    if (error) return setMsg(error.message)
    setMsg('已拒绝，学生侧状态会回到待再次申请')
    setSelected(null)
    setTeacherNote('')
    await refreshAll()
  }

  async function complete(meetingId: string) {
    const { error } = await supabase.rpc('complete_meeting', {
      p_meeting_id: meetingId,
      p_completion_note: '已完成',
    })
    if (error) return setMsg(error.message)
    await refreshAll()
  }

  async function searchExport() {
    const { data, error } = await supabase.rpc('export_teacher_meetings', {
      p_start_date: exportStart || null,
      p_end_date: exportEnd || null,
      p_meeting_type: exportType || null,
      p_schedule_status: exportStatus || null,
    })
    if (error) return setMsg(error.message)
    setExportRows(data || [])
  }

  function doExport() {
    downloadCsv(exportRows.map((r) => ({
      会议类型: TYPE_LABELS[r.meeting_type] || r.meeting_type,
      主题: r.topic,
      发起人: r.initiator_name,
      发起人身份: r.initiator_role,
      会议日期: r.meeting_date,
      时段: BLOCK_LABELS[r.time_block] || r.time_block,
      开始时间: r.scheduled_start_at,
      结束时间: r.scheduled_end_at,
      会议状态: SCHEDULE_STATUS_LABELS[r.schedule_status] || r.schedule_status,
      参会人: r.participant_names || '',
    })), `teacher_meetings_${Date.now()}.csv`)
  }

  return (
    <div className="screen">
      <div className="phone-shell teacher-shell">
        <Header
          title="老师端"
          action={
            <div className="header-actions">
              <button className="chip-btn" onClick={() => setCalendarOpen(true)}><CalendarDays size={16} />查看日历</button>
              <button className="chip-btn" onClick={signOutAndReload}><LogOut size={16} />退出</button>
            </div>
          }
        />
        <Card className="hero-card">
          <div className="stats-grid">
            <div className="stat-box rose"><div className="stat-label">待审批申请</div><div className="stat-value">{pendingRows.length}条</div></div>
            <div className="stat-box indigo"><div className="stat-label">已安排</div><div className="stat-value">{scheduledRows.length}场</div></div>
            <div className="stat-box green"><div className="stat-label">已完成</div><div className="stat-value">{completedRows.length}场</div></div>
          </div>
        </Card>
        <div className="notice-inline">待审批是老师视角；学生视角会显示为待安排。老师审批同意后，学生会看到待开会；若老师拒绝，学生会看到待再次申请。</div>

        <div className="teacher-tabs">
          {[
            ['pending', '待审批'],
            ['scheduled', '已安排'],
            ['completed', '已完成'],
            ['export', '导出'],
          ].map(([id, label]) => (
            <button key={id} className={tab === id ? 'teacher-tab active' : 'teacher-tab'} onClick={() => setTab(id as any)}>{label}</button>
          ))}
        </div>

        {tab === 'pending' ? (
          <div className="stack">
            <Card>
              <div className="section-title">待审批申请</div>
              <div className="stack">
                {!pendingRows.length ? <div className="list-card muted">暂无待审批申请</div> : pendingRows.map((r: any) => (
                  <button key={r.request_id} className={selected?.request_id === r.request_id ? 'list-card selected' : 'list-card'} onClick={() => { setSelected(r); setCandidateNo(1) }}>
                    <div className="list-top">
                      <div className="list-title">{r.initiator_name} · {TYPE_LABELS[r.meeting_type] || r.meeting_type}</div>
                      <Pill tone="orange">待处理</Pill>
                    </div>
                    <div className="list-sub">{r.topic}</div>
                    <div className="list-note">
                      1. {fmtDate(r.candidate_1_date)} {BLOCK_LABELS[r.candidate_1_block] || ''}　
                      2. {fmtDate(r.candidate_2_date)} {BLOCK_LABELS[r.candidate_2_block] || ''}　
                      3. {fmtDate(r.candidate_3_date)} {BLOCK_LABELS[r.candidate_3_block] || ''}
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <div className="section-title">审批并定时间</div>
              {!selected ? <div className="list-card muted">请先从上方选择一条申请。</div> : (
                <div className="form-stack">
                  <div className="list-card soft">
                    <div className="list-title">{selected.initiator_name}（{selected.initiator_role}）</div>
                    <div className="list-sub">{selected.topic}</div>
                    <div className="list-note">参会人：{selected.participant_names || '无'}</div>
                  </div>
                  <div>
                    <label>从候选时间中选择 1 个</label>
                    <div className="stack">
                      {[1,2,3].map((no) => {
                        const date = selected[`candidate_${no}_date`]
                        const block = selected[`candidate_${no}_block`]
                        if (!date || !block) return null
                        return <button key={no} className={candidateNo === no ? 'choice-card active' : 'choice-card'} onClick={() => setCandidateNo(no)}>候选 {no}：{fmtDate(date)} · {BLOCK_LABELS[block] || block}</button>
                      })}
                    </div>
                  </div>
                  <div className="grid-two">
                    <div><label>最终开始时间</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                    <div><label>自动结束时间</label><div className="readonly-box">{endTime}</div></div>
                  </div>
                  <div><label>老师备注 / 拒绝原因</label><textarea value={teacherNote} onChange={(e) => setTeacherNote(e.target.value)} /></div>
                  <div className="grid-two">
                    <button className="secondary-btn" onClick={reject}>审批拒绝</button>
                    <button className="primary-btn" onClick={approve}>审批通过</button>
                  </div>
                </div>
              )}
              <div className="helper-box">{msg || '老师审批同意后，学生状态变为待开会；拒绝则回到待再次申请。'}</div>
            </Card>
          </div>
        ) : null}

        {tab === 'scheduled' ? (
          <Card>
            <div className="section-title">已安排会议</div>
            <div className="stack">
              {!scheduledRows.length ? <div className="list-card muted">暂无已安排会议</div> : scheduledRows.map((r: any) => (
                <div key={r.meeting_id} className="list-card">
                  <div className="list-top">
                    <div className="list-title">{r.topic}</div>
                    <button className="chip-btn" onClick={() => complete(r.meeting_id)}><CheckCircle2 size={16} />标记完成</button>
                  </div>
                  <div className="list-sub">{TYPE_LABELS[r.meeting_type] || r.meeting_type} · {r.initiator_name}</div>
                  <div className="list-note">{fmtDate(r.meeting_date)} {BLOCK_LABELS[r.time_block] || ''} · {fmtDateTime(r.scheduled_start_at)}</div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {tab === 'completed' ? (
          <Card>
            <div className="section-title">已完成会议</div>
            <div className="stack">
              {!completedRows.length ? <div className="list-card muted">暂无已完成会议</div> : completedRows.map((r: any) => (
                <div key={r.meeting_id} className="list-card">
                  <div className="list-top">
                    <div className="list-title">{r.topic}</div>
                    <Pill tone="green">已完成</Pill>
                  </div>
                  <div className="list-sub">{TYPE_LABELS[r.meeting_type] || r.meeting_type} · {r.initiator_name}</div>
                  <div className="list-note">{fmtDate(r.meeting_date)} · {fmtDateTime(r.completed_at)}</div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {tab === 'export' ? (
          <Card>
            <div className="section-title">导出会议</div>
            <div className="form-stack">
              <div className="grid-two">
                <div><label>开始日期</label><input type="date" value={exportStart} onChange={(e) => setExportStart(e.target.value)} /></div>
                <div><label>结束日期</label><input type="date" value={exportEnd} onChange={(e) => setExportEnd(e.target.value)} /></div>
              </div>
              <div className="grid-two">
                <div>
                  <label>会议类型</label>
                  <select value={exportType} onChange={(e) => setExportType(e.target.value)}>
                    <option value="">全部</option>
                    {Object.entries(TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label>会议状态</label>
                  <select value={exportStatus} onChange={(e) => setExportStatus(e.target.value)}>
                    <option value="">全部</option>
                    {Object.entries(SCHEDULE_STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid-two">
                <button className="secondary-btn" onClick={searchExport}><Search size={16} />查询</button>
                <button className="primary-btn" onClick={doExport}><ClipboardList size={16} />导出 CSV</button>
              </div>
              <div className="stack">
                {!exportRows.length ? <div className="list-card muted">暂无导出结果</div> : exportRows.map((r: any) => (
                  <div key={r.meeting_id} className="list-card">
                    <div className="list-title">{r.topic}</div>
                    <div className="list-sub">{TYPE_LABELS[r.meeting_type] || r.meeting_type} · {r.initiator_name}</div>
                    <div className="list-note">{fmtDate(r.meeting_date)} · {fmtDateTime(r.scheduled_start_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ) : null}

        {calendarOpen ? (
          <div className="overlay" onClick={() => setCalendarOpen(false)}>
            <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
              <div className="section-head">
                <div className="section-title">日历浮层</div>
                <button className="chip-btn" onClick={() => setCalendarOpen(false)}>关闭</button>
              </div>
              <CalendarOverlay rows={[...scheduledRows, ...completedRows]} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function App() {
  const [booting, setBooting] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [studentPage, setStudentPage] = useState<'home'|'apply'|'profile'>('home')
  const [participants, setParticipants] = useState<any[]>([])
  const [studentRequests, setStudentRequests] = useState<any[]>([])
  const [pendingRows, setPendingRows] = useState<any[]>([])
  const [scheduledRows, setScheduledRows] = useState<any[]>([])
  const [completedRows, setCompletedRows] = useState<any[]>([])
  const [directionMonthCompleted, setDirectionMonthCompleted] = useState(false)
  const [directionParticipants, setDirectionParticipants] = useState<any[]>([])

  async function refreshAll() {
    const { data: authData } = await supabase.auth.getUser()
    const currentUser = authData.user || null
    setUser(currentUser)

    if (!currentUser) {
      setProfile(null)
      setBooting(false)
      return
    }

    const profileRes = await supabase.rpc('get_my_profile_rule')
    const currentProfile = Array.isArray(profileRes.data) ? profileRes.data[0] : profileRes.data
    setProfile(currentProfile || null)

    if (!currentProfile) {
      setBooting(false)
      return
    }

    if (currentProfile.role === 'teacher') {
      const [pending, scheduled, completed] = await Promise.all([
        supabase.rpc('list_teacher_pending_requests'),
        supabase.rpc('list_teacher_scheduled_meetings', { p_status: 'scheduled' }),
        supabase.rpc('list_teacher_scheduled_meetings', { p_status: 'completed' }),
      ])
      setPendingRows(pending.data || [])
      setScheduledRows(scheduled.data || [])
      setCompletedRows(completed.data || [])
    } else {
      const [picker, mine, directionStatus] = await Promise.all([
        supabase.rpc('list_profiles_for_picker'),
        supabase.rpc('list_my_meeting_requests'),
        supabase.rpc('get_my_direction_group_month_status', { p_target_month: currentMonthFirstDay() }),
      ])
      const pickerRows = picker.data || []
      setParticipants(pickerRows.filter((p: any) => p.id !== currentProfile.id))
      setStudentRequests(mine.data || [])

      const ds = Array.isArray(directionStatus.data) ? directionStatus.data[0] : directionStatus.data
      setDirectionMonthCompleted(!!ds?.completed)

      if (currentProfile.is_group_leader && currentProfile.leader_scope === 'direction_group') {
        setDirectionParticipants(pickerRows.filter((p: any) => p.id !== currentProfile.id && p.role !== 'teacher'))
      } else {
        setDirectionParticipants([])
      }
    }

    setBooting(false)
  }

  useEffect(() => { refreshAll() }, [])

  if (booting) {
    return <div className="screen"><div className="phone-shell"><Header title="组会小助手" /><Card><div className="muted center-pad">加载中...</div></Card></div></div>
  }
  if (!user || !profile) return <AuthView onDone={refreshAll} />
  if (profile.role === 'teacher') return <TeacherView pendingRows={pendingRows} scheduledRows={scheduledRows} completedRows={completedRows} refreshAll={refreshAll} />
  if (studentPage === 'apply') return <StudentApply profile={profile} participants={participants} onNavigate={setStudentPage} refreshAll={refreshAll} />
  if (studentPage === 'profile') return <StudentProfile profile={profile} onNavigate={setStudentPage} refreshAll={refreshAll} requests={studentRequests} directionMonthCompleted={directionMonthCompleted} />
  return (
    <StudentHome
      profile={profile}
      requests={studentRequests}
      directionMonthCompleted={directionMonthCompleted}
      directionCanEdit={!!(profile.is_group_leader && profile.leader_scope === 'direction_group')}
      directionParticipants={directionParticipants}
      refreshAll={refreshAll}
      onNavigate={setStudentPage}
    />
  )
}
