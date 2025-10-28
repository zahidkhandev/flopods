# Flopods: AI Workflow Canvas

<div align="center">

# 🌊 Flopods

**The Next-Generation Multi-LLM, Node-Based Workflow Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/zahidkhandev/flopods/pulls)

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Architecture](#-architecture) • [Contributing](#-contributing)

</div>

---

---

## 🎯 The Vision

Flopods empowers AI power users, developers, and researchers by providing an **infinite, node-based canvas** for building, managing, and executing complex AI workflows. It eliminates **subscription overload**, **context fragmentation**, and **workflow inefficiencies** by unifying multiple Large Language Models (LLMs) into a single, visual interface.

### Why Flopods?

- ✅ **Unified Multi-LLM Interface**: Connect OpenAI, Anthropic, Google Gemini, and more in one workflow
- ✅ **Visual Workflow Builder**: Drag-and-drop canvas for AI workflow orchestration
- ✅ **Open Source First**: Self-hostable with LocalStack for local AWS emulation
- ✅ **Production Ready**: Built with enterprise-grade architecture and best practices
- ✅ **Document Intelligence**: Advanced OCR, PDF parsing, and RAG (Retrieval-Augmented Generation)
- ✅ **Real-time Collaboration**: WebSocket-powered live updates for teams

---

## 🛠️ Core Technologies

This project is built with a cutting-edge, production-ready stack:

### Backend

- **Framework**: NestJS (TypeScript) for robust, scalable APIs
- **Database**: PostgreSQL with Prisma ORM + pgvector for embeddings
- **Cache & Queue**: Redis (BullMQ) for background job processing
- **AWS Services**: S3, DynamoDB, SES (via LocalStack for local dev)
- **Authentication**: JWT + OAuth (Google, GitHub)
- **AI/ML**: Google Gemini API, Tesseract.js OCR, PDF parsing

### Frontend

- **Framework**: React 18 + TypeScript + Vite
- **Canvas**: React Flow for node-based workflow visualization
- **Styling**: Tailwind CSS 4.x
- **State Management**: Context API + React Query
- **Real-time**: Socket.IO client

### Infrastructure

- **Monorepo**: Turborepo with intelligent caching and parallel execution
- **Docker**: PostgreSQL, Redis, LocalStack for local AWS emulation
- **Code Quality**: ESLint, Prettier, Husky pre-commit hooks

---

## 📁 Workspace Structure

```
flopods/
│
├── apps/
│   ├── backend/          # NestJS API server
│   │   ├── src/
│   │   │   ├── common/   # Shared modules (AWS, Queue, Guards, Filters)
│   │   │   ├── v1/       # API v1 (Auth, Workspaces, Documents, Flows)
│   │   │   └── prisma/   # Prisma client
│   │   └── dist/         # Production build
│   │
│   └── frontend/         # React + Vite application
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── hooks/
│       │   └── lib/
│       └── dist/         # Production build
│
├── packages/
│   ├── schema/           # Prisma schema and database client
│   ├── tsconfig/         # Shared TypeScript configurations
│   └── eslint-config/    # Shared ESLint configurations
│
├── docker/
│   ├── db-docker-compose.yaml           # PostgreSQL + pgvector
│   ├── redis-docker-compose.yaml        # Redis for queues
│   └── localstack-docker-compose.yaml   # Local AWS emulation
│
├── .env.example          # Environment template for contributors
└── turbo.json            # Turborepo configuration
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js**: >= 20.0.0
- **Yarn**: >= 4.0.0 (automatically installed via Corepack)
- **Docker**: For running PostgreSQL, Redis, and LocalStack

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/flopods.git
cd flopods
```

### 2. Install Dependencies

```bash
yarn install
```

This automatically runs `prisma generate` via the `postinstall` hook.

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

**Default configuration works out-of-the-box for local development!**

Key variables (customize if needed):

```env
# Database (PostgreSQL)
DATABASE_URL="postgresql://postgres:123@localhost:5434/flopods?schema=public"

# JWT Secrets (⚠️ Generate new ones for production!)
JWT_ACCESS_TOKEN_SECRET=your-secret-here
JWT_REFRESH_TOKEN_SECRET=your-secret-here

# LocalStack (Local AWS)
AWS_DYNAMODB_ENDPOINT=http://localhost:4566
AWS_S3_ENDPOINT=http://localhost:4566
AWS_SES_ACCESS_KEY_ID=test
AWS_SES_SECRET_ACCESS_KEY=test

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=yourpassword
```

📖 See [Environment Configuration Guide](./README-ENV.md) for detailed setup instructions.

### 4. Start Infrastructure Services

Start **all** Docker services (PostgreSQL, Redis, LocalStack):

```bash
yarn docker:dev
```

This starts:

- **PostgreSQL** with pgvector on port `5434`
- **Redis** on port `6379`
- **LocalStack** (AWS emulation) on port `4566`

### 5. Run Database Migrations

```bash
yarn db:migrate
```

### 6. Start Development Servers

```bash
yarn dev
```

This starts both frontend and backend concurrently:

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000
- **API Docs**: http://localhost:8000/api/docs (if enabled)

### 7. Access the Application

Open your browser and navigate to **http://localhost:5173** 🎉

---

## 📋 Key Commands

### Development

| Command             | Description                                 |
| ------------------- | ------------------------------------------- |
| `yarn dev`          | Start both frontend and backend in dev mode |
| `yarn dev:backend`  | Start backend only                          |
| `yarn dev:frontend` | Start frontend only                         |
| `yarn build`        | Build all packages for production           |
| `yarn lint`         | Lint all code                               |
| `yarn lint:fix`     | Fix linting issues automatically            |
| `yarn type-check`   | Run TypeScript type checking                |
| `yarn format`       | Format all code with Prettier               |
| `yarn test`         | Run all tests                               |

### Database (Prisma)

| Command                | Description                                 |
| ---------------------- | ------------------------------------------- |
| `yarn db:generate`     | Generate Prisma Client after schema changes |
| `yarn db:migrate`      | Create and apply database migrations        |
| `yarn db:push`         | Push schema changes to database (dev)       |
| `yarn db:studio`       | Open Prisma Studio (database GUI)           |
| `yarn db:seed:pricing` | Seed pricing plans                          |
| `yarn db:reset`        | Reset database (⚠️ deletes all data)        |

### Docker Services

| Command                       | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `yarn docker:dev`             | Start all services (DB, Redis, LocalStack)    |
| `yarn docker:dev:down`        | Stop all services                             |
| `yarn docker:dev:clean`       | Stop and remove all volumes (⚠️ deletes data) |
| `yarn docker:db:up`           | Start PostgreSQL only                         |
| `yarn docker:redis:up`        | Start Redis only                              |
| `yarn docker:localstack:up`   | Start LocalStack only                         |
| `yarn docker:localstack:logs` | View LocalStack logs                          |

# Install podman-compose

pip3 install podman-compose

| Command                       | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `yarn podman:dev`             | Start all services (DB, Redis, LocalStack)    |
| `yarn podman:dev:down`        | Stop all services                             |
| `yarn podman:dev:clean`       | Stop and remove all volumes (⚠️ deletes data) |
| `yarn podman:db:up`           | Start PostgreSQL only                         |
| `yarn podman:redis:up`        | Start Redis only                              |
| `yarn podman:localstack:up`   | Start LocalStack only                         |
| `yarn podman:localstack:logs` | View LocalStack logs                          |

### Maintenance

| Command          | Description                             |
| ---------------- | --------------------------------------- |
| `yarn clean`     | Remove build artifacts and node_modules |
| `yarn reinstall` | Clean install all dependencies          |
| `yarn check`     | Run type-check, lint, and format checks |
| `yarn fix`       | Auto-fix linting and formatting issues  |

---

## 🎨 Features

### Core Features

- ✅ **Monorepo Architecture**: Turborepo with intelligent caching
- ✅ **Type Safety**: Full TypeScript coverage across frontend and backend
- ✅ **Visual Workflow Builder**: React Flow for node-based canvas
- ✅ **Multi-LLM Support**: OpenAI, Anthropic, Google Gemini integration
- ✅ **Document Intelligence**: PDF parsing, OCR, RAG system with pgvector
- ✅ **Real-time Collaboration**: WebSocket-powered live updates
- ✅ **Background Processing**: BullMQ for document processing queues
- ✅ **Local AWS Emulation**: LocalStack for S3, DynamoDB, SES
- ✅ **OAuth Integration**: Google and GitHub authentication
- ✅ **Magic Link Auth**: Passwordless email authentication

### Infrastructure

- ✅ **Production-Ready**: ESLint, Prettier, Husky configured
- ✅ **Database Migrations**: Prisma for schema management
- ✅ **Hot Reload**: Fast development with Vite and NestJS watch mode
- ✅ **Docker Compose**: One-command local environment setup
- ✅ **Environment Management**: Secure `.env` configuration

---

## 🏗️ Architecture

### Backend Architecture

```
apps/backend/src/
├── common/                    # Shared modules
│   ├── aws/                   # AWS services (S3, DynamoDB, SES)
│   ├── decorators/            # Custom decorators (auth, pagination)
│   ├── filters/               # Exception filters
│   ├── guards/                # Auth guards (JWT, OAuth)
│   ├── interceptors/          # Response transformation
│   ├── queue/                 # Queue abstraction (Redis/SQS)
│   └── websocket/             # WebSocket gateway
│
├── v1/                        # API Version 1
│   ├── auth/                  # Authentication (JWT, OAuth, Magic Link)
│   ├── workspaces/            # Workspace management
│   ├── flows/                 # Workflow canvas
│   ├── documents/             # Document processing & RAG
│   ├── pods/                  # Workflow nodes
│   └── users/                 # User management
│
└── prisma/                    # Database client
```

### Database Schema

```
Core Entities:
- Users → Workspaces (1:N with roles)
- Workspaces → Flows (1:N)
- Flows → Pods (1:N, canvas nodes)
- Workspaces → Documents (1:N with RAG)
- Documents → DocumentChunks (1:N with embeddings)
- Documents → DocumentCosts (1:N for billing)
```

### Technology Stack

#### Data Persistence

- **PostgreSQL**: Primary database with pgvector extension
- **DynamoDB**: Pod state, execution history, context chains
- **S3**: File storage (documents, images, exports)
- **Redis**: Queue management, caching

#### Processing Pipeline

```
Upload → Validate → Queue (BullMQ) → Process (OCR/PDF) → Chunk → Embed (Gemini) → Store (pgvector) → Search
```

---

## 🧪 Testing

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Generate coverage report
yarn test:cov

# E2E tests (backend only)
yarn test:e2e
```

---

## 🚢 Deployment

### Build for Production

```bash
yarn build
```

Output locations:

- **Backend**: `apps/backend/dist/`
- **Frontend**: `apps/frontend/dist/`

### Frontend Deployment

Deploy `apps/frontend/dist/` to static hosting:

- **Vercel**: `vercel deploy`
- **Netlify**: Drag & drop `dist/` folder
- **AWS S3 + CloudFront**: `aws s3 sync dist/ s3://your-bucket`

### Backend Deployment

Deploy `apps/backend/dist/` to Node.js runtime:

- **AWS EC2**: Copy `dist/` and run `node main.js`
- **Docker**: Build container with NestJS runtime
- **Render/Railway**: Connect GitHub repository

**Environment Variables**: Configure `DATABASE_URL`, `JWT_*`, and real AWS credentials in your hosting dashboard.

### Database Migrations (Production)

```bash
yarn workspace @flopods/schema db:migrate:deploy
```

---

## 📚 Documentation

- [Environment Setup Guide](./README-ENV.md)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [NestJS Documentation](https://docs.nestjs.com/)
- [React Flow Documentation](https://reactflow.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [LocalStack Documentation](https://docs.localstack.cloud/)

---

## 🤝 Contributing

We welcome contributions from the community! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and commit: `git commit -m 'Add amazing feature'`
4. **Push to your fork**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- Follow existing code style (ESLint + Prettier)
- Write tests for new features
- Update documentation as needed
- Keep commits atomic and descriptive

### Code Quality Checks

Before submitting a PR, run:

```bash
yarn check  # Type-check + lint + format
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## Author

**Zahid Khan** ([@zahidkhandev](https://github.com/zahidkhandev))

---

## Acknowledgments

- [Turborepo](https://turbo.build) for monorepo tooling
- [NestJS](https://nestjs.com) for backend framework
- [React Flow](https://reactflow.dev) for canvas visualization
- [Prisma](https://prisma.io) for database ORM
- [LocalStack](https://localstack.cloud) for local AWS emulation

---

<div align="center">

**Built with ❤️ using Turborepo, NestJS, React, and Prisma**

⭐ Star this repo if you find it useful!

</div>
