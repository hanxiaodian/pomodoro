// 引入 Electron 的 ipcRenderer 模块，用于从渲染进程向主进程发送消息（如触发系统通知）
const { ipcRenderer } = require('electron')

// ─── 常量配置 ───────────────────────────────────────────────────────────────

// 必须与 index.html 中 SVG circle 的 r 属性保持一致
const RING_RADIUS = 110

// 每种模式对应的强调色和顶部印章文字
// 背景统一为宣纸米黄 #EDE3CD，通过 --accent CSS 变量切换模式色：
//   專注 → 朱砂红 #A93226
//   小憩 → 竹青  #6B8E7F
//   久憩 → 黛蓝  #2C5F7C
const THEMES = {
  work:        { accent: '#A93226', label: '專注' },
  short_break: { accent: '#6B8E7F', label: '小憩' },
  long_break:  { accent: '#2C5F7C', label: '久憩' }
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

  // 通过 CSS 变量统一驱动所有强调色元素（印章边框、按钮、进度环）
  document.documentElement.style.setProperty('--accent', accent)

  modeLabel.textContent = label

  // 时间与进度环
  timeDisplay.textContent = fmt(timeLeft)
  ringProgress.style.stroke = accent
  ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - timeLeft / DURATIONS[mode])

  // 按钮文字（ticker 不为 null 则正在运行）
  startBtn.textContent = ticker ? '暂停' : '开始'

  // 圆点：已完成的填朱砂实心方印，未完成的为远墨空框
  const idx = pomodoros % 4
  dots.forEach((d, i) => {
    if (i < idx) {
      d.style.background   = accent
      d.style.borderColor  = accent
    } else {
      d.style.background   = 'transparent'
      d.style.borderColor  = '#A89E8E'
    }
  })

  // 中式排版：全角间距 + 间隔点
  countLabel.textContent = `今日　${pomodoros}　颗番茄　·　${pomodoros * (DURATIONS.work / 60)}　分钟`
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
      notify('一炷香尽', '已成四颗番茄，且久憩片刻')
    } else {
      mode     = 'short_break'
      timeLeft = DURATIONS.short_break
      notify('一炷香尽', '小憩五分钟，再行启程')
    }
  } else {
    mode     = 'work'
    timeLeft = DURATIONS.work
    notify('憩毕', '复入专注，凝神再战')
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
