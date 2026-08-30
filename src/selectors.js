// Toàn bộ CSS selector/locator thật của hệ thống Blueprint (CyberLogitec)
// dùng riêng cho tool này. Phần lớn ĐÃ được xác nhận thật qua Playwright
// (đăng nhập thật + đọc DOM thật) — xem WORKFLOW.md.
//
// ⚠️ Giống hệt ghi chú ở auto-log-task-blueprint: UI dựng bằng Webix — nhiều
// widget được gán id DOM dạng số ngẫu nhiên/timestamp (vd `id="x1788..."`),
// ĐỔI MỖI LẦN mở lại. TUYỆT ĐỐI không dùng các id này. Dùng `view_id="..."`
// (thuộc tính CỐ ĐỊNH Webix luôn gán trên div bao ngoài mỗi widget) hoặc id
// HTML thật do chính app Blueprint tự đặt (không phải Webix sinh ra, vd
// `#btnSubmit`, `#txtSubmit`, `#btnOK`, `#username`).

module.exports = {
  // --- Đăng nhập (giống hệt auto-log-task-blueprint, cùng hệ thống) ---
  login: {
    usernameInput: '#username',
    passwordInput: '#password',
    submitButton: '#submit-btn',
  },

  // --- Trang Requirement (danh sách), URL cố định .../UI_PIM_001 ---
  requirementList: {
    // Dropdown chọn Project (input role="combobox" ĐẦU TIÊN trên trang) —
    // giống hệt auto-log-task-blueprint, xem ghi chú ở đó nếu cần đối chiếu lại.
    // Tool này CHỈ chọn Project, không chọn tiếp module trong cây bên trái
    // (xem config.js) — nên không cần selector categoryTreeItem.
    projectDropdownInput: 'input[role="combobox"]:visible >> nth=0',

    // ✅ Đã xác nhận thật: toggle Advance Search là 1 webix switch thật.
    // aria-checked trên button.webix_switch_handle phản ánh đúng trạng thái
    // ON/OFF hiện tại ("true"/"false") — dùng để kiểm tra trước khi click,
    // tránh bấm nhầm chiều (tắt cái đang bật).
    advSearchToggle: {
      container: '[view_id="advSearchToggle"]',
      handle: '[view_id="advSearchToggle"] .webix_switch_handle',
    },

    // ✅ Đã xác nhận thật qua dump DOM: ô Phase trong panel Advance Search có
    // view_id="phsCbb" (multicombo — cho phép chọn nhiều tag, nhưng nghiệp vụ
    // tool này chỉ dùng đúng 1 Phase mỗi lần chạy — xem config.js).
    phaseCbb: {
      container: '[view_id="phsCbb"]',
      input: '[view_id="phsCbb"] input',
      tag: '[view_id="phsCbb"] .webix_multicombo_tag',
    },

    // ✅ Đã xác nhận thật: view_id="asgneeCbb" — khớp đúng HTML người dùng cung cấp.
    assigneeCbb: {
      container: '[view_id="asgneeCbb"]',
      input: '[view_id="asgneeCbb"] input',
      tag: '[view_id="asgneeCbb"] .webix_multicombo_tag',
    },

    // ✅ Đã xác nhận thật: đúng 1 nút "Search" duy nhất trên trang (cả khi
    // Advance Search đang bật) — `:has-text()` (khớp substring) an toàn ở đây
    // vì không có nút nào khác trên trang chứa chữ "Search" làm nhãn.
    searchButton: 'button:has-text("Search")',

    // ✅ Đã xác nhận thật: bảng kết quả search có view_id="gridReq" (Webix
    // datatable dạng CỘT-CHÍNH — mỗi cột là 1 div `.webix_column` chứa các ô
    // `.webix_cell` xếp dọc, KHÔNG PHẢI bảng <table>/<tr> thường). Mỗi ô có
    // `aria-rowindex`/`aria-colindex` — cùng cơ chế đã gặp ở
    // auto-log-task-blueprint (jobDetailModal.effortPoint.resultRowNameCell).
    // Cột 1 (aria-colindex="1") là mã ticket (#) — dùng cột này để đếm số
    // dòng kết quả và để double-click mở ticket đầu tiên.
    resultGrid: {
      root: '[view_id="gridReq"]',
      firstColumnCells: '[view_id="gridReq"] [aria-colindex="1"]',
      cellByRowCol: (row, col) => `[view_id="gridReq"] [aria-colindex="${col}"][aria-rowindex="${row}"]`,
      rowCells: (row) => `[view_id="gridReq"] [aria-rowindex="${row}"]`,
    },
  },

  // --- Trang Detail của 1 ticket (mở ở TAB MỚI sau khi double-click dòng
  // kết quả — cùng cơ chế đã xác nhận ở auto-log-task-blueprint) ---
  // ✅ Đã xác nhận thật: #btnSubmit tồn tại thật trên trang
  // Detail, đúng style người dùng cung cấp (background-color: #3a7eb6 = rgb(58,126,182)).
  // Mặc định `visibility: hidden` — chỉ hiện khi ticket ở đúng Phase mà user
  // đang đăng nhập là PIC phụ trách (đúng lý do vì sao phải lọc Assignee =
  // chính mình trước — nếu lọc đúng thì nút này LUÔN hiện, không cần xử lý gì
  // thêm ngoài việc chờ visible trước khi click).
  //
  // ✅ #txtSubmit/#btnOK đã tự bấm thật (CONFIRM=yes) trên production — tab tự
  // đóng đúng như mô tả, ticket chuyển đúng sang Phase kế tiếp.
  ticketDetail: {
    submitButton: '#btnSubmit',
    submitCommentTextarea: '#txtSubmit', // <textarea id="txtSubmit"> thật, KHÔNG phải CKEditor — fill() dùng được
    okButton: '#btnOK',
    // ✅ Đã xác nhận thật cùng lúc với #txtSubmit/#btnOK (chưa dùng tới trong
    // luồng chính, ghi lại để tiện dùng nếu sau này cần hàm "huỷ" an toàn).
    cancelButton: 'button:has-text("Cancel")',
  },
};
