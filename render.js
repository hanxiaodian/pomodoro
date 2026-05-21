// 引入 Electron 的 ipcRenderer 模块，用于从渲染进程向主进程发送消息（如触发系统通知）
const { ipcRenderer } = require('electron')

// ─── 常量配置 ───────────────────────────────────────────────────────────────

// 必须与 index.html 中 SVG circle 的 r 属性保持一致
const RING_RADIUS = 110

// 每种模式对应的强调色（进度环、模式标签）和顶部标签文字
// 背景统一为暖白 #F7F2EC，通过环色区分模式：
//   专注 → 主色砖红 #C65A4A
//   短休 → 弱化暖灰 #D9D2CC
//   长休 → 文本深棕 #6F655E
const THEMES = {
  work:        { accent: '#C65A4A', label: '专注工作 🍅' },
  short_break: { accent: '#D9D2CC', label: '短暂休息 🌿' },
  long_break:  { accent: '#6F655E', label: '长时休息 ☕' }
}

// 每种模式的倒计时总秒数
const DURATIONS = {
  work:        25 * 60,
  short_break:  5 * 60,
  long_break:  15 * 60
}

// SVG 进度环的周长，用于将剩余时间比例转换为 stroke-dashoffset
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

// ─── 运行时状态 ──────────────────────────────────────────────────────────────

let mode      = 'work'
let timeLeft  = DURATIONS.work
let pomodoros = 0
let ticker    = null  // null = 已停止；非 null = 运行中的 setInterval ID
let tickOrigin = null // { at: Date.now(), left: timeLeft }，每次启动/恢复时记录，用挂钟计算真实剩余时间

// ─── DOM 元素引用 ────────────────────────────────────────────────────────────

const ringProgress = document.getElementById('ring-progress')
const timeDisplay  = document.getElementById('time-display')
const modeLabel    = document.getElementById('mode-label')
const startBtn     = document.getElementById('start-btn')
const countLabel   = document.getElementById('count-label')
const dots         = document.querySelectorAll('#dots span')

// ─── 工具函数 ────────────────────────────────────────────────────────────────

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ─── 计时控制 ────────────────────────────────────────────────────────────────

// 统一的停止入口，清除定时器并将 ticker 置 null（作为"已停止"的唯一信号）
function stop() {
  clearInterval(ticker)
  ticker = null
}

/**
 * 开始 / 暂停切换
 */
function toggle() {
  if (ticker) {
    stop()
  } else {
    // 记录本次启动时的挂钟时间和剩余秒数，tick() 据此计算真实流逝时间
    tickOrigin = { at: Date.now(), left: timeLeft }
    ticker = setInterval(tick, 1000)
  }
  render()
}

/**
 * 每秒回调：用 Date.now() 与 tickOrigin 的差值计算剩余时间。
 * 即使 setInterval 被系统延迟触发（如窗口切走后节流），
 * 显示的时间依然基于真实流逝秒数，不会因 tick 丢失而滞后。
 */
function tick() {
  const elapsed = Math.floor((Date.now() - tickOrigin.at) / 1000)
  timeLeft = Math.max(0, tickOrigin.left - elapsed)

  if (timeLeft > 0) {
    timeDisplay.textContent = fmt(timeLeft)
    ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - timeLeft / DURATIONS[mode])
  } else {
    stop()
    sessionDone()
  }
}

// ─── 渲染函数 ────────────────────────────────────────────────────────────────

/**
 * 将全部状态同步到界面，包含主题切换。
 * 合并了原来的 applyTheme()，调用方无需分别调用两者。
 * tick() 中不调用此函数，改用内联的局部更新以减少每秒多余的 DOM 写入。
 */
function render() {
  const { accent, label } = THEMES[mode]

  // 主题：进度环颜色、模式标签颜色与文字
  ringProgress.style.stroke = accent
  modeLabel.style.color     = accent
  modeLabel.textContent     = label

  // 时间与进度环
  timeDisplay.textContent = fmt(timeLeft)
  ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - timeLeft / DURATIONS[mode])

  // 按钮文字（ticker 不为 null 则正在运行）
  startBtn.textContent = ticker ? '暂停' : '开始'

  // 圆点：已完成的用强调色实心，未完成的用弱化灰空心
  const idx = pomodoros % 4
  dots.forEach((d, i) => {
    d.textContent = i < idx ? '●' : '○'
    d.style.color = i < idx ? accent : '#D9D2CC'
  })

  // 分钟数从 DURATIONS 推导，与专注时长配置保持一致
  countLabel.textContent = `今日完成：${pomodoros} 个番茄（${pomodoros * (DURATIONS.work / 60)} 分钟）`
}

// ─── 会话流转 ────────────────────────────────────────────────────────────────

/**
 * 当前会话自然结束或被跳过时调用，按"每 4 个番茄触发长休息"的规则切换下一模式
 */
function sessionDone() {
  if (mode === 'work') {
    pomodoros++
    if (pomodoros % 4 === 0) {
      mode     = 'long_break'
      timeLeft = DURATIONS.long_break
      notify('专注结束！', `完成 4 个番茄，长时休息开始 ☕`)
    } else {
      mode     = 'short_break'
      timeLeft = DURATIONS.short_break
      notify('专注结束！', '休息 5 分钟 🌿')
    }
  } else {
    mode     = 'work'
    timeLeft = DURATIONS.work
    notify('休息结束！', '开始新一轮专注 🍅')
  }
  render()
}

function reset() {
  stop()
  timeLeft = DURATIONS[mode]
  render()
}

function skip() {
  stop()
  sessionDone()
}

// ─── 通知 ────────────────────────────────────────────────────────────────────

function notify(title, body) {
  ipcRenderer.send('notify', title, body)
}

// ─── 初始化 ──────────────────────────────────────────────────────────────────

ringProgress.style.strokeDasharray = CIRCUMFERENCE
render()
