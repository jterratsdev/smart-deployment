# SF Smart Deployment Plugin - Development

This directory contains the base files for developing the `@salesforce/plugin-smart-deployment` plugin.

## 📁 Current Structure

```
smart-deployment/
├── docs/                                        # Comprehensive documentation (29 files)
│   ├── architecture/                            # Architecture documentation
│   ├── guides/                                  # Implementation guides
│   ├── methodology/                             # Development methodologies
│   ├── proposals/                               # Project proposals
│   ├── USER_STORIES.md                          # 90 user stories catalog
│   ├── CI_CD_DEPLOYMENT.md                      # CI/CD deployment guide
│   ├── PROVISIONING_CI_CD.md                    # Data provisioning guide
│   └── ... (see docs/README.md for full index)
├── src/
│   ├── commands/smart-deployment/               # CLI commands
│   ├── services/                                # Operations
│   ├── scanner/                                 # Metadata/project scanning
│   ├── dependencies/                            # Dependency analysis
│   ├── waves/                                   # Wave generation/execution
│   ├── deployment/                              # Deployment orchestration
│   ├── utils/                                   # Helpers
│   ├── types/                                   # Type definitions
│   └── constants/                               # Configuration
├── test/
│   ├── unit/                                    # Unit tests (TDD)
│   ├── integration/                             # Integration tests
│   └── helpers/                                 # Test helpers
└── README.md                                     # This file
```

## ✅ Implementation Progress

### Current Status: Phase 4-6 (Waves, Deployment, Testing)

The project has progressed significantly beyond Phase 1. Major features implemented:

**✅ Completed Phases:**

- **Phase 1**: Foundation (Constants, Types, Utils) - ✅ Complete
- **Phase 2**: Metadata Parsers (15+ parsers) - ✅ Complete
- **Phase 3**: Dependency Analysis - ✅ Complete
- **Phase 4**: Wave Generation - ✅ Complete
- **Phase 5**: Project Scanning - ✅ Complete
- **Phase 6**: Deployment Execution - ✅ In Progress

**📊 Key Metrics:**

- **Commands**: 6 CLI commands implemented (`analyze`, `start`, `validate`, `status`, `resume`, `config`)
- **Parsers**: 17+ metadata parsers (Apex, Flow, LWC, Custom Objects, etc.)
- **Waves**: Complete wave generation system with splitting, merging, validation
- **Deployment**: Manifest generation, SF CLI integration, state management
- **Tests**: The local suite passes; E2E-style checks run through shell scripts.

## 🎯 Current Implementation

### 1. ✅ Constants & Types

```bash
src/constants/
├── ✅ salesforce-limits.ts      # API limits and constraints
├── ✅ deployment-order.ts       # 78 metadata types prioritized
└── ✅ api-version.ts            # API version governance

src/types/
├── ✅ metadata.ts               # Metadata component types
├── ✅ deployment.ts             # Deployment wave types
├── ✅ deployment-plan.ts        # CI/CD plan types
└── ✅ salesforce/               # Salesforce-specific types
```

### 2. ✅ Utilities

```bash
src/utils/
├── ✅ functional.ts             # pipe, compose, curry, memoize
├── ✅ graph-algorithms.ts       # topological sort, cycle detection
├── ✅ file-system.ts            # File system operations
├── ✅ xml.ts                    # XML parsing/generation
├── ✅ string.ts                 # String utilities
├── ✅ cache-manager.ts          # Caching utilities
├── ✅ logger.ts                 # Structured logging
└── ✅ error-aggregator.ts       # Error collection
```

### 3. ✅ Metadata Parsers (17+ parsers)

```bash
src/services/ and src/scanner/
├── ✅ metadata-scanner-service.ts
├── ✅ metadata-format-scanner.ts
├── ✅ custom-structure-scanner.ts
├── ✅ project-validator.ts
└── ... (metadata parsing and scanning logic)
```

### 4. ✅ Dependency Analysis

```bash
src/dependencies/
├── ✅ dependency-graph-builder.ts
├── ✅ dependency-resolver.ts
├── ✅ circular-dependency-detector.ts
├── ✅ dependency-depth-calculator.ts
├── ✅ dependency-impact-analyzer.ts
├── ✅ dependency-validator.ts
├── ✅ dependency-merger.ts
├── ✅ dependency-cache.ts
├── ✅ graph-visualizer.ts
└── ✅ heuristic-inference.ts
```

### 5. ✅ Wave Generation

```bash
src/waves/
├── ✅ wave-builder.ts            # Core wave generation
├── ✅ wave-splitter.ts           # Split large waves
├── ✅ wave-merger.ts             # Merge small waves
├── ✅ wave-validator.ts          # Validate wave integrity
├── ✅ wave-executor.ts           # Execute waves in order
├── ✅ priority-wave-generator.ts # Priority-based waves
├── ✅ test-optimizer.ts          # Test optimization
├── ✅ wave-metadata-generator.ts # Wave metadata
└── ✅ wave-diff-generator.ts     # Wave comparison
```

### 6. ✅ Project Scanning

```bash
src/scanner/
├── ✅ metadata-scanner-service.ts
├── ✅ sfdx-project-detector.ts
├── ✅ forceignore-parser.ts
├── ✅ structure-validator.ts
├── ✅ project-validator.ts
├── ✅ metadata-format-scanner.ts
├── ✅ custom-structure-scanner.ts
└── ✅ monorepo-scanner.ts
```

### 7. ✅ Deployment Execution

```bash
src/deployment/
├── ✅ sf-cli-integration.ts      # SF CLI integration
├── ✅ manifest-generator.ts      # package.xml generation
├── ✅ manifest-validator.ts     # Manifest validation
├── ✅ metadata-type-mapper.ts    # Type mapping
├── ✅ state-manager.ts           # Deployment state
├── ✅ deployment-tracker.ts      # Progress tracking
├── ✅ deployment-error-handler.ts # Error handling
├── ✅ retry-handler.ts           # Retry logic
├── ✅ test-executor.ts           # Test execution
└── ✅ deployment-reporter.ts     # Reporting
```

### 8. ✅ CLI Commands

```bash
src/commands/
├── ✅ analyze.ts                 # Analyze metadata and generate waves
├── ✅ start.ts                   # Start deployment
├── ✅ validate.ts                # Validate deployment
├── ✅ status.ts                  # Check deployment status
├── ✅ resume.ts                  # Resume failed deployment
└── ✅ config.ts                  # Configuration management
```

### 10. Testing

**Framework**: Mocha (run through `nyc mocha`); Jest and Cucumber are not configured.

```bash
yarn test                   # Unit tests
yarn test:nuts              # Salesforce integration/NUT tests
# E2E-style checks are shell scripts, not part of yarn test
```

**Test Coverage**:

- **Full local test suite**: Passing
- **Unit Tests**: Comprehensive coverage for all modules
- **E2E-style checks**: `scripts/e2e-test.sh` and `scripts/e2e-test-grg.sh`. No specs currently exist under `test/e2e/`.
- **Coverage**: High coverage across parsers, services, and commands

### 8. Publication

```bash
npm publish --access public
```

---

## 🏗️ Architecture

The plugin follows a **layered architecture** with functional programming principles:

```
Commands → Core → Services → Parsers → Utils
     ↓                ↓
Generators      Metadata validation
```

### Key Principles

- **Functional Programming**: Pure functions, immutability, composition
- **Modularity**: Small, testable, reusable components
- **Type Safety**: Strict TypeScript
- **Project Agnostic**: Works with any Salesforce project structure

---

## 🔑 Key Concepts

### Hardcoded Limits (NOT user-configurable)

- **Max components per wave**: 300 (avoids UNKNOWN_EXCEPTION)
- **Max CMT records per wave**: 200 (proven SF limit)
- **Max files per deployment**: ~400-500 (API limit)

These should NOT be public flags - they are technical Salesforce limits.

### Metadata Type Mapping

The analyzer must use exact names expected by SF CLI in package.xml:

- `Translations` (not `Translation`)
- `CustomNotificationType` (not `NotificationType`)
- `Settings` (not `OrgSettings`)
- Documents: `FolderName/DocumentName`
- DigitalExperienceBundle: `site/SiteName`

---

## 🧪 Testing Strategy

### Test Coverage Goals

| Layer      | Unit Tests | Integration Tests | E2E Tests | Coverage Goal |
| ---------- | ---------- | ----------------- | --------- | ------------- |
| Utils      | 61         | 0                 | 0         | 100%          |
| Parsers    | 100        | 5                 | 0         | 95%           |
| Services   | 57         | 10                | 3         | 90%           |
| Core       | 22         | 8                 | 5         | 90%           |
| Generators | 14         | 2                 | 0         | 95%           |
| Commands   | 0          | 5                 | 28        | 85%           |
| **TOTAL**  | **254**    | **30**            | **36**    | **92%**       |

**Total Tests: 320**

### Testing Approaches

- **TDD (Test-Driven Development)**: Write tests before implementation
- **BDD (Behavior-Driven Development)**: User-centric scenarios with Gherkin
- **EDD (Error-Driven Development)**: Negative scenarios and error handling

---

## 📚 References

- [Salesforce CLI Plugin Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_plugins.meta/sfdx_cli_plugins/)
- [Salesforce Metadata API](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/)
- [OCLIF Framework](https://oclif.io/)

---

## 🎓 Key Learnings

1. **Component vs File count**: Some components generate multiple files (CustomObject with fields)
2. **CMT limits**: CustomMetadataRecords have lower limits than general metadata
3. **Path formatting**: Documents and DigitalExperience require full path in member name
4. **Test optimization**: Running tests only in waves with Apex/Flow saves 40-60% time
5. **Fail-fast vs retry**: Production = fail-fast, Sandbox = retry without tests

---

## 📊 Project Status

**Status**: 🟢 Active Development (Phase 4-6)
**Owner**: @jterrats
**Created**: Dec 1, 2025
**Language**: TypeScript
**Framework**: OCLIF (Salesforce CLI Plugin Framework)
**Testing**: Mocha + Chai
**CI/CD**: ✅ GitHub Actions (Active)

- Unit tests on push
- Acceptance criteria validation on PRs
- Automated testing workflows

---

## 🚀 Quick Start

```bash
# Clone repository
git clone git@github.com:jterrats/smart-deployment.git
cd smart-deployment

# Install dependencies
yarn install

# Build plugin
yarn build

# Link plugin to SF CLI
sf plugins link .

# Run command
sf smart-deployment start --help
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Read the architecture documentation in `docs/`
2. Follow TDD/BDD/EDD testing approaches
3. Maintain test coverage >90%
4. Use functional programming principles
5. Add documentation for new features

---

## 📝 License

MIT License - see LICENSE file for details
