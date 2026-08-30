// Các hành động Playwright thao tác trên hệ thống Blueprint, ánh xạ theo
// WORKFLOW.md. KHÔNG cần sửa file này khi chỉ đổi selector — sửa
// src/selectors.js. Chỉ sửa ở đây nếu phát hiện LOGIC/THỨ TỰ thao tác sai so
// với thực tế khi chạy thật.

const SEL = require('./selectors');
const { CONSTANTS } = require('./config');

/** Escape ký tự đặc biệt của regex trong 1 chuỗi thường trước khi nhúng vào `new RegExp()`. */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Click 1 item trong popup Webix đang mở (chọn Project, option combo type-ahead...)
 * khớp CHÍNH XÁC + KHÔNG phân biệt hoa/thường — dùng chung cho MỌI nơi cần chọn
 * option theo text, tránh lỗi khớp substring (vd 1 project/tên khác chứa chung
 * 1 phần text sẽ bị chọn nhầm).
 */
async function clickExactPopupItem(page, text) {
  const option = page
    .locator('.webix_popup .webix_list_item:visible')
    .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`, 'i') });
  const count = await option.count();
  if (count === 0) {
    throw new Error(`Không tìm thấy option nào khớp chính xác "${text}" trong popup Webix đang mở.`);
  }
  if (count > 1) {
    throw new Error(`Có ${count} option cùng khớp chính xác "${text}" — không rõ nên chọn cái nào, dừng lại để tránh chọn nhầm.`);
  }
  await option.click();
}

// ---------- Đăng nhập (giống hệt auto-log-task-blueprint) ----------

async function login(page, { username, password }) {
  await page.goto(CONSTANTS.loginUrl);
  await page.fill(SEL.login.usernameInput, username);
  await page.fill(SEL.login.passwordInput, password);
  await page.click(SEL.login.submitButton);
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function gotoRequirementList(page) {
  await page.goto(CONSTANTS.requirementListUrl);
  await page.waitForLoadState('networkidle').catch(() => {});
}

/**
 * Chọn đúng Project ("ERP Maintenance") — BẮT BUỘC gọi trước khi bật Advance
 * Search, vì project mặc định của tài khoản ("CAPA Management") có luồng
 * Phase hoàn toàn khác (xem config.js). CHỈ chọn Project, KHÔNG chọn tiếp
 * module trong cây bên trái — theo yêu cầu của người dùng, để không lọc mất
 * ticket ở các module khác (Data Model/Human Resource/Accounting...). Chỉ cần gọi 1
 * lần đầu khi bắt đầu chạy tool.
 */
async function selectProject(page) {
  await page.click(SEL.requirementList.projectDropdownInput);
  await clickExactPopupItem(page, CONSTANTS.projectName);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);
}

/** Bật Advance Search nếu đang tắt (kiểm tra aria-checked trước khi click, tránh bấm nhầm chiều tắt nó đi). */
async function enableAdvanceSearch(page) {
  const handle = page.locator(SEL.requirementList.advSearchToggle.handle);
  const isOn = (await handle.getAttribute('aria-checked')) === 'true';
  if (!isOn) {
    await handle.click();
    await page.waitForTimeout(500);
  }
}

/** Gõ + chọn 1 tag trong 1 ô multicombo (Phase/Assignee...) — dùng chung 1 cơ chế combo type-ahead. */
async function addMultiComboTag(page, inputSelector, text) {
  await page.click(inputSelector);
  await page.locator(inputSelector).pressSequentially(text, { delay: 30 });
  await page.waitForTimeout(500);
  await clickExactPopupItem(page, text);
  await page.waitForTimeout(300);
}

async function selectPhase(page, phaseDisplayName) {
  await addMultiComboTag(page, SEL.requirementList.phaseCbb.input, phaseDisplayName);
}

async function selectAssignee(page, assigneeName) {
  await addMultiComboTag(page, SEL.requirementList.assigneeCbb.input, assigneeName);
}

async function clickSearch(page) {
  await page.click(SEL.requirementList.searchButton);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
}

/** Số dòng kết quả đang hiển thị (đọc số ô cột 1 = mã ticket #). */
async function getResultRowCount(page) {
  return page.locator(SEL.requirementList.resultGrid.firstColumnCells).count();
}

/** Đọc toàn bộ text của dòng đầu tiên (mọi cột) — chỉ để LOG, không dùng để định vị. */
async function getFirstRowSummary(page) {
  const cells = await page.locator(SEL.requirementList.resultGrid.rowCells(1)).allTextContents();
  return cells.map((t) => t.trim()).filter(Boolean).join(' | ');
}

/**
 * Double-click dòng đầu tiên trong bảng kết quả (aria-rowindex="1", cột #) —
 * hệ thống mở trang Detail ở 1 TAB TRÌNH DUYỆT MỚI (cùng cơ chế đã xác nhận ở
 * auto-log-task-blueprint). Dùng context.waitForEvent('page') để bắt tab mới.
 */
async function openFirstResultInNewTab(page) {
  const context = page.context();
  const newPagePromise = context.waitForEvent('page', { timeout: 15000 });
  await page.dblclick(SEL.requirementList.resultGrid.cellByRowCol(1, 1));
  const newPage = await newPagePromise;
  await newPage.waitForLoadState('networkidle').catch(() => {});
  await newPage.waitForTimeout(1000);
  return newPage;
}

/** Bấm Submit trên trang Detail rồi điền nội dung comment — DỪNG LẠI TRƯỚC khi bấm OK. */
async function openSubmitForm(detailPage, content) {
  const submitButton = detailPage.locator(SEL.ticketDetail.submitButton);
  await submitButton.waitFor({ state: 'visible', timeout: 15000 });
  await submitButton.click();

  const textarea = detailPage.locator(SEL.ticketDetail.submitCommentTextarea);
  await textarea.waitFor({ state: 'visible', timeout: 10000 });
  await textarea.fill(content);
}

/**
 * Bấm OK (hành động THẬT, không hoàn tác được) rồi chờ tab TỰ ĐỘNG đóng (hành
 * vi đã xác nhận qua thao tác tay của người dùng — "sau vài giây tab tự đóng,
 * quay về màn hình search"). Nếu có BẤT KỲ lỗi nào từ ngay trước lúc bấm OK
 * trở đi (kể cả chính `click()` ném lỗi, vd "Target closed" nếu tab bắt đầu tự
 * đóng ngay trong lúc Playwright còn đang xử lý click) tới lúc tab tự đóng,
 * ném lỗi kèm cờ `okClickedButNotConfirmedClosed = true` — KHÔNG được coi
 * giống lỗi bình thường (vd Submit button không hiện): OK có thể đã click
 * thật rồi, nên KHÔNG tự đóng tab tay, KHÔNG tự động thử ticket khác (rủi ro
 * Submit lần 2 lên đúng ticket này nếu thật ra nó đã xử lý xong) — xem cách
 * runner.js xử lý.
 */
async function confirmSubmit(detailPage) {
  const okButton = detailPage.locator(SEL.ticketDetail.okButton);
  await okButton.waitFor({ state: 'visible', timeout: 10000 });

  const closedPromise = detailPage.waitForEvent('close', { timeout: 20000 });
  try {
    await okButton.click();
    await closedPromise;
  } catch (err) {
    err.okClickedButNotConfirmedClosed = true;
    throw err;
  }
}

/** Bấm Submit trên trang Detail, điền nội dung comment tương ứng Phase, rồi bấm OK luôn (xem `confirmSubmit`). */
async function submitPhase(detailPage, content) {
  await openSubmitForm(detailPage, content);
  await confirmSubmit(detailPage);
}

module.exports = {
  login,
  gotoRequirementList,
  selectProject,
  enableAdvanceSearch,
  selectPhase,
  selectAssignee,
  clickSearch,
  getResultRowCount,
  getFirstRowSummary,
  openFirstResultInNewTab,
  openSubmitForm,
  confirmSubmit,
  submitPhase,
};
