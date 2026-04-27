'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const OWNER = process.env.NEXT_PUBLIC_GITHUB_OWNER || 'dig0gib'
const REPO  = process.env.NEXT_PUBLIC_GITHUB_REPO  || 'trade-journal-data'
const RAW   = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main`
const API   = `https://api.github.com/repos/${OWNER}/${REPO}`

// ── 데이터 fetch ─────────────────────────────────────────
async function fetchStatus() {
  try {
    const res = await fetch(`${RAW}/logs/status.json`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

async function fetchTradeStats() {
  try {
    const res = await fetch(`${RAW}/logs/trades.jsonl`, { cache: 'no-store' })
    if (!res.ok) return null
    const text = await res.text()
    const lines = text.trim().split('\n').filter(Boolean)
    const sells = []
    const dailyMap = {}
    for (const line of lines) {
      try {
        const t = JSON.parse(line)
        if (t.type === 'SELL' && typeof t.pnl === 'number') {
          sells.push(t)
          const date = (t.dt || '').slice(0, 10)
          if (date) dailyMap[date] = (dailyMap[date] || 0) + t.pnl
        }
      } catch {}
    }
    const total = sells.reduce((s, t) => s + t.pnl, 0)
    const wins = sells.filter(t => t.pnl > 0)
    const losses = sells.filter(t => t.pnl <= 0)
    const winRate = sells.length ? wins.length / sells.length : 0
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0
    const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0
    const expectancy = winRate * avgWin + (1 - winRate) * avgLoss
    return { total, daily: dailyMap, winRate, avgWin, avgLoss, expectancy, tradeCount: sells.length }
  } catch { return null }
}

async function fetchLesson() {
  try {
    const res = await fetch(`${RAW}/logs/lesson.json`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

async function fetchJournalList() {
  try {
    const res = await fetch(`${API}/contents/logs/journal`, { cache: 'no-store' })
    if (!res.ok) return []
    const files = await res.json()
    return files
      .filter(f => f.name.endsWith('.txt'))
      .sort((a, b) => b.name.localeCompare(a.name))
  } catch { return [] }
}

async function fetchJournalContent(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    return res.text()
  } catch { return '내용을 불러올 수 없습니다.' }
}

// ── 색상 헬퍼 ────────────────────────────────────────────
function pnlColor(v) { return v > 0 ? '#4ade80' : v < 0 ? '#f87171' : '#9ca3af' }
function pnlSign(v) { return v > 0 ? '+' : '' }

// ── 컴포넌트: 헤더 상태바 ────────────────────────────────
function StatusBar({ status, totalPnl }) {
  if (!status) return (
    <div style={styles.header}>
      <span style={{ color: '#555' }}>데이터 로딩 중... (엔진이 꺼져 있거나 아직 push 전일 수 있어요)</span>
    </div>
  )
  const { updated_at, cash, vix, vix_status, market, regime, today_pnl } = status
  return (
    <div style={styles.header}>
      <div style={styles.headerLeft}>
        <span style={styles.logo}>📈 자동매매 대시보드</span>
        <span style={styles.headerBadge}>
          레짐: <b style={{ color: regime === 'bull' ? '#4ade80' : '#f87171' }}>
            {regime === 'bull' ? '강세장' : '약세장'}
          </b>
        </span>
        <span style={styles.headerBadge}>
          VIX: <b style={{ color: vix_status === '위험' ? '#f87171' : '#4ade80' }}>
            {typeof vix === 'number' ? vix.toFixed(1) : '—'} ({vix_status})
          </b>
        </span>
        <span style={styles.headerBadge}>
          S&P: <b style={{ color: market?.sp500_chg < 0 ? '#f87171' : '#4ade80' }}>
            {market?.sp500_chg != null ? `${market.sp500_chg >= 0 ? '+' : ''}${market.sp500_chg.toFixed(2)}%` : '—'}
          </b>
        </span>
        <span style={styles.headerBadge}>
          NQ: <b style={{ color: market?.nq_chg < 0 ? '#f87171' : '#4ade80' }}>
            {market?.nq_chg != null ? `${market.nq_chg >= 0 ? '+' : ''}${market.nq_chg.toFixed(2)}%` : '—'}
          </b>
        </span>
      </div>
      <div style={styles.headerRight}>
        <span style={styles.headerBadge}>
          잔고: <b style={{ color: '#e2e8f0' }}>{cash ? (cash).toLocaleString() + '원' : '—'}</b>
        </span>
        <span style={styles.headerBadge}>
          오늘 손익: <b style={{ color: pnlColor(today_pnl) }}>
            {pnlSign(today_pnl)}{(today_pnl || 0).toLocaleString()}원
          </b>
        </span>
        {totalPnl != null && (
          <span style={styles.headerBadge}>
            누적 손익: <b style={{ color: pnlColor(totalPnl) }}>
              {pnlSign(totalPnl)}{totalPnl.toLocaleString()}원
            </b>
          </span>
        )}
        <span style={{ fontSize: 11, color: '#4b5563' }}>갱신: {updated_at?.slice(11, 16) || '—'}</span>
      </div>
    </div>
  )
}

// ── 컴포넌트: ETF 카드 ────────────────────────────────────
function EtfCard({ item }) {
  const { name, code, price, target, prev_close, pct_to_target, holding, triggered } = item
  const progress = target && prev_close
    ? Math.min(100, Math.max(0, ((price - prev_close) / (target - prev_close)) * 100))
    : 0
  const reached = triggered || holding

  return (
    <div style={{
      ...styles.card,
      borderColor: holding ? '#4ade80' : triggered ? '#facc15' : '#2a2a2a',
      background: holding ? '#0f2a1a' : '#1a1a1a',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{name}</div>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{code}</div>
        </div>
        {holding && <span style={styles.badge('green')}>보유중</span>}
        {!holding && triggered && <span style={styles.badge('yellow')}>목표 돌파!</span>}
      </div>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <div>
          <div style={{ color: '#6b7280' }}>현재가</div>
          <div style={{ color: '#e2e8f0', fontSize: 15, fontWeight: 700, marginTop: 2 }}>
            {price ? price.toLocaleString() + '원' : '—'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#6b7280' }}>목표가 (변동성 돌파)</div>
          <div style={{ color: '#facc15', fontSize: 13, fontWeight: 600, marginTop: 2 }}>
            {target ? target.toLocaleString() + '원' : '—'}
          </div>
        </div>
      </div>

      {/* 진행률 바 */}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
          <span>전일종가 {prev_close ? prev_close.toLocaleString() : '—'}</span>
          <span style={{ color: reached ? '#4ade80' : '#9ca3af' }}>
            {reached ? '목표 도달!' : `목표까지 ${pct_to_target > 0 ? '+' : ''}${pct_to_target?.toFixed(2) || 0}%`}
          </span>
        </div>
        <div style={{ background: '#2a2a2a', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, progress)}%`,
            background: reached ? '#4ade80' : '#3b82f6',
            borderRadius: 4,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ fontSize: 10, color: '#4b5563', marginTop: 3, textAlign: 'right' }}>
          진행률 {progress.toFixed(0)}%
        </div>
      </div>
    </div>
  )
}

// ── 컴포넌트: 오늘 매매 내역 ─────────────────────────────
function TodayTrades({ trades }) {
  if (!trades || trades.length === 0) return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>오늘 매매 내역</div>
      <div style={{ color: '#4b5563', fontSize: 13, padding: '12px 0' }}>오늘 매매 없음</div>
    </div>
  )
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>오늘 매매 내역 ({trades.length}건)</div>
      {trades.map((t, i) => (
        <div key={i} style={styles.tradeRow}>
          <span style={{ color: t.type === 'BUY' ? '#60a5fa' : '#f87171', fontWeight: 700, fontSize: 12, minWidth: 34 }}>
            {t.type === 'BUY' ? '매수' : '매도'}
          </span>
          <span style={{ color: '#9ca3af', fontSize: 11, minWidth: 60 }}>
            {t.bucket === 'bucket_b' ? '📚B' : t.bucket === 'day' ? 'ETF' : 'SWING'}
          </span>
          <span style={{ color: '#e2e8f0', fontSize: 13, flex: 1 }}>{t.name}</span>
          <span style={{ color: '#9ca3af', fontSize: 12 }}>{t.price?.toLocaleString()}원 × {t.qty}주</span>
          {t.type === 'SELL' && (
            <span style={{ color: pnlColor(t.pnl), fontSize: 12, fontWeight: 600, minWidth: 80, textAlign: 'right' }}>
              {pnlSign(t.pnl)}{t.pnl?.toLocaleString()}원
            </span>
          )}
          {t.type === 'BUY' && (
            <span style={{ color: '#4b5563', fontSize: 11, minWidth: 80, textAlign: 'right' }}>
              {(t.amount)?.toLocaleString()}원
            </span>
          )}
          <span style={{ color: '#374151', fontSize: 11, minWidth: 40, textAlign: 'right' }}>
            {t.dt?.slice(11, 16)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── 컴포넌트: 내 매매 탭 ─────────────────────────────────
function MyTradeTab({ status }) {
  const enginePos = status?.positions        || []
  const bucketB   = status?.bucket_b_positions || []
  const trades    = status?.today_trades     || []

  const [manualPos, setManualPos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('manual_positions') || '[]') }
    catch { return [] }
  })
  const [form, setForm] = useState({ name: '', code: '', price: '', qty: '' })
  const [showForm, setShowForm] = useState(false)

  function saveManual(list) {
    setManualPos(list)
    localStorage.setItem('manual_positions', JSON.stringify(list))
  }

  function addPosition() {
    if (!form.name || !form.price || !form.qty) return
    saveManual([...manualPos, {
      id: Date.now(),
      name: form.name,
      code: form.code,
      avg_price: Number(form.price),
      qty: Number(form.qty),
      bought_at: new Date().toISOString().slice(0, 10),
    }])
    setForm({ name: '', code: '', price: '', qty: '' })
    setShowForm(false)
  }

  function removePosition(id) {
    saveManual(manualPos.filter(p => p.id !== id))
  }

  // 실적 비교: 엔진 vs 사용자
  const enginePnl = trades.filter(t => t.type === 'SELL' && t.bucket !== 'bucket_b')
                          .reduce((s, t) => s + (t.pnl || 0), 0)
  const bucketBPnl = trades.filter(t => t.type === 'SELL' && t.bucket === 'bucket_b')
                           .reduce((s, t) => s + (t.pnl || 0), 0)
  const manualCost = manualPos.reduce((s, p) => s + p.avg_price * p.qty, 0)

  return (
    <div style={{ padding: '20px 24px', maxWidth: 960, margin: '0 auto' }}>

      {/* 수동 매매 입력 */}
      <div style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={styles.sectionTitle}>✍️ 내 수동 매매 ({manualPos.length}건 · 투자금 {manualCost.toLocaleString()}원)</div>
          <button
            onClick={() => setShowForm(f => !f)}
            style={{ fontSize: 12, padding: '5px 14px', background: showForm ? '#1f2937' : '#1e3a5f', border: '1px solid #3b82f6', borderRadius: 6, color: '#93c5fd', cursor: 'pointer' }}
          >
            {showForm ? '취소' : '+ 종목 추가'}
          </button>
        </div>

        {showForm && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            {[
              { key: 'name', placeholder: '종목명 *', type: 'text' },
              { key: 'code', placeholder: '코드 (선택)', type: 'text' },
              { key: 'price', placeholder: '매수가 *', type: 'number' },
              { key: 'qty', placeholder: '수량 *', type: 'number' },
            ].map(({ key, placeholder, type }) => (
              <input
                key={key}
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={{ padding: '7px 10px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#e2e8f0', fontSize: 13, outline: 'none' }}
              />
            ))}
            <button
              onClick={addPosition}
              style={{ padding: '7px 16px', background: '#166534', border: 'none', borderRadius: 6, color: '#4ade80', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}
            >
              추가
            </button>
          </div>
        )}

        {manualPos.length === 0 ? (
          <div style={{ color: '#4b5563', fontSize: 13, padding: '12px 0' }}>
            수동 매매 없음 — 위 버튼으로 직접 매수한 종목 추가
          </div>
        ) : (
          manualPos.map(p => (
            <div key={p.id} style={{ ...styles.tradeRow, flexWrap: 'wrap' }}>
              <span style={{ color: '#c084fc', fontWeight: 700, flex: 1, minWidth: 100 }}>{p.name}</span>
              {p.code && <span style={{ color: '#4b5563', fontSize: 11 }}>{p.code}</span>}
              <span style={{ color: '#9ca3af', fontSize: 12 }}>평단 {p.avg_price.toLocaleString()}원</span>
              <span style={{ color: '#9ca3af', fontSize: 12 }}>{p.qty}주</span>
              <span style={{ color: '#6b7280', fontSize: 12 }}>투자 {(p.avg_price * p.qty).toLocaleString()}원</span>
              <span style={{ color: '#374151', fontSize: 11 }}>{p.bought_at}</span>
              <button
                onClick={() => removePosition(p.id)}
                style={{ padding: '2px 8px', background: 'transparent', border: '1px solid #374151', borderRadius: 4, color: '#6b7280', fontSize: 11, cursor: 'pointer' }}
              >
                삭제
              </button>
            </div>
          ))
        )}
      </div>

      {/* 오늘 실적 비교 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>오늘 실적 비교</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ ...styles.card, borderColor: '#1d4ed8' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>🤖 엔진 (ETF/SWING)</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: pnlColor(enginePnl) }}>
              {pnlSign(enginePnl)}{enginePnl.toLocaleString()}원
            </div>
            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
              {trades.filter(t => t.type === 'SELL' && t.bucket !== 'bucket_b').length}건 매도
            </div>
          </div>
          <div style={{ ...styles.card, borderColor: '#6b21a8' }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>📚 버킷B (수업 연동)</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: pnlColor(bucketBPnl) }}>
              {pnlSign(bucketBPnl)}{bucketBPnl.toLocaleString()}원
            </div>
            <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
              {trades.filter(t => t.type === 'SELL' && t.bucket === 'bucket_b').length}건 매도
            </div>
          </div>
        </div>
      </div>

      {/* 엔진 포지션 현황 */}
      {(enginePos.length > 0 || bucketB.length > 0) && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>엔진 보유 포지션</div>
          {[...enginePos, ...bucketB].map((p, i) => {
            const pnl = p.pnl ?? ((p.price - p.avg_price) * p.qty || 0)
            const pct = p.avg_price ? ((p.price - p.avg_price) / p.avg_price * 100) : 0
            return (
              <div key={i} style={styles.tradeRow}>
                <span style={{ color: '#e2e8f0', fontWeight: 700, flex: 1 }}>{p.name}</span>
                <span style={{ color: '#9ca3af', fontSize: 12 }}>평균 {p.avg_price?.toLocaleString()}원</span>
                <span style={{ color: '#9ca3af', fontSize: 12 }}>{p.qty}주</span>
                <span style={{ color: pnlColor(pnl), fontSize: 13, fontWeight: 600, minWidth: 120, textAlign: 'right' }}>
                  {pnlSign(pnl)}{pnl.toLocaleString()}원 ({pnlSign(pct)}{pct.toFixed(2)}%)
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 오늘 전체 매매 내역 */}
      <TodayTrades trades={trades} />
    </div>
  )
}

// ── 컴포넌트: 일별 손익 차트 ─────────────────────────────
function DailyPnlChart({ daily }) {
  if (!daily || Object.keys(daily).length === 0) return null
  const entries = Object.entries(daily).sort(([a], [b]) => a.localeCompare(b))
  const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 1)
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>일별 손익 추이</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130, padding: '0 4px' }}>
        {entries.map(([date, pnl]) => {
          const pct = Math.abs(pnl) / maxAbs
          const barH = Math.max(4, Math.round(pct * 90))
          const isPos = pnl >= 0
          return (
            <div key={date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 10, color: pnlColor(pnl), fontWeight: 700, whiteSpace: 'nowrap' }}>
                {isPos ? '+' : ''}{(pnl / 1000).toFixed(0)}K
              </div>
              <div style={{
                width: '100%',
                height: barH,
                background: isPos ? '#16a34a' : '#dc2626',
                borderRadius: '3px 3px 0 0',
                minHeight: 4,
              }} />
              <div style={{ fontSize: 10, color: '#4b5563', whiteSpace: 'nowrap' }}>
                {date.slice(5)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 컴포넌트: 매매 통계 카드 ─────────────────────────────
function StatsCard({ stats }) {
  if (!stats || !stats.tradeCount) return null
  const { winRate, avgWin, avgLoss, expectancy, tradeCount } = stats
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>매매 통계 ({tradeCount}건 기준)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: '승률', value: `${(winRate * 100).toFixed(0)}%`, color: winRate >= 0.5 ? '#4ade80' : '#f87171' },
          { label: '평균 수익', value: `+${Math.round(avgWin).toLocaleString()}원`, color: '#4ade80' },
          { label: '평균 손실', value: `${Math.round(avgLoss).toLocaleString()}원`, color: '#f87171' },
          { label: '기대값/건', value: `${expectancy >= 0 ? '+' : ''}${Math.round(expectancy).toLocaleString()}원`, color: pnlColor(expectancy) },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...styles.card, textAlign: 'center', padding: '12px 8px' }}>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#374151', marginTop: 8 }}>
        기대값 = 승률×평균수익 + (1-승률)×평균손실 | 양수면 장기 우상향 전략
      </div>
    </div>
  )
}

// ── 컴포넌트: 내일 예고 ───────────────────────────────────
function TomorrowSignals({ watchlist }) {
  if (!watchlist?.length) return null
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>📅 다음 거래일 예고 — 변동성 돌파 목표가</div>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 10 }}>
        아래 목표가를 다음 거래일 시초가 기준으로 돌파하면 자동 매수 신호 발동 (추정치, 시초가 미확정)
      </div>
      <div style={styles.grid}>
        {watchlist.map(item => (
          <div key={item.code} style={{ ...styles.card, borderColor: '#1e3a5f' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#93c5fd', marginBottom: 2 }}>{item.name}</div>
            <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 8 }}>{item.code}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <div>
                <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 2 }}>목표가 (추정)</div>
                <div style={{ color: '#facc15', fontWeight: 700, fontSize: 14 }}>
                  {item.target ? item.target.toLocaleString() + '원' : '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#6b7280', fontSize: 10, marginBottom: 2 }}>전일 종가</div>
                <div style={{ color: '#e2e8f0', fontSize: 13 }}>
                  {item.prev_close ? item.prev_close.toLocaleString() + '원' : '—'}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: '#374151' }}>
              목표가 돌파 시 → 자동 매수
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 컴포넌트: 캔들차트 (lightweight-charts) ──────────────
function CandleChart({ chartData, ma20, height = 220 }) {
  const containerRef = useRef(null)
  const chartRef     = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !chartData?.length) return

    // 이전 차트 정리
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    // Promise 외부에 선언해야 cleanup 함수에서 접근 가능
    let ro = null

    // lightweight-charts v5 API: addSeries(SeriesType, options)
    import('lightweight-charts').then(({ createChart, ColorType, CandlestickSeries, LineSeries }) => {
      if (!containerRef.current) return
      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#1a1a1a' },
          textColor: '#6b7280',
        },
        grid: {
          vertLines: { color: '#2a2a2a' },
          horzLines: { color: '#2a2a2a' },
        },
        rightPriceScale: { borderColor: '#2a2a2a' },
        timeScale: { borderColor: '#2a2a2a', timeVisible: false },
        width:  containerRef.current.clientWidth,
        height: height,
      })
      chartRef.current = chart

      // 캔들 시리즈 (v5: addSeries)
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor:   '#4ade80',
        downColor: '#f87171',
        borderUpColor:   '#4ade80',
        borderDownColor: '#f87171',
        wickUpColor:   '#4ade80',
        wickDownColor: '#f87171',
      })

      const candles = chartData
        .filter(b => b.open && b.high && b.low && b.close && b.date)
        .map(b => ({
          time:  b.date.slice(0, 4) + '-' + b.date.slice(4, 6) + '-' + b.date.slice(6, 8),
          open:  b.open,
          high:  b.high,
          low:   b.low,
          close: b.close,
        }))
        .sort((a, b) => a.time.localeCompare(b.time))

      candleSeries.setData(candles)

      // MA20 라인 (v5: addSeries)
      if (ma20?.length) {
        const maSeries = chart.addSeries(LineSeries, {
          color:     '#facc15',
          lineWidth: 1,
          priceLineVisible: false,
        })
        const maData = candles
          .map((c, i) => ma20[i] != null ? { time: c.time, value: ma20[i] } : null)
          .filter(Boolean)
        maSeries.setData(maData)
      }

      chart.timeScale().fitContent()

      // 리사이즈 대응 — ro를 외부 변수에 할당해야 React cleanup에서 해제 가능
      ro = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth })
        }
      })
      ro.observe(containerRef.current)
    })

    return () => {
      if (ro) ro.disconnect()
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [chartData, ma20, height])

  return <div ref={containerRef} style={{ width: '100%', height }} />
}

// ── 컴포넌트: 수업 종목 카드 ─────────────────────────────
function LessonPickCard({ pick }) {
  const [open, setOpen] = useState(false)
  const { name, code, reason, status, buy_condition, chart_data, ma20,
          momentum_20d, volume_ratio, target } = pick

  return (
    <div style={{
      ...styles.card,
      marginBottom: 16,
      borderColor: '#3b4a6b',
      background: '#0f1829',
    }}>
      {/* 헤더 */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#93c5fd' }}>{name}</div>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>{code}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#6b7280' }}>모멘텀 / 거래량</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: momentum_20d >= 0 ? '#4ade80' : '#f87171' }}>
            {momentum_20d >= 0 ? '+' : ''}{momentum_20d?.toFixed(1)}% / {volume_ratio?.toFixed(1)}x
          </div>
        </div>
      </div>

      {/* 요약 뱃지 */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={styles.infoBadge('blue')}>{status}</span>
        <span style={styles.infoBadge('gray')}>{reason}</span>
      </div>

      {/* 매수 조건 */}
      <div style={{ marginTop: 10, fontSize: 12, color: '#facc15' }}>
        💡 {buy_condition}
      </div>
      {target > 0 && (
        <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>
          변동성 돌파 목표가: {target.toLocaleString()}원
        </div>
      )}

      {/* 차트 토글 */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          marginTop: 12,
          padding: '4px 12px',
          fontSize: 12,
          background: 'transparent',
          border: '1px solid #2a3a5a',
          borderRadius: 4,
          color: '#60a5fa',
          cursor: 'pointer',
        }}
      >
        {open ? '차트 닫기 ▲' : '일봉 차트 보기 ▼'}
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: '#4b5563', marginBottom: 6 }}>
            노란선 = MA20 / 초록=양봉 / 빨강=음봉
          </div>
          <CandleChart chartData={chart_data} ma20={ma20} height={220} />
        </div>
      )}
    </div>
  )
}

// ── 컴포넌트: 수업 탭 전체 ───────────────────────────────
function LessonTab({ lesson }) {
  if (!lesson) return (
    <div style={{ padding: '40px 24px', color: '#4b5563', fontSize: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
      <div>아직 오늘의 수업이 없어요.</div>
      <div style={{ fontSize: 12, marginTop: 8, color: '#374151' }}>
        엔진이 오전 9시에 자동 생성합니다.
      </div>
    </div>
  )

  return (
    <div style={{ padding: '20px 24px', maxWidth: 960, margin: '0 auto' }}>

      {/* 날짜 + 오늘의 개념 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: '#4b5563', marginBottom: 4 }}>{lesson.date}</div>
        <div style={styles.sectionTitle}>오늘의 개념 — {lesson.lesson_title}</div>
        <div style={{
          background: '#111827',
          border: '1px solid #1e3a5f',
          borderRadius: 8,
          padding: '14px 18px',
          fontSize: 13,
          lineHeight: 2,
          color: '#9ca3af',
          whiteSpace: 'pre-wrap',
        }}>
          {lesson.lesson}
        </div>
      </div>

      {/* 추천 종목 */}
      <div>
        <div style={styles.sectionTitle}>
          오늘의 추천 종목 ({lesson.picks?.length || 0}개) — 버킷B 자동 편입
        </div>
        <div style={{ fontSize: 12, color: '#374151', marginBottom: 16 }}>
          ※ 소액(포지션 10%) 실전 학습용. VIX 게이트 없이 공격적으로 운영됩니다.
        </div>
        {lesson.picks?.map(pick => (
          <LessonPickCard key={pick.code} pick={pick} />
        ))}
      </div>

      {/* 일지 텍스트 */}
      {lesson.journal_text && (
        <div style={{ marginTop: 24 }}>
          <div style={styles.sectionTitle}>선생님의 한마디</div>
          <pre style={{
            ...styles.pre,
            background: '#0f1f0f',
            border: '1px solid #14532d',
            borderRadius: 8,
            padding: '16px 20px',
            fontSize: 12,
          }}>
            {lesson.journal_text}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────
export default function Home() {
  const [tab, setTab]         = useState('dashboard')  // 'dashboard' | 'lesson' | 'mytrade' | 'journal' | 'etf'
  const [status, setStatus]   = useState(null)
  const [lesson, setLesson]   = useState(null)
  const [journals, setJournals] = useState([])
  const [selected, setSelected] = useState(null)
  const [content, setContent] = useState('')
  const [loadingJ, setLoadingJ] = useState(true)
  const [tradeStats, setTradeStats] = useState(null)

  // status 주기 갱신
  const loadStatus = useCallback(async () => {
    const s = await fetchStatus()
    setStatus(s)
  }, [])

  useEffect(() => {
    loadStatus()
    const t = setInterval(loadStatus, 60_000)
    return () => clearInterval(t)
  }, [loadStatus])

  // 매매 통계 (최초 1회)
  useEffect(() => {
    fetchTradeStats().then(v => { if (v) setTradeStats(v) })
  }, [])

  // 수업 탭 진입 시 lesson.json 로드
  useEffect(() => {
    if (tab !== 'lesson') return
    fetchLesson().then(setLesson)
  }, [tab])

  const handleSelect = useCallback(async (file) => {
    setSelected(file.name)
    setContent('로딩중...')
    const text = await fetchJournalContent(file.download_url)
    setContent(text)
  }, [])

  // 일지 목록
  useEffect(() => {
    if (tab !== 'journal') return
    fetchJournalList().then(list => {
      setJournals(list)
      setLoadingJ(false)
      if (list.length > 0 && !selected) handleSelect(list[0])
    })
    // selected는 의도적으로 제외 — tab 전환 시 최초 1회만 자동 선택
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, handleSelect])

  return (
    <div style={{ background: '#111', minHeight: '100vh', color: '#e2e8f0', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}>
      <StatusBar status={status} totalPnl={tradeStats?.total} />

      {/* 탭 */}
      <div style={styles.tabBar}>
        <button style={styles.tab(tab === 'dashboard')} onClick={() => setTab('dashboard')}>대시보드</button>
        <button style={styles.tab(tab === 'lesson')}    onClick={() => setTab('lesson')}>📚 오늘의 수업</button>
        <button style={styles.tab(tab === 'mytrade')}   onClick={() => setTab('mytrade')}>내 매매</button>
        <button style={styles.tab(tab === 'journal')}   onClick={() => setTab('journal')}>매매일지</button>
        <button style={styles.tab(tab === 'etf')}       onClick={() => setTab('etf')}>📊 ETF 시그널</button>
      </div>

      {/* 대시보드 탭 */}
      {tab === 'dashboard' && (
        <div style={{ padding: '20px 24px', maxWidth: 960, margin: '0 auto' }}>

          {/* ETF 워치리스트 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>ETF 워치리스트 (버킷A)</div>
            <div style={styles.grid}>
              {status?.watchlist?.length
                ? status.watchlist.map(item => <EtfCard key={item.code} item={item} />)
                : <div style={{ color: '#4b5563', fontSize: 13 }}>데이터 없음 (엔진 실행 후 최대 5분 소요)</div>
              }
            </div>
          </div>

          {/* 버킷B 포지션 */}
          {status?.bucket_b_positions?.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>📚 버킷B — 개별주 단타 (수업 연동)</div>
              {status.bucket_b_positions.map((p, i) => (
                <div key={i} style={styles.tradeRow}>
                  <span style={{ color: '#93c5fd', fontWeight: 700, flex: 1 }}>{p.name}</span>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>평균 {p.avg_price?.toLocaleString()}원</span>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>{p.qty}주</span>
                  <span style={{ color: pnlColor(p.pnl), fontSize: 13, fontWeight: 600, minWidth: 100, textAlign: 'right' }}>
                    {pnlSign(p.pnl)}{p.pnl?.toLocaleString()}원
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 보유 포지션 (ETF/SWING) */}
          {status?.positions?.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>보유 포지션</div>
              {status.positions.map((p, i) => {
                const pnl = p.price && p.avg_price ? (p.price - p.avg_price) * p.qty : 0
                const pct = p.avg_price ? ((p.price - p.avg_price) / p.avg_price * 100) : 0
                return (
                  <div key={i} style={styles.tradeRow}>
                    <span style={{ color: '#e2e8f0', fontWeight: 700, flex: 1 }}>{p.name}</span>
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>평균 {p.avg_price?.toLocaleString()}원</span>
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>{p.qty}주</span>
                    <span style={{ color: pnlColor(pnl), fontSize: 13, fontWeight: 600, minWidth: 100, textAlign: 'right' }}>
                      {pnlSign(pnl)}{pnl.toLocaleString()}원 ({pnlSign(pct)}{pct.toFixed(2)}%)
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* 일별 손익 차트 + 통계 */}
          <DailyPnlChart daily={tradeStats?.daily} />
          <StatsCard stats={tradeStats} />

          {/* 내일 예고 */}
          <TomorrowSignals watchlist={status?.watchlist} />

          {/* 오늘 매매 내역 */}
          <TodayTrades trades={status?.today_trades} />

          {/* 전략 설명 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>전략 이해하기 — 오늘 매매로 배우는 변동성 돌파</div>
            <div style={styles.guideBox}>
              <p style={{ color: '#facc15', fontWeight: 700, marginBottom: 6 }}>📖 실제 매매로 이해하는 변동성 돌파 전략</p>

              <p style={{ marginBottom: 12 }}>
                <b style={{ color: '#e2e8f0' }}>① 목표가 계산 공식</b><br/>
                <span style={{ color: '#9ca3af' }}>
                  목표가 = 시초가 + (전날 고가 − 전날 저가) × 0.5<br/>
                  TIGER S&P500 예시: 시초가 25,700 + (25,770 − 25,330) × 0.5 = 목표가 25,925원<br/>
                  오늘 25,765원에 매수됐다는 건 이 목표가를 시초가 직후 돌파했단 뜻이에요.
                </span>
              </p>

              <p style={{ marginBottom: 12 }}>
                <b style={{ color: '#e2e8f0' }}>② 오늘 4개 ETF 결과가 다른 이유</b><br/>
                <span style={{ color: '#9ca3af' }}>
                  KODEX 레버리지(코스피200 2배): <span style={{ color: '#4ade80' }}>+175,000원 (+1.38%)</span><br/>
                  KODEX 코스닥150 레버리지: <span style={{ color: '#f87171' }}>-161,460원 (-1.60%)</span><br/>
                  → 코스피와 코스닥은 별개 시장이에요. 오늘 코스피는 강했고 코스닥은 약했어요.<br/>
                  레버리지 ETF는 기초지수를 2배로 추종하니까, 방향이 갈리면 결과 차이도 2배로 벌어져요.
                </span>
              </p>

              <p style={{ marginBottom: 12 }}>
                <b style={{ color: '#e2e8f0' }}>③ 왜 손실 나는 ETF도 같이 들고 가나요?</b><br/>
                <span style={{ color: '#9ca3af' }}>
                  오늘처럼 코스피는 오르고 코스닥은 빠지는 날, 코스닥만 있었다면 -161,460원 손실.<br/>
                  코스피도 함께 들고 있었기 때문에 +175,000원으로 상쇄돼서 실제 총 손익은 +15,360원.<br/>
                  분산투자 = 손실을 나눠 갖는 게 아니라, 어느 쪽이 올지 모를 때 리스크를 줄이는 것.
                </span>
              </p>

              <p style={{ marginBottom: 12 }}>
                <b style={{ color: '#e2e8f0' }}>④ 변동성 돌파의 핵심: 확률 게임</b><br/>
                <span style={{ color: '#9ca3af' }}>
                  오전에 강하게 치고 오른 날은 오후에도 유지되는 경향(추세 지속성)이 있어요.<br/>
                  이 경향이 매일 100% 맞지는 않아요. 하지만 장기적으로 승률이 50% 이상이면 돈이 쌓여요.<br/>
                  오늘 4개 중 2개 수익, 2개 손실이지만 총 +15,360원 → 전략이 작동한 날이에요.
                </span>
              </p>

              <div style={{ marginTop: 16, borderTop: '1px solid #2a2a2a', paddingTop: 14 }}>
                <p style={{ color: '#facc15', fontWeight: 700, marginBottom: 6 }}>❓ 자주 헷갈리는 것들</p>

                <p style={{ color: '#e2e8f0', marginBottom: 4 }}>
                  <b>Q. 현재가가 목표가보다 높은데 왜 손실이 나요?</b>
                </p>
                <p style={{ color: '#9ca3af', marginBottom: 12 }}>
                  목표가 = "이 가격 넘으면 매수!" 신호예요. 천장이 아니에요.<br/>
                  매수 후 가격이 더 오르면 수익, 내려가면 손실 — 목표가는 진입 신호일 뿐이에요.
                </p>

                <p style={{ color: '#e2e8f0', marginBottom: 4 }}>
                  <b>Q. 3시 10분에 무조건 팔아야 하나요?</b>
                </p>
                <p style={{ color: '#9ca3af', marginBottom: 12 }}>
                  레버리지 ETF는 매일 리밸런싱해요. 하룻밤 들고 있으면 복리 손실(변동성 손실)이 생겨요.<br/>
                  그래서 당일 안에 청산하는 게 원칙이에요. 시스템이 자동으로 3:10분에 팔아줘요.
                </p>

                <p style={{ color: '#e2e8f0', marginBottom: 4 }}>
                  <b>Q. "내 매매" 탭은 뭔가요?</b>
                </p>
                <p style={{ color: '#9ca3af' }}>
                  엔진이 자동으로 산 것 외에, 내가 직접 수동으로 매매한 종목이 표시돼요.<br/>
                  내일부터 직접 매매할 종목들을 여기서 추적할 수 있어요.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ETF 시그널 탭 */}
      {tab === 'etf' && (
        <iframe
          src="https://etf-signal-app-v3.vercel.app"
          style={{ width: '100%', height: 'calc(100vh - 110px)', border: 'none', display: 'block' }}
          title="ETF 시그널"
        />
      )}

      {/* 수업 탭 */}
      {tab === 'lesson' && <LessonTab lesson={lesson} />}

      {/* 내 매매 탭 */}
      {tab === 'mytrade' && <MyTradeTab status={status} />}

      {/* 일지 탭 */}
      {tab === 'journal' && (
        <div style={{ display: 'flex', height: 'calc(100vh - 110px)', overflow: 'hidden' }}>
          {/* 사이드바 */}
          <div style={styles.sidebar}>
            {loadingJ && <div style={{ padding: '12px 16px', color: '#555', fontSize: 13 }}>로딩중...</div>}
            {journals.map(file => {
              const date = file.name.replace('.txt', '')
              const isSel = selected === file.name
              return (
                <div key={file.name} onClick={() => handleSelect(file)} style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  background: isSel ? '#1e2a1e' : 'transparent',
                  borderLeft: isSel ? '3px solid #4ade80' : '3px solid transparent',
                  fontSize: 13,
                  color: isSel ? '#e2e8f0' : '#6b7280',
                  transition: 'all 0.15s',
                }}>
                  {date}
                </div>
              )
            })}
            {!loadingJ && journals.length === 0 && (
              <div style={{ padding: '12px 16px', color: '#555', fontSize: 13 }}>일지 없음</div>
            )}
          </div>

          {/* 일지 본문 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
            <pre style={styles.pre}>
              {content || (selected ? '' : '← 날짜를 선택하세요')}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 스타일 ───────────────────────────────────────────────
const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    background: '#161616',
    borderBottom: '1px solid #2a2a2a',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  logo: { fontSize: 16, fontWeight: 800, color: '#4ade80', marginRight: 8 },
  headerBadge: { fontSize: 12, color: '#9ca3af' },
  tabBar: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid #2a2a2a',
    background: '#161616',
    padding: '0 24px',
  },
  tab: (active) => ({
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: active ? 700 : 400,
    color: active ? '#4ade80' : '#6b7280',
    background: 'transparent',
    border: 'none',
    borderBottom: active ? '2px solid #4ade80' : '2px solid transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    borderBottom: '1px solid #1f1f1f',
    paddingBottom: 8,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 12,
  },
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    padding: '14px 16px',
    transition: 'border-color 0.2s',
  },
  badge: (color) => ({
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    background: color === 'green' ? '#14532d' : '#713f12',
    color: color === 'green' ? '#4ade80' : '#facc15',
  }),
  infoBadge: (color) => ({
    fontSize: 11,
    padding: '2px 10px',
    borderRadius: 20,
    background: color === 'blue' ? '#1e3a5f' : '#1f2937',
    color: color === 'blue' ? '#93c5fd' : '#9ca3af',
  }),
  tradeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 0',
    borderBottom: '1px solid #1f1f1f',
  },
  guideBox: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: '16px 20px',
    fontSize: 13,
    lineHeight: 1.8,
    color: '#9ca3af',
  },
  sidebar: {
    width: 180,
    background: '#161616',
    borderRight: '1px solid #2a2a2a',
    overflowY: 'auto',
    flexShrink: 0,
    paddingTop: 8,
  },
  pre: {
    fontFamily: "'D2Coding', 'Consolas', monospace",
    fontSize: 13,
    lineHeight: 1.8,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: '#d4d4d4',
    margin: 0,
  },
}
