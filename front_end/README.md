# HRM Frontend

Nền tảng frontend cho **Hệ thống quản trị nhân sự (HR Management System)**.

## Công nghệ

- React 19 + Vite 8
- JavaScript / JSX (không TypeScript)
- **Tailwind CSS v4** với plugin `@tailwindcss/vite`
- **Lucide React** cho icon (không dùng emoji)
- **React Router DOM 7** (BrowserRouter)
- `oxlint` để lint (đã có sẵn trong template)

> Tailwind v4 dùng cú pháp `@import "tailwindcss";` trong CSS chính, khai báo token
> bằng `@theme {...}` (xem `src/index.css`). Không cần `tailwind.config.js` /
> `postcss.config.js` cho bản base.

## Cài đặt & chạy

```bash
npm install
npm run dev      # chạy dev server (http://localhost:5173)
npm run build    # build production ra thư mục dist/
npm run preview  # preview bản build
npm run lint     # chạy oxlint
```

## Cấu trúc thư mục `src/`

```
src/
├── assets/
├── components/
│   ├── common/         # Button, Card, Input, Badge, Avatar,
│   │                   # DataTable, PageHeader, StatCard, PlaceholderPanel
│   └── layout/        # Sidebar, TopBar
├── contexts/          # AuthContext, useAuth
├── data/              # mock data cho giai đoạn đầu
├── hooks/             # custom hooks (useDebouncedValue, ...)
├── layouts/           # AdminLayout, EmployeeLayout, AuthLayout
├── pages/
│   ├── auth/          # LoginPage, ForgotPasswordPage
│   ├── admin/         # AdminDashboardPage, AdminEmployeesPage,
│   │                  # AdminPlaceholderPage
│   ├── employee/      # EmployeeDashboardPage
│   └── shared/        # NotFoundPage
├── routes/            # AppRouter
├── services/          # httpClient, endpoints
├── styles/            # (giữ chỗ cho style bổ sung)
├── utils/             # format, classNames
├── App.jsx
├── main.jsx
└── index.css          # @import "tailwindcss"; + @theme tokens
```

> Không tạo file CSS riêng cho từng component; toàn bộ dùng utility class Tailwind.

## Phân khu chức năng

| Đường dẫn | Mô tả |
| --- | --- |
| `/auth/login` | Đăng nhập |
| `/auth/forgot-password` | Quên mật khẩu |
| `/admin` | Dashboard quản trị |
| `/admin/employees` | Hồ sơ nhân viên |
| `/admin/departments` | Phòng ban |
| `/admin/attendance` | Chấm công |
| `/admin/leave` | Nghỉ phép |
| `/admin/payroll` | Bảng lương |
| `/admin/training` | Đào tạo |
| `/admin/roles` | Phân quyền |
| `/admin/settings` | Cài đặt |
| `/employee` | Cổng nhân viên |

## Design tokens

Khai báo trong `src/index.css` thông qua `@theme`:

- Màu: `brand-{50..900}`, `neutral-{0..900}`, `success/warning/info/{danger}-50/500/600`
- Font: `--font-sans` (Inter)
- Shadow: `--shadow-card`, `--shadow-elevated`, `--shadow-modal`

## Hướng tích hợp backend (Express + MongoDB)

- `src/services/httpClient.js`: wrapper fetch có timeout/abort/credentials/JSON parsing.
- `src/services/endpoints.js`: bảng endpoint đọc `VITE_API_BASE_URL` (mặc định `/api`).
- `src/contexts/AuthContext.jsx`: nơi gắn session/JWT sau khi có API login.