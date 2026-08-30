#!/usr/bin/env node
// CLI entry point. Xem README.md để biết cách dùng.
const readline = require('readline');
require('./src/loadEnv').loadEnv();
const { runBatch, printSummary } = require('./src/runner');
const { CONSTANTS, getCredentials, getDefaultAssignees, getDefaultPhase, getSubmitContentForPhase, PHASE_DISPLAY_NAME } = require('./src/config');
const { parseCommonArgs, hasValueAt } = require('./src/cliArgs');
const blueprint = require('./src/blueprintActions');

function parseArgs(argv) {
  const args = { ...parseCommonArgs(argv), dryRun: false, yes: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--max') { if (hasValueAt(argv, i)) args.max = Number(argv[++i]); }
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--yes') args.yes = true;
  }
  return args;
}

function waitForEnter(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(promptText, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.phase) args.phase = getDefaultPhase();
  if (!args.phase) {
    console.error(
      '\nThiếu --phase (và chưa set BLUEPRINT_PHASE trong .env). Ví dụ: ' +
        'node index.js --phase Confirmation --assignee "<Tên Assignee>"' +
        `\nCác Phase hiện hỗ trợ: ${Object.values(PHASE_DISPLAY_NAME).join(', ')}`
    );
    process.exitCode = 1;
    return;
  }
  if (args.assignees.length === 0) args.assignees = getDefaultAssignees();
  if (args.assignees.length === 0) {
    console.error(
      '\nThiếu --assignee (và chưa set BLUEPRINT_FULL_NAME trong .env). Ví dụ: ' +
        'node index.js --phase Confirmation --assignee "<Tên Assignee>"' +
        '\n(có thể truyền nhiều người, phân cách bằng dấu phẩy: --assignee "A,B", ' +
        'hoặc set BLUEPRINT_FULL_NAME=<Tên bạn> trong .env để dùng làm mặc định)'
    );
    process.exitCode = 1;
    return;
  }
  if (args.max !== undefined && !(Number.isInteger(args.max) && args.max >= 0)) {
    console.error(`\n--max phải là 1 số nguyên >= 0, nhận được giá trị không hợp lệ. Bỏ --max nếu không muốn giới hạn.`);
    process.exitCode = 1;
    return;
  }
  // Validate Phase NGAY TỪ ĐẦU (trước khi mở trình duyệt/đăng nhập/xin xác
  // nhận) — tránh việc người dùng phải login + đọc và xác nhận Enter dòng
  // cảnh báo "thao tác THẬT trên production" xong mới phát hiện gõ sai Phase.
  try {
    getSubmitContentForPhase(args.phase);
  } catch (err) {
    console.error(`\n${err.message}`);
    process.exitCode = 1;
    return;
  }

  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
    args: ['--start-maximized', '--disable-gpu', '--disable-dev-shm-usage', '--disable-features=CalculateNativeWinOcclusion'],
  });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  try {
    console.log('Đang đăng nhập tự động...');
    await blueprint.login(page, getCredentials());
    console.log('Đăng nhập xong.');
  } catch (err) {
    console.warn(`Đăng nhập tự động lỗi (${err.message}) — chuyển sang đăng nhập thủ công.`);
    await page.goto(CONSTANTS.loginUrl);
    await waitForEnter('\nVui lòng đăng nhập thủ công trên trình duyệt, sau đó nhấn Enter ở đây để tiếp tục...\n');
  }
  // Luôn điều hướng tới trang Requirement 1 lần duy nhất SAU khi đã đăng nhập
  // xong (tự động hoặc thủ công) — tách riêng khỏi try/catch ở trên để lỗi ở
  // chính bước điều hướng này (vd network chập chờn) không bị hiểu nhầm thành
  // "đăng nhập tự động lỗi" và đẩy người dùng vào màn hình đăng nhập thủ công
  // dù thật ra họ đã đăng nhập thành công.
  await blueprint.gotoRequirementList(page);

  if (!args.dryRun && !args.yes) {
    await waitForEnter(
      `\nSẽ tìm và Submit TẤT CẢ ticket khớp Phase="${args.phase}" + Assignee=[${args.assignees.join(', ')}]. ` +
        'Đây là thao tác THẬT trên hệ thống production, không hoàn tác được từng ticket một cách dễ dàng.\n' +
        'Nhấn Enter để tiếp tục, hoặc Ctrl+C để huỷ...\n'
    );
  }

  try {
    const results = await runBatch(page, {
      phase: args.phase,
      assignees: args.assignees,
      dryRun: args.dryRun,
      maxTickets: args.max,
    });
    printSummary(results);
    if (results.ambiguous && results.ambiguous.length > 0) {
      // KHÔNG đóng trình duyệt ngay — tab của ticket "cần kiểm tra tay" (đã
      // bấm OK nhưng chưa xác nhận tự đóng được) vẫn đang mở, để người dùng
      // tự xem trước khi tool đóng hết trình duyệt.
      await waitForEnter(
        `\n⚠️  Có ${results.ambiguous.length} ticket ở trạng thái "Cần kiểm tra tay" — tab ticket đó vẫn ` +
          'đang mở. Tự kiểm tra trên trình duyệt xong rồi nhấn Enter ở đây để đóng...\n'
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('\nLỗi không xử lý được:', err.message);
  process.exitCode = 1;
});
