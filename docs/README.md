# 📚 Documentation

Welcome to the Smart Deployment Plugin documentation. This directory contains comprehensive guides, architecture diagrams, and methodology descriptions.

## 📁 Documentation Structure

### 🏗️ Architecture (`/architecture`)

Technical architecture and design patterns:

- **[ARCHITECTURE.md](architecture/ARCHITECTURE.md)** - Layered architecture design with functional programming principles
- **[CLI_ARCHITECTURE.md](architecture/CLI_ARCHITECTURE.md)** - CLI command structure and oclif integration
- **[METADATA_EXTENSIBILITY.md](architecture/METADATA_EXTENSIBILITY.md)** - Flexible metadata parsing architecture
- **[PROJECT_AGNOSTIC_DESIGN.md](architecture/PROJECT_AGNOSTIC_DESIGN.md)** - Structure-agnostic project scanning approach

### 📖 Guides (`/guides`)

Implementation guides and integration documentation:

- **[AGENTFORCE_INTEGRATION.md](guides/AGENTFORCE_INTEGRATION.md)** - AI-powered dependency inference with Salesforce LLM
- **[AGENTFORCE_TOKEN_LIMITS.md](guides/AGENTFORCE_TOKEN_LIMITS.md)** - Token usage and limits guide
- **[ACCEPTANCE_CRITERIA_TESTING.md](guides/ACCEPTANCE_CRITERIA_TESTING.md)** - Acceptance criteria validation workflow
- **[GITHUB_SETUP.md](guides/GITHUB_SETUP.md)** - GitHub Actions setup guide
- **[MEMORY_VS_API_COSTS.md](guides/MEMORY_VS_API_COSTS.md)** - Cost analysis for AI models
- **[SELF_LEARNING_ANALYZER.md](guides/SELF_LEARNING_ANALYZER.md)** - Self-learning dependency analyzer workflow

### 🧪 Methodology (`/methodology`)

Testing approaches and development methodologies:

- **[TESTING_STRATEGY.md](methodology/TESTING_STRATEGY.md)** - Comprehensive TDD & BDD testing strategy
- **[ERROR_DRIVEN_DEVELOPMENT.md](methodology/ERROR_DRIVEN_DEVELOPMENT.md)** - EDD methodology for error-first development

### 💡 Proposals (`/proposals`)

Project proposals and requirements:

- **[SF_SMART_DEPLOYMENT_PLUGIN_PROPOSAL.md](proposals/SF_SMART_DEPLOYMENT_PLUGIN_PROPOSAL.md)** - Complete plugin proposal and vision

### 📋 Core Documentation

Essential project documentation:

- **[USER_STORIES.md](USER_STORIES.md)** - Complete user story catalog (90 stories)
- **[TODO_MAPPING.md](TODO_MAPPING.md)** - TODO to User Story mapping
- **[DOCUMENTATION_STATUS.md](DOCUMENTATION_STATUS.md)** - Documentation status and maintenance guide

### 🚀 Deployment & CI/CD

Deployment and CI/CD documentation:

- **[CI_CD_DEPLOYMENT.md](CI_CD_DEPLOYMENT.md)** - Plan-based CI/CD deployment strategy
- **[PROVISIONING_CI_CD.md](PROVISIONING_CI_CD.md)** - Data provisioning in CI/CD pipelines
- **[CI_CD_OPTIMIZATION.md](CI_CD_OPTIMIZATION.md)** - CI/CD optimization strategy

### 🤖 AI Integration

Agentforce and AI integration guides:

- **[AGENTFORCE_API_KEY_SETUP.md](AGENTFORCE_API_KEY_SETUP.md)** - Agentforce authentication and setup
- **[AI_AUTO_APPLY.md](AI_AUTO_APPLY.md)** - AI auto-apply feature documentation

### 🛡️ Error Handling

Error handling documentation:

- **[ERROR_HANDLING_INTEGRATION.md](ERROR_HANDLING_INTEGRATION.md)** - Error handling patterns, integration, and implementation status
- **[ERROR_CATALOG.md](ERROR_CATALOG.md)** - Comprehensive error reference catalog
- **[ERROR_HANDLING_STATUS.md](ERROR_HANDLING_STATUS.md)** - ⚠️ Deprecated (consolidated into ERROR_HANDLING_INTEGRATION.md)

### 🧪 Testing

Testing documentation:

- **[TESTING_SUMMARY.md](TESTING_SUMMARY.md)** - Current test coverage and status
- **[E2E_COVERAGE_ANALYSIS.md](E2E_COVERAGE_ANALYSIS.md)** - End-to-end test coverage analysis

### 🏛️ Architecture Decisions

Architecture decision records:

- **[ARCHITECTURE_DECISION_STATE_MANAGER_V2.md](ARCHITECTURE_DECISION_STATE_MANAGER_V2.md)** - State manager architecture decision (current)
- **[ARCHITECTURE_DECISION_STATE_MANAGER.md](archive/ARCHITECTURE_DECISION_STATE_MANAGER.md)** - ⚠️ Deprecated (superseded by V2)

### 🔒 Safety & Quality

Safety and quality guidelines:

- **[PARSER_SAFETY.md](PARSER_SAFETY.md)** - Safe parsing practices and guidelines

---

## 🚀 Quick Links

### For Developers

- [Get Started with Architecture](architecture/ARCHITECTURE.md)
- [Testing Strategy](methodology/TESTING_STRATEGY.md)
- [Error Handling Patterns](methodology/ERROR_DRIVEN_DEVELOPMENT.md)
- [CLI Architecture](architecture/CLI_ARCHITECTURE.md)
- [Parser Safety Guidelines](PARSER_SAFETY.md)
- [CLI Reference](CLI_REFERENCE.md) - Complete command reference
- [API Reference](API_REFERENCE.md) - TypeScript API documentation

### For Product Managers

- [Plugin Proposal](proposals/SF_SMART_DEPLOYMENT_PLUGIN_PROPOSAL.md)
- [User Stories Catalog](USER_STORIES.md)
- [Agentforce Integration](guides/AGENTFORCE_INTEGRATION.md)
- [Documentation Status](DOCUMENTATION_STATUS.md)
- [User Guide](USER_GUIDE.md) - End-user documentation

### For DevOps Engineers

- [CI/CD Deployment Guide](CI_CD_DEPLOYMENT.md)
- [Provisioning in CI/CD](PROVISIONING_CI_CD.md)
- [CI/CD Optimization](CI_CD_OPTIMIZATION.md)
- [Configuration Guide](CONFIGURATION_GUIDE.md) - Configuration options
- [Project Agnostic Design](architecture/PROJECT_AGNOSTIC_DESIGN.md)
- [Self-Learning Analyzer](guides/SELF_LEARNING_ANALYZER.md)

### For QA Engineers

- [Testing Summary](TESTING_SUMMARY.md)
- [E2E Coverage Analysis](E2E_COVERAGE_ANALYSIS.md)
- [Acceptance Criteria Testing](guides/ACCEPTANCE_CRITERIA_TESTING.md)

### For End Users

- [User Guide](USER_GUIDE.md) - Getting started guide
- [CLI Reference](CLI_REFERENCE.md) - Complete command reference
- [Configuration Guide](CONFIGURATION_GUIDE.md) - Configuration options
- [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md) - Common issues and solutions
- [Deployment Best Practices](DEPLOYMENT_BEST_PRACTICES.md) - Best practices
- [Performance Tuning Guide](PERFORMANCE_TUNING_GUIDE.md) - Performance optimization
- [Security Guide](SECURITY_GUIDE.md) - Security best practices

---

## 📊 Documentation Standards

All documentation in this repository follows these standards:

- **Language**: English
- **Format**: Markdown
- **Diagrams**: Mermaid (when applicable)
- **Code Examples**: TypeScript/JavaScript
- **Structure**: Clear headings with emojis for visual hierarchy

---

## 🤝 Contributing to Documentation

When adding new documentation:

1. Place it in the appropriate subdirectory
2. Follow the existing markdown style
3. Include code examples where relevant
4. Add diagrams using Mermaid syntax
5. Update this README with links to new docs
6. Ensure grammar and spelling are correct

---

## 📝 Documentation Roadmap

### Phase 1: Foundation ✅

- [x] Architecture design
- [x] Testing strategy
- [x] Agentforce integration
- [x] Project structure design

### Phase 2: Implementation Guides ✅

- [x] Agentforce integration guide
- [x] CI/CD deployment guide
- [x] Error handling integration guide
- [x] Testing strategy guide
- [x] Acceptance criteria testing guide
- [ ] Parser implementation guide (planned)
- [ ] Deployment orchestration guide (planned)
- [ ] Error handling cookbook (planned)

### Phase 3: User Documentation ✅

- [x] [User Guide](USER_GUIDE.md) - Complete user guide
- [x] [CLI Reference](CLI_REFERENCE.md) - Complete command reference
- [x] [Configuration Guide](CONFIGURATION_GUIDE.md) - Configuration options
- [x] [Troubleshooting Guide](TROUBLESHOOTING_GUIDE.md) - Common issues and solutions

---

**Last Updated**: December 14, 2025
**Status**: Active Development
