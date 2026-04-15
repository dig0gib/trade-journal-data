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
function StatusBar({ status }) {
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
          미국장: <b style={{ color: market?.status === '위험' ? '#f87171' : '#9ca3af' }}>
            {market?.status || '—'}
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
  const userPos   = status?.user_positions   || []
  const enginePos = status?.positions        || []
  const bucketB   = status?.bucket_b_positions || []
  const trades    = status?.today_trades     || []

  // 실적 비교: 엔진 vs 사용자
  const enginePnl = trades.filter(t => t.type === 'SELL' && t.bucket !== 'bucket_b')
                          .reduce((s, t) => s + (t.pnl || 0), 0)
  const bucketBPnl = trades.filter(t => t.type === 'SELL' && t.bucket === 'bucket_b')
                           .reduce((s, t) => s + (t.pnl || 0), 0)

  return (
    <div style={{ padding: '20px 24px', maxWidth: 960, margin: '0 auto' }}>

      {/* 실적 비교 */}
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

      {/* 수동 포지션 (엔진이 모르는 것) */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          내 수동 매매 포지션 ({userPos.length}개)
          <span style={{ fontSize: 11, color: '#4b5563', marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
            — 엔진이 모르는 계좌 보유 종목
          </span>
        </div>
        {userPos.length === 0 ? (
          <div style={{ color: '#4b5563', fontSize: 13, padding: '12px 0' }}>수동 포지션 없음</div>
        ) : (
          userPos.map((p, i) => (
            <div key={i} style={styles.tradeRow}>
              <span style={{ color: '#c084fc', fontWeight: 700, flex: 1 }}>{p.name || p.code}</span>
              <span style={{ color: '#9ca3af', fontSize: 12 }}>평균 {p.avg_price?.toLocaleString()}원</span>
              <span style={{ color: '#9ca3af', fontSize: 12 }}>{p.qty}주</span>
              <span style={{ color: pnlColor(p.pnl), fontSize: 13, fontWeight: 600, minWidth: 120, textAlign: 'right' }}>
                {pnlSign(p.pnl)}{p.pnl?.toLocaleString()}원
                {p.pnl_pct != null && (
                  <span style={{ fontSize: 11, marginLeft: 4 }}>({pnlSign(p.pnl_pct)}{Number(p.pnl_pct).toFixed(2)}%)</span>
                )}
              </span>
            </div>
          ))
        )}
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

    import('lightweight-charts').then(({ createChart, ColorType }) => {
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
        timeScale: { borderColor: '#2a2a2a', timeVisible: true },
        width:  containerRef.current.clientWidth,
        height: height,
      })
      chartRef.current = chart

      // 캔들 시리즈
      const candleSeries = chart.addCandlestickSeries({
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

      // MA20 라인
      if (ma20?.length) {
        const maSeries = chart.addLineSeries({
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

      // 리사이즈 대응
      const ro = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth })
        }
      })
      ro.observe(containerRef.current)
      return () => ro.disconnect()
    })

    return () => {
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

  // 수업 탭 진입 시 lesson.json 로드
  useEffect(() => {
    if (tab !== 'lesson') return
    fetchLesson().then(setLesson)
  }, [tab])

  // 일지 목록
  useEffect(() => {
    if (tab !== 'journal') return
    fetchJournalList().then(list => {
      setJournals(list)
      setLoadingJ(false)
      if (list.length > 0 && !selected) handleSelect(list[0])
    })
  }, [tab])

  async function handleSelect(file) {
    setSelected(file.name)
    setContent('로딩중...')
    const text = await fetchJournalContent(file.download_url)
    setContent(text)
  }

  return (
    <div style={{ background: '#111', minHeight: '100vh', color: '#e2e8f0', fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif" }}>
      <StatusBar status={status} />

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

          {/* 오늘 매매 내역 */}
          <TodayTrades trades={status?.today_trades} />

          {/* 전략 설명 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>전략 이해하기 (주린이 가이드)</div>
            <div style={styles.guideBox}>
              <p><b style={{ color: '#facc15' }}>변동성 돌파 전략</b>이란?</p>
              <p>매일 아침 전날 가격 범위(고가-저가)의 일정 비율을 계산해서 <b>목표가</b>를 정해요.</p>
              <p>장중에 현재가가 목표가를 돌파하면 → <b style={{ color: '#60a5fa' }}>매수</b></p>
              <p>오후 3시 10분이 되면 → <b style={{ color: '#f87171' }}>자동 매도</b> (ETF 데이트레이딩)</p>
              <p style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>
                위 카드의 <b style={{ color: '#facc15' }}>노란선 숫자</b>가 오늘의 목표가예요. 현재가가 그 숫자를 넘으면 매수해요.
              </p>

              <div style={{ marginTop: 16, borderTop: '1px solid #2a2a2a', paddingTop: 14 }}>
                <p style={{ color: '#facc15', fontWeight: 700, marginBottom: 6 }}>❓ 자주 헷갈리는 것들</p>

                <p style={{ color: '#e2e8f0', marginBottom: 4 }}>
                  <b>Q. 현재가가 목표가보다 높은데 왜 손실이 나요?</b>
                </p>
                <p style={{ color: '#9ca3af', marginBottom: 12 }}>
                  목표가 = "이 가격 넘으면 매수!" 신호예요. 천장이 아니에요.<br/>
                  예) 목표가 91,000원 → 91,200원에 매수 → 오후에 90,500원으로 내려가면 손실.<br/>
                  레버리지 ETF는 변동성이 커서 오전에 치고 오후에 빠지는 경우가 많아요.
                </p>

                <p style={{ color: '#e2e8f0', marginBottom: 4 }}>
                  <b>Q. 목표 달성(돌파)이 3개인데 왜 손실 종목이 있어요?</b>
                </p>
                <p style={{ color: '#9ca3af', marginBottom: 12 }}>
                  목표가 돌파 = 매수 시점이에요. 그 이후 가격이 다시 내려가면 손실이에요.<br/>
                  '목표 달성'은 "오늘 신호가 발동됐다"는 뜻이지, "수익이 났다"는 뜻이 아니에요.<br/>
                  3시 10분에 강제 청산할 때 현재가가 매수가보다 낮으면 손실이 확정돼요.
                </p>

                <p style={{ color: '#e2e8f0', marginBottom: 4 }}>
                  <b>Q. "내 매매" 탭은 뭔가요?</b>
                </p>
                <p style={{ color: '#9ca3af' }}>
                  엔진이 자동으로 산 것 말고, 내가 직접 수동으로 산 종목들이 표시돼요.<br/>
                  "오늘의 수업" 추천 종목을 직접 매수했다면 거기서 확인할 수 있어요.
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
