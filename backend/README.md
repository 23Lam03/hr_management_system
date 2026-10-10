# HR Management System — Backend

Express + Mongoose (ES Modules) backend for the HR Management System.

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# then edit .env if needed

# 3. Run in development (auto-reload with nodemon)
npm run dev

# Or run in production mode
npm start
```

## Environment variables

See `.env.example` for the full list. Required:

- `PORT` — HTTP port (default `5000`)
- `MONGODB_URI` — MongoDB connection string (no credentials in source)
- `JWT_SECRET` — secret for JWT signing (≥ 16 chars in production)
- `CLIENT_URL` — allowed frontend origin for CORS
- `NODE_ENV` — `development` | `production`

`.env` is gitignored. Never commit real secrets.

## Endpoints

| Method | Path           | Description                                              |
| ------ | -------------- | -------------------------------------------------------- |
| GET    | `/`            | Service banner                                           |
| GET    | `/api/health`  | Health check; reports DB connection state                |
| *      | `*`            | 404 JSON response via centralized not-found handler      |

## Project layout

```
backend/
├── package.json
├── .env               # local secrets (gitignored)
├── .env.example       # safe template
├── .gitignore
├── docs/
│   └── DATABASE_DESIGN.md   # schema, indexes, quan hệ, kế hoạch
├── src/
│   ├── server.js                    # bootstrap + DB + HTTP lifecycle
│   ├── app.js                       # Express app factory
│   ├── config/
│   │   ├── env.js                   # env loading + validation
│   │   └── database.js              # Mongoose connect / disconnect
│   ├── models/
│   │   ├── index.js                 # barrel
│   │   ├── user.model.js
│   │   ├── employee.model.js
│   │   ├── department.model.js
│   │   └── position.model.js
│   ├── middlewares/
│   │   └── error.middleware.js      # 404 + centralized error handler
│   └── routes/
│       └── health.routes.js
└── tests/
    ├── helpers/db.js                # test DB setup/teardown
    ├── user.model.test.js
    ├── employee.model.test.js
    ├── department.model.test.js
    ├── position.model.test.js
    └── health.regression.test.js
```

## Tests

```bash
npm test              # chạy tất cả model tests (dùng DB hrm_test_db)
npm run syntax-check  # chỉ check syntax các file JS
```

Test framework: Node built-in `node --test` (zero dependency). Tests dùng
DB riêng `hrm_test_db` để không ảnh hưởng dữ liệu development.

Hiện tại: **69 tests, tất cả PASS, 0 FAIL** (cover schema validation,
unique index, optional userId, references, passwordHash serialization,
cascade behavior, health check regression).

Xem chi tiết schema + indexes + quan hệ tại
[`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md).

## Notes

- The server **does not start** unless MongoDB is connected. If the DB
  connection fails, the process exits with a clear error.
- `GET /api/health` reflects MongoDB's actual readyState (via Mongoose) —
  it returns `503` when the DB is not connected, never a false `connected`.
- CORS allows only configured origins in production. In development,
  all origins are accepted for convenience.
- Centralized error handler never leaks stack traces or secrets to clients.
- `passwordHash` is `select: false` AND stripped from `toJSON` — it can
  never leak via the API.