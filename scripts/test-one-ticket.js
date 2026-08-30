// Test THẬT trên đúng 1 ticket (có Submit/OK thật) — dùng để xác nhận popup
// #txtSubmit/#btnOK khớp đúng thật trước khi tin tưởng chạy `node index.js`
// cho cả batch nhiều ticket.
//
// ⚠️ AN TOÀN: mặc định CHỈ chạy tới bước mở ticket + bấm Submit + điền nội
// dung, DỪNG LẠI TRƯỚC khi bấm OK (để người dùng tự xem qua rồi tự bấm OK
// thật trên trình duyệt nếu muốn, hoặc tự đóng popup nếu selector sai). Phải
// set biến môi trường CONFIRM=yes thì script mới tự bấm OK thật.
//
// Cách chạy (chỉ mở + điền, KHÔNG bấm OK):
//   node scripts/test-one-ticket.js --phase Confirmation --assignee "<Tên Assignee>"
// Cách chạy THẬT (tự bấm OK luôn):
//   CONFIRM=yes node scripts/test-one-ticket.js --phase Confirmation --assignee "<Tên Assignee>"
require('../src/loadEnv').loadEnv();
const { chromium } = require('playwright');
const blueprint = require('../src/blueprintActions');
const { getCredentials, getDefaultAssignees, getDefaultPhase, getSubmitContentForPhase } = require('../src/config');
const { parseCommonArgs } = require('../src/cliArgs');

async function main() {
  const args = parseCommonArgs(process.argv.slice(2));
  if (!args.phase) args.phase = getDefaultPhase();
  if (args.assignees.length === 0) args.assignees = getDefaultAssignees();
  if (!args.phase || args.assignees.length === 0) {
    console.error(
      'Cần --phase và --assignee (hoặc set BLUEPRINT_PHASE/BLUEPRINT_FULL_NAME trong .env). Ví dụ: ' +
        'node scripts/test-one-ticket.js --phase Confirmation --assignee "<Tên Assignee>"'
    );
    process.exitCode = 1;
    return;
  }
  const { displayName, content } = getSubmitContentForPhase(args.phase);

  const browser = await chromium.launch({ headless: false, slowMo: 100, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  let detailPage = null;
  let holdBrowserOpen = false;
  try {
    await blueprint.login(page, getCredentials());
    await blueprint.gotoRequirementList(page);
    await blueprint.selectProject(page);
    await blueprint.enableAdvanceSearch(page);
    await blueprint.selectPhase(page, displayName);
    for (const name of args.assignees) {
      await blueprint.selectAssignee(page, name);
    }
    await blueprint.clickSearch(page);

    const count = await blueprint.getResultRowCount(page);
    console.log(`Tìm được ${count} ticket khớp.`);
    if (count === 0) {
      console.log('Không có ticket nào để test, dừng lại.');
      return;
    }
    const summary = await blueprint.getFirstRowSummary(page);
    console.log(`Sẽ mở ticket: ${summary}`);

    detailPage = await blueprint.openFirstResultInNewTab(page);
    console.log('Đã mở tab Detail:', detailPage.url());

    await blueprint.openSubmitForm(detailPage, content);
    console.log(`Đã bấm Submit và điền nội dung: "${content}"`);

    await detailPage.screenshot({ path: 'test-one-ticket-before-ok.png' }).catch(() => {});
    console.log('Đã lưu ảnh: test-one-ticket-before-ok.png — kiểm tra lại ảnh trước khi tin tưởng.');

    if (process.env.CONFIRM === 'yes') {
      console.log('Đã bấm OK (CONFIRM=yes) — chờ tab tự đóng...');
      await blueprint.confirmSubmit(detailPage);
      console.log('Tab đã tự đóng — Submit thật thành công.');
    } else {
      console.log('\n(CONFIRM khác "yes") DỪNG LẠI TRƯỚC khi bấm OK — tự kiểm tra trên trình duyệt rồi đóng tay.');
      console.log('Muốn tool tự bấm OK thật, chạy lại với CONFIRM=yes ở đầu dòng lệnh.');
      holdBrowserOpen = true;
      await new Promise(() => {}); // giữ browser mở để người dùng tự xem, Ctrl+C để thoát
    }
  } catch (err) {
    if (err.okClickedButNotConfirmedClosed) {
      console.error(
        `Đã bấm OK thật nhưng tab không tự đóng trong thời gian chờ (${err.message}) — ` +
          'KHÔNG tự đóng tab, tự kiểm tra trên trình duyệt rồi đóng tay.'
      );
      holdBrowserOpen = true;
      await new Promise(() => {});
      return;
    }
    console.error('LỖI:', err.message);
    process.exitCode = 1;
  } finally {
    if (!holdBrowserOpen) {
      await browser.close();
    }
  }
}

main().catch((err) => {
  console.error('Lỗi không xử lý được:', err.message);
  process.exitCode = 1;
});
