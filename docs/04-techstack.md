# Technology Stack

## Overview
This document outlines the technology choices for the Lottery system, with rationale for each selection.

---

## Frontend

### Core Framework
- **Next.js 16.1.4** (App Router)
  - **Why**: Full-stack framework with excellent DX, built-in API routes, SSR/SSG capabilities
  - **Features used**: App Router, Server Components, Server Actions, API Routes
  - **Version**: 16.1.4

### UI & Styling
- **React 19**
  - **Why**: Latest React features, better performance, improved hooks
  
- **TypeScript 5.x**
  - **Why**: Type safety, better DX, catch errors at compile time
  
- **TailwindCSS 3.x**
  - **Why**: Utility-first, fast development, small bundle size
  - **Config**: Custom theme for lottery branding
  
- **shadcn/ui**
  - **Why**: High-quality, accessible components, customizable, no npm dependency overhead
  - **Components needed**: Button, Input, Form, Dialog, Select, Textarea, Toast, Table, Tabs

### Form Handling
- **React Hook Form**
  - **Why**: Performant, minimal re-renders, good validation integration
  
- **Zod**
  - **Why**: TypeScript-first schema validation, works well with React Hook Form
  - **Usage**: Form validation, API request/response validation

### Markdown
- **react-markdown**
  - **Why**: Render markdown for campaign descriptions
  
- **MDX Editor** (or SimpleMDE)
  - **Why**: WYSIWYG markdown editor for admin panel

### Date/Time
- **dayjs**
  - **Why**: Lightweight (2KB), simple API, immutable, same API as moment.js
  - **Usage**: Date formatting, countdown timers, date manipulation
  - **Plugins**: timezone, relativeTime, customParseFormat

### State Management
- **Zustand** (optional, for client state)
  - **Why**: Simple, minimal boilerplate, good TypeScript support
  - **Usage**: Admin draw page state, UI state
  
- **React Context** (for auth state)
  - **Why**: Built-in, sufficient for simple auth state

### Data Fetching
- **TanStack Query (React Query)**
  - **Why**: Excellent caching, automatic refetching, optimistic updates
  - **Usage**: Campaign data, tickets, orders polling

---

## Backend

### Runtime & Framework
- **Node.js 24.13.0**
  - **Why**: Latest LTS with improved performance and security features
  - **Note**: Ensure compatibility with all dependencies
  
- **Next.js API Routes**
  - **Why**: Co-located with frontend, no separate backend needed for MVP
  - **Structure**: `/app/api/*` routes
  - **Version**: 16.1.4

### Database
- **PostgreSQL 16**
  - **Why**: Robust, ACID compliant, excellent for relational data, JSON support
  - **Features used**: UUID, ENUM types, CHECK constraints, indexes
  
- **Drizzle ORM**
  - **Why**: TypeScript-first, lightweight, excellent DX, edge-compatible
  - **Alternative considered**: Prisma (heavier, slower codegen)

### Caching
- **Redis 7** (Required for Authentication)
  - **Why**: Fast in-memory cache, session management, pub/sub capabilities
  - **Usage**: 
    - **Authentication sessions** (Required): Store token_base with user info
    - Campaign cache (Optional): Cache campaign data for performance
    - Ticket number cache (Optional): Cache sold tickets for draw algorithm
    - Rate limiting (Optional): Prevent abuse
  - **Client**: ioredis
  - **Note**: Redis is required for session-based authentication with JWT

### Authentication
- **JWT (jsonwebtoken)**
  - **Why**: Industry standard, works well with Redis-backed sessions
  - **Implementation**: 
    - Generate token_base (UUID) on login
    - Store in Redis: `key=token_base, value={id, role, timestamp, remember_me}`
    - Use token_base as JWT subject
    - Verify by decoding JWT → fetch from Redis
    - Update Redis TTL on each verification
  - **Storage**: HTTP-only cookies for security
  
- **bcrypt**
  - **Why**: Industry standard for password hashing, adjustable cost factor

---

## Payment Integration

### Payment Gateway
- **SePay**
  - **Purpose**: Vietnam payment gateway, webhook support
  - **Integration**: REST API + Webhooks
  
- **VietQR**
  - **Purpose**: Generate QR codes for bank transfers
  - **Library**: `vietqr` npm package or manual QR generation
  
- **QR Code Generation**
  - **Library**: `qrcode`
  - **Why**: Simple, reliable, supports canvas

---

## Email Service

### Email Provider
- **SendGrid**
  - **Why**: Reliable, good deliverability, generous free tier
  - **SDK**: `@sendgrid/mail`
  
### Email Templates
- **React Email** or **MJML**
  - **Why**: Build email templates with React components
  - **Fallback**: HTML templates with handlebars

### Image Generation (Ticket Images)
- **node-canvas**
  - **Why**: Server-side Canvas API, generate images from templates
  - **Usage**: Render ticket numbers on template image
  - **Alternative**: Sharp for image manipulation

---

## Background Jobs

### Job Queue (Future)
- **BullMQ** (with Redis)
  - **Why**: Robust, Redis-backed, good monitoring
  - **Jobs**: Email sending, order timeout check
  - **Note**: For MVP, use simple cron or Next.js API routes

### Scheduled Tasks
- **node-cron** or **Next.js Cron API Routes**
  - **Why**: Simple, no external dependencies for MVP
  - **Jobs**: Check order expiration every 1 minute

---

## Development Tools

### Code Quality
- **ESLint**
  - Config: Next.js recommended + custom rules
  
- **Prettier**
  - Consistent code formatting
  
- **TypeScript Strict Mode**
  - Maximum type safety

### Git Hooks
- **Husky**
  - Pre-commit hooks for linting
  
- **lint-staged**
  - Run linters only on staged files

### Testing
- **Vitest** (unit tests)
  - **Why**: Fast, Vite-powered, ESM-first, compatible with Jest API
  - **Usage**: Service layer tests, utility function tests
  - **Config**: Integrated in this phase (not future)
  
- **@testing-library/react** (component tests)
  - **Why**: Best practices for testing React components
  - **Usage**: Test UI components behavior
  
- **Playwright** (e2e tests - Future)
  - **Why**: Reliable, cross-browser testing
  - **Usage**: End-to-end user flows

---

## DevOps & Infrastructure

### Version Control
- **Git**
- **GitHub** (or GitLab/Bitbucket)

### Package Manager
- **pnpm**
  - **Why**: Faster, more efficient disk space usage than npm/yarn
  - **Alternative**: npm (more universal)

### Environment Management
- **dotenv**
  - Environment variables for dev/prod
  
### Deployment
- **AWS EC2** (Production)
  - **Why**: Full control, flexible configuration for internal tool
  - **Stack**: Docker Compose orchestration
  - **Components**: Next.js app, PostgreSQL, Redis
  - **Note**: Deployment setup to be implemented in later phase
  
- **Docker Compose**
  - **Why**: Simple multi-container orchestration
  - **Services**: app, postgres, redis
  - **Note**: Only for production deployment, not used in local development

---

## Security

### Environment Variables
- **Required secrets**:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `SENDGRID_API_KEY`
  - `SEPAY_API_KEY`
  - `SEPAY_WEBHOOK_SECRET`
  - `REDIS_URL` (required for authentication)

### Security Best Practices
- **HTTPS only** in production
- **CORS** configuration for API routes
- **Rate limiting** on public APIs
- **Input validation** with Zod
- **SQL injection prevention** (Drizzle ORM parameterized queries)
- **XSS prevention** (React auto-escaping + CSP headers)
- **CSRF protection** (SameSite cookies)

---

## Monitoring & Logging (Future)

### Logging
- **Pino** (structured logging)
  - Fast, low overhead
  
### Error Tracking
- **Sentry** (Future)
  - Catch production errors, performance monitoring

### Analytics
- **Custom analytics** or **Google Analytics** (Future)
  - Basic usage tracking

---

## Development Environment

### Prerequisites
- **Node.js**: 24.13.0
- **pnpm**: >= 9.0.0
- **PostgreSQL**: >= 16.0 (installed locally or via native installation)
- **Redis**: >= 7.0 (installed locally or via native installation)

### Local Development Setup
- **No Docker required**: Use native installations for all services
- **PostgreSQL**: Install via Homebrew (macOS), apt (Linux), or official installer
- **Redis**: Install via Homebrew (macOS), apt (Linux), or official installer
- **Node.js**: Install via nvm or official installer

### IDE Recommendations
- **VS Code**
  - Extensions: ESLint, Prettier, Tailwind IntelliSense, Drizzle

### Environment Setup
```bash
# .env.local (development)
DATABASE_URL=postgresql://user:pass@localhost:5432/lottery_dev
JWT_SECRET=your-secret-key-min-32-chars
SENDGRID_API_KEY=SG.xxxxx
SEPAY_API_KEY=xxxxx
SEPAY_WEBHOOK_SECRET=xxxxx
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

### Local Development Commands
```bash
# Start PostgreSQL (example for macOS with Homebrew)
brew services start postgresql@16

# Start Redis
brew services start redis

# Or manually
redis-server

# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev

# Run tests
pnpm test
```

---

## Dependency Overview

### Core Dependencies
```json
{
  "next": "16.1.4",
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "typescript": "^5.3.0",
  
  "drizzle-orm": "^0.30.0",
  "postgres": "^3.4.0",
  "ioredis": "^5.3.0",
  
  "@tanstack/react-query": "^5.0.0",
  "react-hook-form": "^7.50.0",
  "zod": "^3.22.0",
  
  "jsonwebtoken": "^9.0.0",
  "bcrypt": "^5.1.0",
  
  "@sendgrid/mail": "^8.1.0",
  "canvas": "^2.11.0",
  "qrcode": "^1.5.0",
  
  "dayjs": "^1.11.0",
  "react-markdown": "^9.0.0",
  
  "tailwindcss": "^3.4.0",
  "class-variance-authority": "^0.7.0",
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.2.0"
}
```

### Dev Dependencies
```json
{
  "drizzle-kit": "^0.20.0",
  "@types/node": "^24.0.0",
  "@types/react": "^19.0.0",
  "@types/bcrypt": "^5.0.0",
  "@types/jsonwebtoken": "^9.0.0",
  
  "vitest": "^1.0.0",
  "@vitest/ui": "^1.0.0",
  "@testing-library/react": "^14.0.0",
  "@testing-library/jest-dom": "^6.0.0",
  "jsdom": "^23.0.0",
  
  "eslint": "^8.0.0",
  "eslint-config-next": "16.1.4",
  "prettier": "^3.0.0",
  "prettier-plugin-tailwindcss": "^0.5.0",
  
  "husky": "^8.0.0",
  "lint-staged": "^15.0.0"
}
```

---

## Technology Decision Matrix

| Concern | Options Considered | Chosen | Reason |
|---------|-------------------|--------|--------|
| Full-stack Framework | Next.js vs Remix vs Astro | Next.js 16.1.4 | Best DX, largest ecosystem, flexible deployment |
| Runtime | Node 20 vs Node 22 vs Node 24 | Node 24.13.0 | Latest LTS, better performance |
| ORM | Prisma vs Drizzle vs Kysely | Drizzle | Lightweight, TypeScript-first, edge-ready |
| UI Components | shadcn/ui vs MUI vs Chakra | shadcn/ui | Customizable, no deps overhead, modern |
| State Management | Redux vs Zustand vs Jotai | Zustand | Simple, minimal boilerplate |
| Date Library | date-fns vs dayjs vs luxon | dayjs | Lightweight (2KB), simple API |
| Testing | Jest vs Vitest | Vitest | Faster, Vite-powered, better DX |
| Email Service | SendGrid vs Resend vs AWS SES | SendGrid | Reliable, proven, good free tier |
| Payment | SePay vs VNPay vs Momo | SePay | Client requirement |
| Deployment | Vercel vs AWS EC2 vs Railway | AWS EC2 + Docker | Full control, internal tool flexibility |

---

## Architecture Principles

1. **Simplicity First**: Choose simple solutions for MVP, scale later
2. **TypeScript Everywhere**: Full type safety from DB to UI
3. **Edge-Ready**: Use edge-compatible libraries where possible
4. **Monorepo Structure**: Keep everything in one Next.js project for MVP
5. **API-First**: Design clean API contracts even for internal use
6. **Progressive Enhancement**: Work without JavaScript where possible
7. **Mobile-First**: Responsive design from the start
8. **Clean Code & Component Design**: 
   - Focus on writing clean, maintainable code
   - Split components reasonably for reusability and clarity
   - Avoid creating overly large components with mixed responsibilities
   - Extract common logic into custom hooks for better reusability and cleaner code
   - Each component/hook should have a single, clear purpose

---

## Future Considerations

### When to Scale
- **Redis**: Add when >50 concurrent users or slow queries
- **Job Queue**: Add when email delays become noticeable
- **Read Replicas**: Add when database queries >100ms consistently
- **CDN**: Add when serving >1000 ticket images/day
- **Microservices**: Don't - monolith is fine for this scale

### Potential Additions
- **WebSocket** for real-time draw updates (Socket.io)
- **S3/CloudFlare R2** for ticket image storage
- **ElasticSearch** for advanced search (unlikely needed)
- **GraphQL** if API becomes too complex (unlikely)
