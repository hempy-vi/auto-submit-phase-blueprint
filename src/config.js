// Cấu hình nghiệp vụ cố định — tham khảo WORKFLOW.md.
const CONSTANTS = {
  // Vào thẳng auth.cyberlogitec.com.vn chỉ ra trang "Welcome to Keycloak"
  // chung, không có form login. Phải vào app Blueprint để nó tự redirect
  // sang đúng form login (OIDC) — giống hệt auto-log-task-blueprint.
  loginUrl: 'https://blueprint.cyberlogitec.com.vn',
  requirementListUrl: 'https://blueprint.cyberlogitec.com.vn/UI_PIM_001',

  // ⚠️ Giống hệt auto-log-task-blueprint: project MẶC ĐỊNH của tài khoản là
  // "CAPA Management" (đã xác nhận thật), có luồng Phase HOÀN TOÀN khác
  // (Register/Focal Receiving/Confirmation/Solving/Analysis/Design/
  // Implementation/.../1st Confirm/2nd Confirm...). Công việc thật của người
  // dùng (luồng Register/Confirmation/Solving/Finish) nằm ở project "ERP
  // Maintenance" — ĐÃ XÁC NHẬN THẬT (đọc được đúng ticket #2881, #2822...
  // khớp với auto-log-task-blueprint) khi chọn project này trước khi bật
  // Advance Search. BẮT BUỘC chọn đúng, không để mặc định.
  //
  // ⚠️ Theo yêu cầu của người dùng: CHỈ chọn Project, KHÔNG chọn tiếp module
  // con trong cây bên trái như auto-log-task-blueprint từng làm — vì ticket
  // của mỗi người dùng có thể rải rác ở NHIỀU module khác nhau trong cùng
  // project (Data Model/Logistics/Human Resource/Accounting), chọn riêng 1
  // module sẽ lọc mất ticket ở các module khác.
  projectName: 'ERP Maintenance',
};

// Cấu hình theo từng Phase — quy ước nghiệp vụ cố định. Gộp displayName +
// nội dung Submit vào CHUNG 1 object (thay vì 2 map song song) để không thể
// bị lệch key giữa 2 map khi thêm/sửa Phase. Chỉ hỗ trợ đúng 3 Phase này vì
// đây là các Phase mà người dùng thật sự đứng vai PIC cần bấm Submit
// (Register là tự động, không cần Submit tay — xem WORKFLOW.md).
const PHASES = {
  confirmation: { displayName: 'Confirmation', content: 'Confirmed' },
  solving: { displayName: 'Solving', content: 'Solved' },
  finish: { displayName: 'Finish', content: 'Finished' },
};

const PHASE_DISPLAY_NAME = Object.fromEntries(
  Object.entries(PHASES).map(([key, { displayName }]) => [key, displayName])
);

function getSubmitContentForPhase(phase) {
  const key = String(phase || '').trim().toLowerCase();
  const entry = PHASES[key];
  if (!entry) {
    throw new Error(
      `Phase "${phase}" chưa có nội dung Submit tương ứng. Hiện chỉ hỗ trợ: ` +
        `${Object.values(PHASE_DISPLAY_NAME).join(', ')} (xem WORKFLOW.md — nếu cần thêm Phase khác, ` +
        'phải xác nhận nội dung comment tương ứng với người dùng trước khi thêm vào config.js).'
    );
  }
  return entry;
}

/**
 * Giá trị mặc định cho `--assignee` khi không truyền qua CLI — đọc từ
 * `BLUEPRINT_FULL_NAME` trong `.env` (tên hiển thị của người dùng đang chạy
 * tool, đúng như trên Blueprint). Mỗi người dùng tự set tên mình trong `.env`
 * cục bộ, không hardcode trong code — xem `.env.example`. Hỗ trợ nhiều
 * tên phân cách bằng dấu phẩy, cùng cú pháp với `--assignee`. Trả về mảng
 * rỗng nếu chưa set.
 */
function getDefaultAssignees() {
  return String(process.env.BLUEPRINT_FULL_NAME || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Giá trị mặc định cho `--phase` khi không truyền qua CLI — đọc từ
 * `BLUEPRINT_PHASE` trong `.env`. Mỗi thiết bị/người dùng tự set Phase họ hay
 * xử lý nhất trong `.env` cục bộ, không hardcode trong code — xem
 * `.env.example`. Trả về chuỗi rỗng nếu chưa set.
 */
function getDefaultPhase() {
  return String(process.env.BLUEPRINT_PHASE || '').trim();
}

/** Đọc username/password từ process.env (nạp qua src/loadEnv.js từ file .env). */
function getCredentials() {
  const username = process.env.BLUEPRINT_USERNAME;
  const password = process.env.BLUEPRINT_PASSWORD;
  if (!username || !password) {
    throw new Error(
      'Thiếu BLUEPRINT_USERNAME/BLUEPRINT_PASSWORD. Tạo file .env (xem .env.example) ở thư mục gốc project.'
    );
  }
  return { username, password };
}

module.exports = {
  CONSTANTS,
  PHASE_DISPLAY_NAME,
  getSubmitContentForPhase,
  getDefaultAssignees,
  getDefaultPhase,
  getCredentials,
};
