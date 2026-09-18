#!/usr/bin/env node
// CLI entry point. Xem README.md để biết cách dùng.
const path = require('path');
const readline = require('readline');
require('./src/loadEnv').loadEnv();
const { runBatch, printSummary } = require('./src/runner');
const { CONSTANTS, getCredentials, getDefaultAssignees, getDefaultPhase, getSubmitContentForPhase, PHASE_DISPLAY_NAME } = require('./src/config');
const { parseCommonArgs, hasValueAt } = require('./src/cliArgs');
const { buildReportHtml, writeReportFile } = require('./src/report');
const blueprint = require('./src/blueprintActions');

function parseArgs(argv) {
  const args = { ...parseCommonArgs(argv), dryRun: false, yes: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--max') {
      if (!hasValueAt(argv, i)) throw new Error('Thiếu giá trị cho --max (đứng cuối dòng lệnh, hoặc bị 1 cờ khác đứng ngay sau "nuốt" mất).');
      args.max = Number(argv[++i]);
    } else if (a === '--dry-run') args.dryRun = true;
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
  // nhận) — tránh người dùng phải login + xác nhận cảnh báo "thao tác THẬT
  // trên production" xong mới phát hiện gõ sai Phase.
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
  // Bọc TOÀN BỘ vòng đời trình duyệt (login, điều hướng, xác nhận, batch)
  // trong 1 try/finally duy nhất — lỗi ở bất kỳ bước nào (kể cả
  // gotoRequirementList, trước đây nằm ngoài try/finally) vẫn phải đóng được
  // trình duyệt, tránh treo tiến trình Node vô thời hạn.
  try {
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    // Màn hình chào (assets/splash.html) — thuần cosmetic, không ảnh hưởng
    // logic batch. Lỗi ở bước này (vd thiếu file) không được làm dừng cả batch.
    try {
      const splashPath = path.resolve(__dirname, 'assets', 'splash.html');
      await page.goto(`file:///${splashPath.replace(/\\/g, '/')}`);
      await page.waitForTimeout(10000);
    } catch (err) {
      console.warn(`Không hiện được màn hình chào (${err.message}) — bỏ qua, tiếp tục đăng nhập.`);
    }

    try {
      console.log('Đang đăng nhập tự động...');
      await blueprint.login(page, getCredentials());
      console.log('Đăng nhập xong.');
    } catch (err) {
      console.warn(`Đăng nhập tự động lỗi (${err.message}) — chuyển sang đăng nhập thủ công.`);
      await page.goto(CONSTANTS.loginUrl);
      await waitForEnter('\nVui lòng đăng nhập thủ công trên trình duyệt, sau đó nhấn Enter ở đây để tiếp tục...\n');
    }
    // Luôn điều hướng tới trang Requirement 1 lần duy nhất SAU khi đăng nhập
    // xong (tự động hoặc thủ công) — tách khỏi try/catch phía trên để lỗi
    // điều hướng (vd network chập chờn) không bị hiểu nhầm là "đăng nhập tự
    // động lỗi", đẩy nhầm sang đăng nhập thủ công dù đã đăng nhập thành công.
    await blueprint.gotoRequirementList(page);

    if (!args.dryRun && !args.yes) {
      await waitForEnter(
        `\nSẽ tìm và Submit TẤT CẢ ticket khớp Phase="${args.phase}" + Assignee=[${args.assignees.join(', ')}]. ` +
          'Đây là thao tác THẬT trên hệ thống production, không hoàn tác được từng ticket một cách dễ dàng.\n' +
          'Nhấn Enter để tiếp tục, hoặc Ctrl+C để huỷ...\n'
      );
    }

    const results = await runBatch(page, {
      phase: args.phase,
      assignees: args.assignees,
      dryRun: args.dryRun,
      maxTickets: args.max,
    });
    printSummary(results);

    if (!args.dryRun) {
      // Sau 1 lần chạy THẬT: tạo báo cáo HTML (cùng phong cách assets/splash.html
      // — thống kê + danh sách Thành công/Lỗi/Cần kiểm tra tay, kèm link mở
      // từng ticket), mở trên tab hiện tại, rồi GIỮ trình duyệt mở VÔ THỜI HẠN
      // cho người dùng tự xem — không gọi browser.close(). Node phải sống để
      // không kéo theo đóng Chromium; tự đóng cửa sổ trình duyệt là cách duy
      // nhất để kết thúc — bắt sự kiện 'disconnected' để tiến trình nền (chạy
      // qua run.bat) tự thoát sạch, không để lại tiến trình mồ côi.
      try {
        const reportPath = writeReportFile(
          buildReportHtml({ phase: args.phase, assignees: args.assignees, results, finishedAt: new Date() })
        );
        await page.goto(`file:///${reportPath.replace(/\\/g, '/')}`);
        console.log(`\nĐã mở báo cáo kết quả: ${reportPath}`);
      } catch (err) {
        console.warn(`Không tạo/mở được báo cáo (${err.message}) — kết quả vẫn đúng ở phần tổng kết console phía trên.`);
      }
      browser.on('disconnected', () => process.exit(0));
      await new Promise(() => {});
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('\nLỗi không xử lý được:', err.message);
  process.exitCode = 1;
});
