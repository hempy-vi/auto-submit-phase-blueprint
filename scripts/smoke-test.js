// Test nhanh, AN TOÀN (KHÔNG Submit ticket nào): đăng nhập, chọn Project/
// Category, bật Advance Search, chọn Phase + Assignee, bấm Search, rồi CHỈ in
// ra số lượng ticket khớp + tóm tắt dòng đầu tiên. Dùng để kiểm tra selector/
// login còn sống không trước khi chạy `node index.js` thật.
//
// Cách chạy:
//   node scripts/smoke-test.js --phase Confirmation --assignee "<Tên Assignee>"
require('../src/loadEnv').loadEnv();
const { chromium } = require('playwright');
const blueprint = require('../src/blueprintActions');
const { getCredentials, getDefaultAssignees, getDefaultPhase, getSubmitContentForPhase, PHASE_DISPLAY_NAME } = require('../src/config');
const { parseCommonArgs } = require('../src/cliArgs');

async function main() {
  const args = parseCommonArgs(process.argv.slice(2));
  if (!args.phase) args.phase = getDefaultPhase();
  if (args.assignees.length === 0) args.assignees = getDefaultAssignees();
  if (!args.phase || args.assignees.length === 0) {
    console.error(
      'Cần --phase và --assignee (hoặc set BLUEPRINT_PHASE/BLUEPRINT_FULL_NAME trong .env). Ví dụ: ' +
        'node scripts/smoke-test.js --phase Confirmation --assignee "<Tên Assignee>"'
    );
    process.exitCode = 1;
    return;
  }
  const assignees = args.assignees;

  // Dùng đúng displayName chuẩn hoá (giống index.js/runner.js/test-one-ticket.js)
  // khi Phase thuộc 3 giá trị hỗ trợ Submit, tránh sai khoảng trắng/hoa-thường
  // khiến smoke-test "fail" dù batch thật chạy đúng. Phase không hỗ trợ Submit
  // (vd "Register") vẫn cho search thử, chỉ cảnh báo, dùng nguyên input đã trim.
  let phase = String(args.phase).trim();
  try {
    phase = getSubmitContentForPhase(args.phase).displayName;
  } catch {
    console.warn(`Phase "${phase}" không nằm trong danh sách hỗ trợ nội dung Submit (${Object.values(PHASE_DISPLAY_NAME).join(', ')}), nhưng vẫn thử search bình thường.`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  try {
    await blueprint.login(page, getCredentials());
    await blueprint.gotoRequirementList(page);
    await blueprint.selectProject(page);
    await blueprint.enableAdvanceSearch(page);
    await blueprint.selectPhase(page, phase);
    for (const name of assignees) {
      await blueprint.selectAssignee(page, name);
    }
    await blueprint.clickSearch(page);

    const count = await blueprint.getResultRowCount(page);
    console.log(`Phase="${phase}" + Assignee=[${assignees.join(', ')}] -> ${count} ticket khớp.`);
    if (count > 0) {
      const summary = await blueprint.getFirstRowSummary(page);
      console.log(`Dòng đầu tiên: ${summary}`);
    }

    await page.screenshot({ path: 'smoke-test-search-result.png', fullPage: true }).catch(() => {});
    console.log('Đã lưu ảnh chụp: smoke-test-search-result.png');
  } catch (err) {
    console.error('LỖI:', err.message);
    process.exitCode = 1;
  }
  await browser.close();
}

main().catch((err) => {
  console.error('Lỗi không xử lý được:', err.message);
  process.exitCode = 1;
});
