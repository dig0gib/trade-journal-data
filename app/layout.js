export const metadata = {
  title: '매매일지',
  description: '자동매매 매매일지',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{
        margin: 0,
        fontFamily: "'Noto Sans KR', 'Malgun Gothic', sans-serif",
        background: '#0f0f0f',
        color: '#e0e0e0',
        minHeight: '100vh',
      }}>
        {children}
      </body>
    </html>
  )
}
