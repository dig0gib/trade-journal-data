'use client'
import { useState, useEffect, useCallback } from 'react'

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

// ── 메인 ─────────────────────────────────────────────────
export default function Home() {
  const [tab, setTab]         = useState('dashboard')  // 'dashboard' | 'journal'
  const [status, setStatus]   = useState(null)
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
    const t = setInterval(loadStatus, 60_000)  // 1분마다 갱신
    return () => clearInterval(t)
  }, [loadStatus])

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
        <button style={styles.tab(tab === 'journal')} onClick={() => setTab('journal')}>매매일지</button>
      </div>

      {/* 대시보드 탭 */}
      {tab === 'dashboard' && (
        <div style={{ padding: '20px 24px', maxWidth: 960, margin: '0 auto' }}>

          {/* ETF 워치리스트 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>ETF 워치리스트</div>
            <div style={styles.grid}>
              {status?.watchlist?.length
                ? status.watchlist.map(item => <EtfCard key={item.code} item={item} />)
                : <div style={{ color: '#4b5563', fontSize: 13 }}>데이터 없음 (엔진 실행 후 최대 5분 소요)</div>
              }
            </div>
          </div>

          {/* 보유 포지션 */}
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
                위 차트의 <b style={{ color: '#facc15' }}>노란선</b>이 오늘의 목표가예요. 현재가가 그 선을 넘으면 매수해요.
              </p>
            </div>
          </div>
        </div>
      )}

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
