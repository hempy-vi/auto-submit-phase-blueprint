// Điều phối vòng lặp: tìm ticket theo Phase + Assignee, Submit từng cái một
// cho tới khi hết — xem WORKFLOW.md phần "Luồng thao tác".
const blueprint = require('./blueprintActions');
const { getSubmitContentForPhase } = require('./config');

const UNREADABLE_SUMMARY = '(không đọc được tóm tắt dòng)';
// Backstop chung: dừng hẳn sau ngần này lần lỗi LIÊN TIẾP dù KHÔNG phải cùng
// 1 ticket — chặn trường hợp 2+ ticket khác nhau lỗi luân phiên (A lỗi → B
// lỗi → A lại lỗi → ...) mà guard "cùng 1 ticket lặp lại" (dựa vào so khớp
// summary) không bao giờ tự phát hiện được vì mỗi lần so sánh chỉ nhớ đúng 1
// lần lỗi gần nhất.
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * @param {import('playwright').Page} page trang danh sách Requirement (tab chính, giữ nguyên suốt batch)
 * @param {{phase: string, assignees: string[], dryRun?: boolean, maxTickets?: number}} options
 */
async function runBatch(page, options) {
  const { displayName, content } = getSubmitContentForPhase(options.phase);
  const assignees = options.assignees;

  await blueprint.selectProject(page);
  await blueprint.enableAdvanceSearch(page);
  await blueprint.selectPhase(page, displayName);
  for (const name of assignees) {
    await blueprint.selectAssignee(page, name);
  }
  await blueprint.clickSearch(page);

  const results = { success: [], failed: [], ambiguous: [] };
  const maxTickets = Number.isFinite(options.maxTickets) ? options.maxTickets : Infinity;
  let round = 0;
  // Chữ ký (toàn bộ chuỗi summary, KHÔNG chỉ mã ticket) của lần ticket lỗi
  // gần nhất — dùng để phát hiện "vẫn là ticket/dòng đó" ở vòng kế tiếp. Khởi
  // tạo `null` (khác hẳn mọi summary/placeholder thật) để không bị hiểu nhầm
  // là "trùng" ngay ở lần thử đầu tiên.
  let lastFailedSummary = null;
  let consecutiveFailures = 0;

  try {
    for (;;) {
      round += 1;
      let count = await blueprint.getResultRowCount(page);
      if (count === 0) {
        // Xác nhận lại 1 lần nữa sau khi chờ thêm — tránh kết luận "hết ticket"
        // nhầm ngay lúc grid vừa search xong, chưa kịp render hết.
        await page.waitForTimeout(1500);
        count = await blueprint.getResultRowCount(page);
      }
      console.log(`[vòng ${round}] còn ${count} ticket khớp Phase="${displayName}" + Assignee=[${assignees.join(', ')}]`);

      if (count === 0) break;
      if (results.success.length + results.failed.length >= maxTickets) {
        console.log(`Đã đạt giới hạn --max ${maxTickets}, dừng lại (còn ${count} ticket chưa xử lý).`);
        break;
      }

      if (options.dryRun) {
        const summary = await blueprint.getFirstRowSummary(page);
        console.log(`(--dry-run) Ticket đầu tiên sẽ xử lý: ${summary}`);
        console.log('(--dry-run) Dừng lại tại đây, KHÔNG Submit thật. Bỏ --dry-run để chạy thật.');
        break;
      }

      let detailPage = null;
      let summary;
      try {
        summary = await blueprint.getFirstRowSummary(page);
      } catch {
        summary = UNREADABLE_SUMMARY;
      }
      if (!summary) summary = '(dòng trống)';

      // So khớp CẢ CHUỖI summary (không chỉ mã ticket) — kể cả khi không đọc
      // được summary thật (rơi về placeholder cố định), 2 lần đọc-lỗi LIÊN
      // TIẾP vẫn tạo ra cùng 1 chữ ký, nên vẫn phát hiện được "kẹt" thay vì
      // vô hiệu hoá guard này (khác bản trước: dùng `ticketId && ticketId ===`
      // khiến guard tắt hẳn mỗi khi không tách được mã ticket).
      if (summary === lastFailedSummary) {
        console.error(
          `Dòng kết quả đầu tiên vẫn giống hệt lần lỗi trước ("${summary}") — ` +
            'dừng batch tại đây để tránh lặp vô hạn, cần kiểm tra tay.'
        );
        break;
      }

      try {
        detailPage = await blueprint.openFirstResultInNewTab(page);
        const url = detailPage.url();
        await blueprint.submitPhase(detailPage, content);
        results.success.push({ summary, url });
        lastFailedSummary = null;
        consecutiveFailures = 0;
        console.log(`OK (${content}): ${summary} -> ${url}`);
      } catch (err) {
        if (err.okClickedButNotConfirmedClosed) {
          // Đã bấm OK thật — có thể ticket đã Submit thành công server-side dù
          // tab chưa kịp tự đóng. KHÔNG đóng tab (để tự xem), KHÔNG tiếp tục
          // vòng lặp (tránh Submit lần 2 lên đúng ticket này).
          results.ambiguous.push({ summary, url: detailPage ? detailPage.url() : null, error: err.message });
          console.error(
            `CẦN KIỂM TRA TAY: ${summary} -> đã bấm OK nhưng tab không tự đóng trong thời gian chờ ` +
              `(${err.message}). Không tự đóng tab để bạn tự xem trên trình duyệt — dừng batch tại đây.`
          );
          break;
        }

        results.failed.push({ summary, error: err.message });
        lastFailedSummary = summary;
        consecutiveFailures += 1;
        console.error(`LỖI: ${summary} -> ${err.message}`);
        if (detailPage && !detailPage.isClosed()) {
          await detailPage.close().catch(() => {});
        }
        if (page.isClosed()) {
          console.error('Trình duyệt/tab chính đã bị đóng — dừng batch tại đây.');
          break;
        }
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.error(
            `Đã lỗi ${consecutiveFailures} lần liên tiếp (không nhất thiết cùng 1 ticket) — ` +
              'dừng batch tại đây để tránh lặp vô hạn giữa nhiều ticket lỗi luân phiên, cần kiểm tra tay.'
          );
          break;
        }
      }

      // Bấm lại Search để danh sách tự cập nhật (ticket vừa xử lý xong sẽ biến
      // mất khỏi kết quả vì đã đổi Phase, không còn khớp filter nữa).
      await blueprint.clickSearch(page);
    }
  } catch (err) {
    // Lỗi ngoài ý muốn ở chính bước search/đếm (không phải lỗi của 1 ticket cụ
    // thể) — dừng batch nhưng vẫn trả về kết quả đã tích luỹ được, để
    // printSummary không bị mất trắng.
    console.error(`LỖI không lường trước, dừng batch tại đây: ${err.message}`);
  }

  return results;
}

function printSummary(results) {
  console.log('\n===== TỔNG KẾT =====');
  console.log(`Thành công: ${results.success.length}`);
  results.success.forEach((r) => console.log(`  - ${r.summary} -> ${r.url}`));
  console.log(`Lỗi: ${results.failed.length}`);
  results.failed.forEach((r) => console.log(`  - ${r.summary}: ${r.error}`));
  if (results.ambiguous && results.ambiguous.length > 0) {
    console.log(`Cần kiểm tra tay: ${results.ambiguous.length}`);
    results.ambiguous.forEach((r) => console.log(`  - ${r.summary} -> ${r.url || '(không rõ URL)'}: ${r.error}`));
  }
}

module.exports = { runBatch, printSummary };
