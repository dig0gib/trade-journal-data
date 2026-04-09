'use client'
import { useState, useEffect } from 'react'

const GITHUB_OWNER = process.env.NEXT_PUBLIC_GITHUB_OWNER || ''
const GITHUB_REPO  = process.env.NEXT_PUBLIC_GITHUB_REPO  || ''
const GITHUB_PATH  = 'logs/journal'

async function fetchJournalList() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}`
  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) return []
  const files = await res.json()
  return files
    .filter(f => f.name.endsWith('.txt'))
    .sort((a, b) => b.name.localeCompare(a.name))
}

async function fetchJournalContent(downloadUrl) {
  const res = await fetch(downloadUrl)
  return res.text()
}

export default function Home() {
  const [journals, setJournals] = useState([])
  const [selected, setSelected] = useState(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchJournalList().then(list => {
      setJournals(list)
      setLoading(false)
      if (list.length > 0) handleSelect(list[0])
    })
  }, [])

  async function handleSelect(file) {
    setSelected(file.name)
    setContent('로딩중...')
    const text = await fetchJournalContent(file.download_url)
    setContent(text)
  }

  const totalPnl = 0 // 추후 trades.jsonl 파싱으로 계산 가능

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 사이드바 */}
      <div style={{
        width: 200,
        background: '#1a1a1a',
        borderRight: '1px solid #2a2a2a',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        <div style={{
          padding: '20px 16px 12px',
          borderBottom: '1px solid #2a2a2a',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>📈 매매일지</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>자동매매 기록</div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
          {loading && <div style={{ padding: '12px 16px', color: '#555', fontSize: 13 }}>로딩중...</div>}
          {journals.map(file => {
            const date = file.name.replace('.txt', '')
            const isSelected = selected === file.name
            return (
              <div
                key={file.name}
                onClick={() => handleSelect(file)}
                style={{
                  padding: '10px 16px',
                  cursor: 'pointer',
                  background: isSelected ? '#2a2a2a' : 'transparent',
                  borderLeft: isSelected ? '3px solid #4ade80' : '3px solid transparent',
                  fontSize: 13,
                  color: isSelected ? '#fff' : '#999',
                  transition: 'all 0.15s',
                }}
              >
                {date}
              </div>
            )
          })}
          {!loading && journals.length === 0 && (
            <div style={{ padding: '12px 16px', color: '#555', fontSize: 13 }}>
              일지 없음
            </div>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 헤더 */}
        <div style={{
          padding: '16px 24px',
          background: '#1a1a1a',
          borderBottom: '1px solid #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 15 }}>
            {selected ? selected.replace('.txt', '') : '날짜를 선택하세요'}
          </span>
        </div>

        {/* 내용 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 32px',
        }}>
          <pre style={{
            fontFamily: "'D2Coding', 'Consolas', monospace",
            fontSize: 13,
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: '#d4d4d4',
            margin: 0,
          }}>
            {content || (selected ? '' : '← 왼쪽에서 날짜를 선택하세요')}
          </pre>
        </div>
      </div>
    </div>
  )
}
