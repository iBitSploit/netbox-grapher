export default function GlobalStyle() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #0A0E14; }
    button, input, select { font: inherit; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    ::-webkit-scrollbar { width: 9px; height: 9px; }
    ::-webkit-scrollbar-thumb { background: #2A3644; border-radius: 5px; }
    input::placeholder { color: #5A6576; }
    select option { background: #141B25; color: #E4E8ED; }
  `}</style>
}
