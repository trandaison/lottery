# Lottery System Documentation

## Dự án Sổ Số Vui Xuân Nội Bộ

Hệ thống quản lý chương trình sổ số vui xuân nội bộ công ty, cho phép nhân viên mua vé số và tham gia các chiến dịch quay số trúng thưởng.

---

## Tài liệu

1. **[Business Overview](./01-business-overview.md)**
   - Mục đích và mục tiêu của dự án
   - Đối tượng sử dụng
   - Tính năng chính
   - Quy mô và hiệu suất dự kiến
   - Quy tắc nghiệp vụ
   - Rủi ro và chiến lược giảm thiểu

2. **[Use Cases](./02-use-cases.md)**
   - Định nghĩa actors (Admin, Guest)
   - Chi tiết 14+ use cases
   - Luồng chính và luồng thay thế
   - Quy tắc nghiệp vụ cho từng use case
   - Điều kiện tiên quyết và hậu quả

3. **[Database Schema](./03-database-schema.md)**
   - Cấu trúc 7 bảng database
   - Quan hệ giữa các bảng (ERD)
   - Indexes và constraints
   - Chiến lược migration
   - Tối ưu hóa hiệu suất

4. **[Technology Stack](./04-techstack.md)**
   - Frontend: Next.js 15, React 19, TailwindCSS, shadcn/ui
   - Backend: Next.js API Routes, Node.js 20
   - Database: PostgreSQL 16 + Drizzle ORM
   - Các công nghệ liên quan: JWT, bcrypt, SendGrid, SePay, VietQR
   - Quyết định công nghệ và lý do lựa chọn

5. **[Architecture](./05-architecture.md)**
   - Kiến trúc tổng quan (Monolithic với Next.js)
   - Các layer: Presentation, Application, Service, Data Access
   - Sơ đồ luồng dữ liệu
   - Kiến trúc bảo mật
   - Chiến lược deployment (Vercel, Docker)
   - Tối ưu hóa hiệu suất và khả năng mở rộng

6. **[API Endpoints](./06-api-endpoints.md)**
   - Tất cả API endpoints với request/response
   - Authentication endpoints
   - Campaign management endpoints
   - Ticket & Order endpoints
   - Draw endpoints
   - Webhook endpoints
   - Validation schemas (Zod)
   - Error handling và rate limiting

7. **[Site Map](./07-site-map.md)**
   - Cấu trúc trang web đầy đủ
   - Public pages (Guest): Landing, Campaign detail, Payment, Success
   - Admin pages: Login, Campaigns list, Create/Edit, Draw interface
   - Navigation flows
   - Responsive design notes
   - SEO considerations

8. **[Implementation & Testing Plan](./08-implementation-testing-plan.md)**
   - 13 phases phát triển chi tiết
   - Timeline: 8 tuần (40 ngày làm việc)
   - Testing strategy (Unit, Integration, E2E)
   - Quality assurance checklist
   - Deployment checklist
   - Monitoring & maintenance plan
   - Post-MVP enhancements

---

## Quick Start

### Yêu cầu hệ thống
- Node.js >= 20.0.0
- pnpm >= 8.0.0
- PostgreSQL >= 16.0
- Redis >= 7.0 (optional)

### Cài đặt

```bash
# Clone repository
git clone <repo-url>
cd lottery

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Setup database
docker-compose up -d postgres

# Run migrations
pnpm db:migrate

# Seed data
pnpm db:seed

# Start development server
pnpm dev
```

### Default Admin Account
- Email: `admin@company.com`
- Password: `password123`

---

## Tech Stack Summary

| Category | Technology |
|----------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5.x |
| UI | React 19 + TailwindCSS + shadcn/ui |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Cache | Redis 7 (optional) |
| Auth | JWT + bcrypt |
| Email | SendGrid |
| Payment | SePay + VietQR |
| Deployment | Vercel |

---

## Project Structure

```
lottery/
├── src/
│   ├── app/                    # Next.js pages (App Router)
│   │   ├── (admin)/           # Admin routes with layout
│   │   │   └── admin/
│   │   │       ├── login/
│   │   │       └── campaigns/
│   │   ├── campaigns/         # Public campaign pages
│   │   ├── orders/            # Order status pages
│   │   └── api/               # API routes
│   │
│   ├── components/            # React components
│   │   ├── admin/            # Admin-specific components
│   │   ├── campaign/         # Campaign components
│   │   └── ui/               # shadcn/ui components
│   │
│   ├── services/             # Business logic services
│   │   ├── auth.service.ts
│   │   ├── campaign.service.ts
│   │   ├── ticket.service.ts
│   │   ├── order.service.ts
│   │   ├── draw.service.ts
│   │   ├── payment.service.ts
│   │   └── email.service.ts
│   │
│   ├── db/                   # Database
│   │   ├── schema/          # Drizzle schemas
│   │   ├── migrations/      # SQL migrations
│   │   └── client.ts        # Database connection
│   │
│   ├── lib/                 # Utilities & helpers
│   │   ├── hooks/          # Custom React hooks
│   │   ├── stores/         # State management
│   │   └── utils/          # Helper functions
│   │
│   └── types/              # TypeScript types
│
├── public/                 # Static assets
│   └── templates/         # Ticket template images
│
├── docs/                  # Documentation (this folder)
│
├── scripts/              # Utility scripts
│   └── seed.ts          # Database seeding
│
└── tests/               # Test files (future)
```

---

## Key Features

### For Admin
- ✅ JWT-based authentication with Remember Me
- ✅ Full CRUD for campaigns
- ✅ Configure multiple prize tiers
- ✅ Dynamic prize configuration
- ✅ Live draw interface with animations
- ✅ Draft mode for testing draws
- ✅ Redo functionality for draws

### For Guests
- ✅ View active campaigns
- ✅ Purchase unlimited tickets
- ✅ Pay via VietQR/SePay
- ✅ Receive tickets via email (with images)
- ✅ Real-time payment status tracking
- ✅ Countdown timer for payment

### System Features
- ✅ Automatic ticket number generation
- ✅ Payment webhook integration
- ✅ Email notification with ticket images
- ✅ Order timeout handling (10 minutes)
- ✅ Matching algorithm ensures winners exist
- ✅ Exclude winning tickets from subsequent draws

---

## Development Workflow

### Development
```bash
# Start dev server
pnpm dev

# Run linter
pnpm lint

# Format code
pnpm format

# Type check
pnpm type-check

# Database commands
pnpm db:generate   # Generate migration
pnpm db:migrate    # Run migration
pnpm db:push       # Push schema changes
pnpm db:studio     # Open Drizzle Studio
pnpm db:seed       # Seed database
```

### Testing
```bash
# Run unit tests (future)
pnpm test

# Run integration tests (future)
pnpm test:integration

# Run e2e tests (future)
pnpm test:e2e

# Run all tests
pnpm test:all
```

### Deployment
```bash
# Build for production
pnpm build

# Start production server
pnpm start

# Deploy to Vercel
git push origin main  # Auto-deploy on Vercel
```

---

## Environment Variables

Create `.env.local` file with the following variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/lottery_dev

# JWT
JWT_SECRET=your-secret-key-min-32-characters-long

# SendGrid
SENDGRID_API_KEY=SG.xxxxx

# SePay
SEPAY_API_KEY=xxxxx
SEPAY_WEBHOOK_JWT_SECRET=xxxxx

# Redis (optional)
REDIS_URL=redis://localhost:6379

# App
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cron Secret (for order timeout job)
CRON_SECRET=random-secret-key
```

---

## Contributing

### Code Style
- Follow ESLint configuration
- Use Prettier for formatting
- Write meaningful commit messages
- Add comments for complex logic

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes and commit
git add .
git commit -m "feat: add feature description"

# Push and create PR
git push origin feature/your-feature
```

### Commit Convention
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting)
- `refactor:` Code refactoring
- `test:` Add or update tests
- `chore:` Other changes (build, dependencies)

---

## Support & Contact

For issues, questions, or contributions:
- Create an issue in the repository
- Contact the development team
- Refer to documentation files for detailed information

---

## License

Internal use only - Company Name

---

## Changelog

### Version 1.0.0 (MVP)
- Initial release
- Core features: Campaign management, Ticket purchase, Payment, Email, Draw system
- Documentation complete

### Future Versions
See [Implementation & Testing Plan - Post-MVP Enhancements](./08-implementation-testing-plan.md#post-mvp-enhancements-future)

---

**Last Updated**: January 26, 2026

**Status**: Documentation Complete ✅

**Next Steps**: Begin Phase 0 - Project Setup
