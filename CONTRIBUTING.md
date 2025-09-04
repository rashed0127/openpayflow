# Contributing to OpenPayFlow

Thank you for your interest in contributing to OpenPayFlow! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Contributing Guidelines](#contributing-guidelines)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm 8.15.0+
- Docker and Docker Compose
- Git

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/openpayflow.git
   cd openpayflow
   git remote add upstream https://github.com/ORIGINAL_REPO/openpayflow.git
   ```

## Development Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Configuration

```bash
cp env.example .env
# Edit .env with your local configuration
```

### 3. Start Services

```bash
make up
```

This will start all services:
- API (Fastify) on port 4000
- Dashboard (Next.js) on port 3000  
- Grafana on port 3001
- PostgreSQL on port 5432
- Redis on port 6379

### 4. Database Setup

```bash
make seed
```

This will create demo data including a merchant and sample payments.

## Project Structure

```
openpayflow/
├── apps/                    # Applications
│   ├── api/                # Fastify API server
│   ├── worker/             # Background job processor
│   └── dashboard/          # Next.js dashboard
├── packages/                # Shared packages
│   ├── common/             # Shared types, constants, utilities
│   └── gateway-core/       # Payment gateway abstraction
├── deploy/                  # Deployment configurations
│   └── docker/             # Docker and Docker Compose files
├── tests/                   # Test files
│   ├── integration/        # Integration tests
│   └── load/               # Load tests (k6)
└── docs/                    # Documentation
```

## Contributing Guidelines

### Types of Contributions

We welcome contributions in many forms:

- **Bug Reports**: Report bugs and issues
- **Feature Requests**: Suggest new features
- **Code Contributions**: Submit pull requests
- **Documentation**: Improve docs and examples
- **Testing**: Add tests or improve test coverage
- **Performance**: Optimize code and improve performance

### Before You Start

1. **Check existing issues**: Search for existing issues or pull requests
2. **Discuss changes**: For major changes, open an issue first to discuss
3. **Keep it focused**: Each PR should address a single concern

### Development Workflow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Follow the code style guidelines
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**:
   ```bash
   pnpm test:unit          # Run unit tests
   pnpm test:integration   # Run integration tests
   pnpm typecheck          # Type checking
   pnpm lint               # Linting
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add new payment gateway support"
   ```

5. **Push and create a PR**:
   ```bash
   git push origin feature/your-feature-name
   ```

## Testing

### Running Tests

```bash
# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration

# Load tests
pnpm test:load

# Test coverage
pnpm test:coverage
```

### Writing Tests

- **Unit tests**: Test individual functions and classes
- **Integration tests**: Test API endpoints and database interactions
- **Load tests**: Test performance under load using k6

### Test Structure

```
src/
├── __tests__/             # Test files
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
└── services/
    └── payment-service.ts
```

## Pull Request Process

### PR Checklist

- [ ] Code follows the project's style guidelines
- [ ] Tests pass locally
- [ ] New tests added for new functionality
- [ ] Documentation updated
- [ ] No breaking changes (or breaking changes documented)
- [ ] Commit messages follow conventional commits format

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(api): add webhook retry mechanism
fix(dashboard): resolve payment status display issue
docs(readme): update installation instructions
```

### Review Process

1. **Automated checks** must pass (CI/CD pipeline)
2. **Code review** from maintainers
3. **Address feedback** and make requested changes
4. **Maintainer approval** required for merge

## Code Style

### TypeScript

- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### ESLint and Prettier

- Code is automatically formatted with Prettier
- ESLint enforces code quality rules
- Run `pnpm lint:fix` to auto-fix issues

### File Naming

- Use kebab-case for files and directories
- Use PascalCase for classes and interfaces
- Use camelCase for variables and functions

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

1. **Clear description** of the problem
2. **Steps to reproduce** the issue
3. **Expected vs actual behavior**
4. **Environment details** (OS, Node.js version, etc.)
5. **Screenshots or logs** if applicable

### Feature Requests

For feature requests:

1. **Clear description** of the feature
2. **Use case** and benefits
3. **Implementation suggestions** if you have any
4. **Mockups or examples** if applicable

## Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Documentation**: Check the README and inline code comments

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Project documentation
- Release notes

Thank you for contributing to OpenPayFlow! 🚀
