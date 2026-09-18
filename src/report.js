// Sinh trang HTML báo cáo kết quả batch (cùng phong cách với assets/splash.html)
// — hiển thị sau khi batch chạy thật xong, để xem thống kê/chi tiết mà không
// cần đọc lại console.
const fs = require('fs');
const path = require('path');

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** 1 dòng trong danh sách chi tiết — có link "Mở ticket" nếu có url. */
function renderRow(row) {
  const link = row.url
    ? `<a class="ticket-link" href="${escapeHtml(row.url)}" target="_blank" rel="noopener">Mở ticket &rarr;</a>`
    : '';
  const errorLine = row.error ? `<div class="row-error">${escapeHtml(row.error)}</div>` : '';
  return `
    <li class="row">
      <div class="row-main">
        <div class="row-summary">${escapeHtml(row.summary)}</div>
        ${errorLine}
      </div>
      ${link}
    </li>`;
}

function renderSection(title, tone, rows) {
  if (!rows || rows.length === 0) return '';
  return `
    <section class="section">
      <h2 class="section-title ${tone}">${escapeHtml(title)} <span class="count">${rows.length}</span></h2>
      <ul class="row-list">
        ${rows.map(renderRow).join('')}
      </ul>
    </section>`;
}

/**
 * @param {{phase: string, assignees: string[], results: {success: any[], failed: any[], ambiguous: any[]}, finishedAt: Date}} data
 */
function buildReportHtml(data) {
  const { phase, assignees, results, finishedAt } = data;
  const success = results.success || [];
  const failed = results.failed || [];
  const ambiguous = results.ambiguous || [];
  const total = success.length + failed.length + ambiguous.length;

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<title>Auto Submit Phase Blueprint — Báo cáo</title>
<style>
  :root {
    --ink: #eaf2ff;
    --sub: #9db4d9;
    --accent: #4fa6ff;
    --accent-2: #7c5cff;
    --line: rgba(140, 180, 255, 0.16);
    --ok: #34e28a;
    --err: #ff6b6b;
    --warn: #ffb84f;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    min-height: 100%;
    background: radial-gradient(1200px 800px at 15% 0%, #132349 0%, transparent 60%),
                radial-gradient(1000px 700px at 85% 100%, #1a1440 0%, transparent 55%),
                linear-gradient(160deg, #060a16 0%, #0a1226 45%, #0b1730 100%);
    color: var(--ink);
    font-family: "Segoe UI", "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  }
  .grid {
    position: fixed; inset: 0;
    background-image:
      linear-gradient(var(--line) 1px, transparent 1px),
      linear-gradient(90deg, var(--line) 1px, transparent 1px);
    background-size: 46px 46px;
    -webkit-mask-image: radial-gradient(1400px 900px at 50% 0%, black 30%, transparent 75%);
            mask-image: radial-gradient(1400px 900px at 50% 0%, black 30%, transparent 75%);
    opacity: 0.9;
    pointer-events: none;
  }

  .wrap { position: relative; max-width: 920px; margin: 0 auto; padding: 48px 28px 64px; }

  .top {
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;
    margin-bottom: 28px;
  }
  .badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 7px 16px 7px 10px; border-radius: 999px;
    background: rgba(79,166,255,0.12); border: 1px solid rgba(79,166,255,0.35);
    color: var(--accent); font-size: 12.5px; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600;
  }
  .badge .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 3px rgba(52,226,138,0.18); }
  .timestamp { font-size: 12.5px; color: var(--sub); }

  h1 {
    font-size: clamp(26px, 3.6vw, 34px);
    font-weight: 750; letter-spacing: -0.01em;
    background: linear-gradient(95deg, #ffffff 0%, #cfe0ff 42%, var(--accent) 78%, var(--accent-2) 100%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    margin-bottom: 8px;
  }
  .subtitle { color: var(--sub); font-size: 14px; margin-bottom: 30px; }
  .subtitle b { color: var(--ink); font-weight: 600; }

  .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 36px; }
  .stat {
    border-radius: 16px; padding: 20px 18px;
    background: linear-gradient(180deg, rgba(18,28,54,0.72), rgba(10,16,32,0.68));
    border: 1px solid rgba(150, 190, 255, 0.16);
    box-shadow: 0 20px 50px -20px rgba(0,0,0,0.55);
  }
  .stat .num { font-size: 34px; font-weight: 800; line-height: 1; margin-bottom: 6px; }
  .stat .label { font-size: 12.5px; color: var(--sub); letter-spacing: 0.03em; }
  .stat.ok .num { color: var(--ok); }
  .stat.err .num { color: var(--err); }
  .stat.warn .num { color: var(--warn); }

  .section { margin-bottom: 30px; }
  .section-title {
    font-size: 15px; font-weight: 700; margin-bottom: 12px;
    display: flex; align-items: center; gap: 10px;
  }
  .section-title.ok { color: var(--ok); }
  .section-title.err { color: var(--err); }
  .section-title.warn { color: var(--warn); }
  .section-title .count {
    font-size: 11.5px; font-weight: 700; color: var(--sub);
    background: rgba(255,255,255,0.06); border-radius: 999px; padding: 2px 9px;
  }

  .row-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .row {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 14px 16px; border-radius: 12px;
    background: rgba(18,28,54,0.55);
    border: 1px solid rgba(150, 190, 255, 0.12);
  }
  .row-main { min-width: 0; }
  .row-summary { font-size: 13.5px; color: var(--ink); word-break: break-word; }
  .row-error { font-size: 12.5px; color: var(--err); margin-top: 4px; word-break: break-word; }
  .ticket-link {
    flex: none; font-size: 12.5px; font-weight: 600; color: var(--accent); text-decoration: none;
    white-space: nowrap;
  }
  .ticket-link:hover { text-decoration: underline; }

  .empty {
    text-align: center; color: var(--sub); font-size: 14px;
    padding: 40px 0;
  }

  footer {
    margin-top: 40px; text-align: center;
    font-size: 12px; color: #6f84ad; letter-spacing: 0.03em;
  }
  footer b { color: #9fb6e6; font-weight: 600; }
</style>
</head>
<body>
  <div class="grid"></div>
  <div class="wrap">
    <div class="top">
      <span class="badge"><span class="dot"></span>Blueprint Automation</span>
      <span class="timestamp">Hoàn tất lúc ${escapeHtml(formatTimestamp(finishedAt))}</span>
    </div>

    <h1>Báo cáo kết quả Submit Phase</h1>
    <p class="subtitle">Phase = <b>${escapeHtml(phase)}</b> &middot; Assignee = <b>${escapeHtml((assignees || []).join(', '))}</b></p>

    <div class="stats">
      <div class="stat ok"><div class="num">${success.length}</div><div class="label">THÀNH CÔNG</div></div>
      <div class="stat err"><div class="num">${failed.length}</div><div class="label">LỖI</div></div>
      <div class="stat warn"><div class="num">${ambiguous.length}</div><div class="label">CẦN KIỂM TRA TAY</div></div>
    </div>

    ${total === 0 ? '<div class="empty">Không có ticket nào khớp Phase/Assignee này khi chạy.</div>' : ''}

    ${renderSection('Cần kiểm tra tay', 'warn', ambiguous)}
    ${renderSection('Lỗi', 'err', failed)}
    ${renderSection('Thành công', 'ok', success)}

    <footer>Copyright &copy; ${finishedAt.getFullYear()} by <b>Hempy</b></footer>
  </div>
</body>
</html>`;
}

/** Ghi file report vào thư mục reports/ (gitignored) — trả về đường dẫn tuyệt đối. */
function writeReportFile(html) {
  const dir = path.resolve(__dirname, '..', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'report-last.html');
  fs.writeFileSync(filePath, html, 'utf-8');
  return filePath;
}

module.exports = { buildReportHtml, writeReportFile };
