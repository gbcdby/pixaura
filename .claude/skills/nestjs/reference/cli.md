# Nest CLI

The Nest CLI is a command-line interface tool that helps initialize, develop, and maintain Nest applications.

## Installation

```bash
# Install CLI globally
npm install -g @nestjs/cli

# Or use with npx
npx @nestjs/cli@latest <command>
```

## Project Commands

### Create New Project

```bash
# Create backend app in apps folder
cd apps
nest new api --strict --package-manager npm
```

### Build Project

```bash
# Build api only
pnpm --filter @myapp/api build

# Build all packages
pnpm -r build

# Build with watch mode
pnpm --filter @myapp/api dev
```

### Start Application

```bash
# Development mode
pnpm --filter @myapp/api dev

# Production mode
pnpm --filter @myapp/api start:prod
```

## Generate Commands

### Generate in API App

```bash
# Navigate to api app
cd apps/api

# Generate module
nest g module cats
nest g mo cats

# Generate controller
nest g controller cats
nest g co cats

# Generate service
nest g service cats
nest g s cats

# Full CRUD resource
nest g resource cats
nest g res cats

# Other generators
nest g guard auth
nest g interceptor logging
nest g pipe validation
nest g filter http-exception
nest g middleware logger
nest g decorator user
nest g gateway chat
nest g resolver cats
```

### Generate Options

```bash
# Skip spec files
nest g controller cats --no-spec

# Dry run
nest g controller cats --dry-run

# Flat structure
nest g controller cats --flat

# Specify path
nest g controller api/v1/cats
```

## Resource Generator

The resource generator creates a complete CRUD resource:

```bash
nest g resource cats
```

This generates:
- `cats.controller.ts` - Controller with CRUD routes
- `cats.service.ts` - Service with CRUD methods
- `cats.module.ts` - Module definition
- `cats.controller.spec.ts` - Controller tests
- `cats.service.spec.ts` - Service tests

**Note**: DTOs are NOT generated - import from `@myapp/shared-types` instead.

## Monorepo Commands

### Convert to Monorepo

```bash
# Generate application in monorepo
cd apps/api
nest generate app api
nest generate app worker

# Generate library
nest generate lib shared
```

### pnpm Monorepo Structure

```
my-project/
├── apps/
│   ├── api/              # NestJS API
│   └── worker/           # Background worker
├── packages/
│   └── shared-types/     # Shared Zod schemas
├── package.json
└── pnpm-workspace.yaml
```

### Build in Monorepo

```bash
# Build specific app
pnpm --filter @myapp/api exec nest build api
```

## pnpm Commands Reference

### Install Dependencies

```bash
# Install all dependencies
pnpm install

# Add dependency to api
pnpm --filter @myapp/api add lodash

# Add dev dependency to api
pnpm --filter @myapp/api add -D @types/lodash

# Add workspace dependency
pnpm --filter @myapp/api add @myapp/shared-types
```

### Run Scripts

```bash
# Run dev script in api
pnpm --filter @myapp/api dev

# Run all dev scripts in parallel
pnpm -r --parallel dev

# Run build in all packages
pnpm -r build

# Run tests in all packages
pnpm -r test
```

### Filter Commands

```bash
# Filter by package name
pnpm --filter @myapp/api <command>

# Filter by directory
pnpm --filter ./apps/api <command>

# Filter multiple packages
pnpm --filter @myapp/api --filter @myapp/shared-types <command>
```

## Other Commands

### Add Library

```bash
# Add NestJS library
cd apps/api
nest add @nestjs/graphql
nest add @nestjs/typeorm
nest add @nestjs/mongoose
```

### Update Dependencies

```bash
# Update NestJS packages
pnpm --filter @myapp/api exec nest update

# Update with latest
pnpm --filter @myapp/api exec nest update --force
```

### Info

```bash
# Display project information
pnpm --filter @myapp/api exec nest info
```

## Package Scripts

```json
// apps/api/package.json
{
  "name": "@myapp/api",
  "scripts": {
    "prebuild": "rimraf dist",
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "nest start",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix"
  }
}
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `nest new <name>` | Create new project |
| `nest build` | Build application |
| `nest start` | Start application |
| `nest start --watch` | Start with hot reload |
| `nest g module <name>` | Generate module |
| `nest g controller <name>` | Generate controller |
| `nest g service <name>` | Generate service |
| `nest g resource <name>` | Generate full CRUD resource |
| `nest g guard <name>` | Generate guard |
| `nest g interceptor <name>` | Generate interceptor |
| `nest g pipe <name>` | Generate pipe |
| `nest g filter <name>` | Generate filter |
| `nest g middleware <name>` | Generate middleware |
| `nest g decorator <name>` | Generate decorator |
| `nest add <library>` | Add library |
| `nest update` | Update dependencies |
| `nest info` | Project information |

## pnpm-specific Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm --filter <pkg> add <dep>` | Add dependency to package |
| `pnpm --filter <pkg> dev` | Run dev script |
| `pnpm -r build` | Build all packages |
| `pnpm -r --parallel dev` | Run all dev scripts |
