# Actopod: The AI Workflow Canvas

✨ **Welcome to Actopod** - A next-generation, multi-LLM, node-based workflow platform built with modern web technologies. ✨

## 🎯 The Vision

Actopod empowers AI power users, developers, and researchers by providing an infinite, node-based canvas for building, managing, and executing complex AI workflows. It eliminates subscription overload, context fragmentation, and workflow inefficiencies by unifying multiple Large Language Models (LLMs) into a single, visual interface.

## 🛠️ Core Technologies

This project is built with a cutting-edge, production-ready stack:

- **Monorepo**: Turborepo for intelligent caching and parallel execution
- **Backend**: NestJS (TypeScript) for robust, scalable APIs
- **Frontend**: React + Vite for blazing-fast development
- **Canvas UI**: React Flow for node-based workflow visualization
- **Database ORM**: Prisma with PostgreSQL for type-safe data access
- **Code Quality**: ESLint, Prettier, and EditorConfig for consistent code style

## 📁 Workspace Structure

```
actopod/
│
├── apps/
│   ├── backend/          # NestJS API server
│   │   ├── src/          # Source code
│   │   └── dist/         # Production build output
│   │
│   └── frontend/         # React + Vite application
│       ├── src/          # Source code
│       └── dist/         # Production build output
│
├── packages/
│   ├── schema/           # Prisma schema and database client
│   ├── tsconfig/         # Shared TypeScript configurations
│   └── eslint-config/    # Shared ESLint configurations
│
├── docker/
│   └── db-docker-compose.yaml  # PostgreSQL database setup
│
└── turbo.json           # Turborepo configuration
```

## 🚀 Getting Started: Local Development

### Prerequisites

- **Node.js**: >= 20.0.0
- **Yarn**: >= 4.0.0
- **Docker**: For running PostgreSQL locally

### 1. Install Dependencies

```
yarn install
```

This automatically runs `prisma generate` via the `postinstall` hook.

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```
# Database
DATABASE_URL="postgresql://postgres:123@localhost:5434/actopod?schema=public"

# Node Environment
NODE_ENV="development"

# Backend
BACKEND_PORT=3001

# Frontend
VITE_API_URL="http://localhost:3001"
```

### 3. Start Database

```
yarn docker:db:up
```

This starts a PostgreSQL database in Docker on port `5434`.

### 4. Run Database Migrations

```
yarn db:migrate
```

### 5. Seed Database (Optional)

```
yarn db:seed
```

### 6. Start Development Servers

```
yarn dev
```

This starts both frontend and backend concurrently:

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001

## 📋 Key Commands

### Development

| Command             | Description                                 |
| ------------------- | ------------------------------------------- |
| `yarn dev`          | Start both frontend and backend in dev mode |
| `yarn build`        | Build all packages for production           |
| `yarn lint`         | Lint all code                               |
| `yarn lint:fix`     | Fix linting issues automatically            |
| `yarn type-check`   | Run TypeScript type checking                |
| `yarn format`       | Format all code with Prettier               |
| `yarn format:check` | Check code formatting                       |

### Database (Prisma)

| Command            | Description                                 |
| ------------------ | ------------------------------------------- |
| `yarn db:generate` | Generate Prisma Client after schema changes |
| `yarn db:migrate`  | Create and apply database migrations        |
| `yarn db:push`     | Push schema changes to database (dev)       |
| `yarn db:studio`   | Open Prisma Studio (database GUI)           |
| `yarn db:seed`     | Populate database with initial data         |

### Docker

| Command               | Description               |
| --------------------- | ------------------------- |
| `yarn docker:db:up`   | Start PostgreSQL database |
| `yarn docker:db:down` | Stop PostgreSQL database  |
| `yarn docker:db:logs` | View database logs        |

### Maintenance

| Command      | Description                                 |
| ------------ | ------------------------------------------- |
| `yarn clean` | Remove all build artifacts and dependencies |
| `yarn test`  | Run all tests                               |

## 🏗️ Building for Production

### Build All Packages

```
yarn build
```

Output locations:

- **Backend**: `apps/backend/dist/`
- **Frontend**: `apps/frontend/dist/`
- **Schema**: `packages/schema/dist/`

### Build Individual Packages

```
# Backend only
turbo build --filter=@actopod/backend

# Frontend only
turbo build --filter=@actopod/frontend
```

## 🚢 Deployment

### Frontend (`apps/frontend`)

Deploy the `apps/frontend/dist/` folder to any static hosting provider:

- **Vercel**: `vercel deploy`
- **Netlify**: Upload `dist/` folder
- **AWS S3 + CloudFront**: Sync `dist/` to S3 bucket

### Backend (`apps/backend`)

Deploy the `apps/backend/dist/` folder to a Node.js runtime:

- **AWS EC2**: Copy `dist/` and run `node main.js`
- **Docker**: Build container with `dist/` and NestJS runtime
- **Render/Railway**: Deploy directly from repository

**Environment Variables**: Configure `DATABASE_URL` and other secrets in your hosting provider's dashboard.

### Database

Run migrations in production:

```
yarn workspace @actopod/schema db:migrate:deploy
```

## 🎨 Project Features

- ✅ **Monorepo Architecture**: Turborepo with intelligent caching
- ✅ **Type Safety**: Full TypeScript coverage across frontend and backend
- ✅ **Modern Stack**: React 18, NestJS 11, Prisma 6
- ✅ **Visual Workflow Builder**: React Flow for node-based canvas
- ✅ **Production-Ready**: ESLint, Prettier, EditorConfig configured
- ✅ **Database Migrations**: Prisma for schema management
- ✅ **Hot Reload**: Fast development with Vite and NestJS watch mode

## 🧪 Testing

```
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Generate coverage report
yarn test:cov
```

## 📚 Useful Resources

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [NestJS Documentation](https://docs.nestjs.com/)
- [React Flow Documentation](https://reactflow.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vite Documentation](https://vitejs.dev/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 👨‍💻 Author

**Zahid Khan** ([@zahidkhandev](https://github.com/zahidkhandev))

---

Built with ❤️ using Turborepo, NestJS, React, and Prisma

```

This README is:
- **Professional** and well-structured
- **Action-oriented** with clear commands
- **Production-ready** with deployment instructions
- **Visually organized** with emojis and tables
- **Similar to your old repo** but updated for Turborepo stack

Save this as `README.md` in your root directory.[1][2]

[1](https://blog.nashtechglobal.com/monorepo-setup-with-turborepo-the-complete-guide-to-consistent-code-quality/)
[2](https://www.prisma.io/blog/nestjs-prisma-rest-api-7D056s1BmOL0)
[3](https://github.com)
[4](https://github.com/zahidkhandev)
```
