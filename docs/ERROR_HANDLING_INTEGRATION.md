# 🛡️ Error Handling Integration Guide

## 📋 Overview

Esta guía documenta cómo integrar el error handling en nuevos features desde el inicio del desarrollo.

## ✅ Infraestructura Existente

### 1. Base Error Classes (✅ Implementado)

```typescript
// src/errors/base-error.ts
SmartDeploymentError  // Base for all errors
├── DependencyError   // Dependency errors
├── DeploymentError   // Deployment errors
├── ParsingError      // Parsing errors
└── ValidationError   // Validation errors
```

**Uso:**
```typescript
import { ParsingError } from '../errors/parsing-error.js';

throw new ParsingError({
  file: 'MyClass.cls',
  line: 42,
  message: 'Unexpected token',
  originalError: error,
  suggestions: ['Check syntax', 'Ensure valid Apex code']
});
```

### 2. Error Aggregator (✅ US-076)

```typescript
import { ErrorAggregator } from '../utils/error-aggregator.js';

const aggregator = new ErrorAggregator();

// Agregar errores
aggregator.addError({
  severity: 'error',
  category: 'parsing',
  message: 'Failed to parse file',
  context: { file: 'MyClass.cls' }
});

// Generar reporte
const report = aggregator.generateReport();
console.log(report.formatted);
```

### 3. Error Resilient Parser (✅ US-071)

```typescript
import { ErrorResilientParser } from '../parsers/error-resilient-parser.js';

const parser = new ErrorResilientParser();

// Parse con error handling automático
const result = await parser.parseWithResilience(
  files,
  async (file) => await parseFile(file)
);

// result.errors contiene todos los errores encontrados
// result.successful contiene archivos parseados exitosamente
```

### 4. Retry Handler (✅ US-088)

```typescript
import { RetryHandler } from '../deployment/retry-handler.js';

const retryHandler = new RetryHandler({
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000
});

const result = await retryHandler.executeWithRetry(
  async () => await deployComponent(component),
  'deploy-component'
);
```

### 5. Circuit Breaker (✅ US-060)

```typescript
import { CircuitBreaker } from '../ai/circuit-breaker.js';

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  timeout: 60000
});

const result = await breaker.execute(
  async () => await aiService.analyze(),
  () => staticAnalysis() // Fallback
);
```

### 6. Logger (✅ Implementado)

```typescript
import { getLogger } from '../utils/logger.js';

const logger = getLogger('MyService');

logger.info('Operation started');
logger.warn('Potential issue', { context: data });
logger.error('Operation failed', { error });
```

---

## 🎯 Patrones de Integración

### Pattern 1: Feature con Parse Errors

```typescript
import { ErrorResilientParser } from '../parsers/error-resilient-parser.js';
import { ParsingError } from '../errors/parsing-error.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('MyFeature');

export class MyFeature {
  private readonly parser = new ErrorResilientParser();

  async processFiles(files: string[]): Promise<Result> {
    const result = await this.parser.parseWithResilience(
      files,
      async (file) => {
        try {
          return await this.parseFile(file);
        } catch (error) {
          throw new ParsingError({
            file,
            message: 'Parse failed',
            originalError: error instanceof Error ? error : undefined,
            suggestions: ['Check file syntax', 'Ensure valid format']
          });
        }
      }
    );

    // Log errores pero continuar
    if (result.errors.length > 0) {
      logger.warn(`Parsed with errors: ${result.errors.length}`);
    }

    return result;
  }
}
```

### Pattern 2: Feature con Network Calls

```typescript
import { RetryHandler } from '../deployment/retry-handler.js';
import { CircuitBreaker } from '../ai/circuit-breaker.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('NetworkFeature');

export class NetworkFeature {
  private readonly retryHandler = new RetryHandler();
  private readonly breaker = new CircuitBreaker();

  async fetchData(url: string): Promise<Data> {
    return this.breaker.execute(
      async () => {
        return this.retryHandler.executeWithRetry(
          async () => {
            try {
              return await fetch(url);
            } catch (error) {
              // Log y re-throw para retry
              logger.warn('Fetch failed, will retry', { url, error });
              throw error;
            }
          },
          `fetch-${url}`
        );
      },
      () => this.getFallbackData() // Circuit breaker fallback
    );
  }

  private getFallbackData(): Data {
    logger.info('Using fallback data');
    return { /* cached/default data */ };
  }
}
```

### Pattern 3: Feature con AI Calls

```typescript
import { CircuitBreaker } from '../ai/circuit-breaker.js';
import { AgentforceService } from '../ai/agentforce-service.js';
import { ErrorAggregator } from '../utils/error-aggregator.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('AIFeature');

export class AIFeature {
  private readonly aiService: AgentforceService;
  private readonly breaker = new CircuitBreaker();
  private readonly errorAggregator = new ErrorAggregator();

  async analyze(components: Component[]): Promise<Result> {
    // Try AI with circuit breaker
    return this.breaker.execute(
      async () => {
        try {
          const result = await this.aiService.sendRequest({
            prompt: this.buildPrompt(components),
            model: 'gpt-4',
          });
          return this.parseAIResult(result);
        } catch (error) {
          this.errorAggregator.addError({
            severity: 'warning',
            category: 'ai',
            message: 'AI analysis failed',
            context: { error }
          });
          throw error; // Let circuit breaker handle
        }
      },
      () => {
        logger.warn('AI unavailable, using static analysis');
        return this.staticAnalysis(components);
      }
    );
  }

  private staticAnalysis(components: Component[]): Result {
    // Fallback implementation
    return { /* static analysis result */ };
  }
}
```

### Pattern 4: Feature with Validation

```typescript
import { ValidationError } from '../errors/validation-error.js';
import { ErrorAggregator } from '../utils/error-aggregator.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('ValidationFeature');

export class ValidationFeature {
  private readonly errorAggregator = new ErrorAggregator();

  validate(data: Data): ValidationResult {
    const errors: ValidationError[] = [];

    // Validation 1
    if (!data.required) {
      const error = new ValidationError({
        message: 'Missing required field',
        field: 'required',
        value: data.required,
        suggestions: ['Add required field', 'Check documentation']
      });
      errors.push(error);
      this.errorAggregator.addError({
        severity: 'error',
        category: 'validation',
        message: error.message,
        context: error.context
      });
    }

    // Validation 2
    if (data.value < 0) {
      const error = new ValidationError({
        message: 'Value must be positive',
        field: 'value',
        value: data.value,
        suggestions: ['Use positive number']
      });
      errors.push(error);
      this.errorAggregator.addError({
        severity: 'error',
        category: 'validation',
        message: error.message,
        context: error.context
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      report: this.errorAggregator.generateReport()
    };
  }
}
```

### Pattern 5: Feature con Deployment

```typescript
import { DeploymentError } from '../errors/deployment-error.js';
import { RetryHandler } from '../deployment/retry-handler.js';
import { ErrorAggregator } from '../utils/error-aggregator.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('DeploymentFeature');

export class DeploymentFeature {
  private readonly retryHandler = new RetryHandler();
  private readonly errorAggregator = new ErrorAggregator();

  async deploy(components: Component[]): Promise<DeploymentResult> {
    try {
      return await this.retryHandler.executeWithRetry(
        async () => {
          const result = await this.executeDeploy(components);

          if (!result.success) {
            throw new DeploymentError({
              message: 'Deployment failed',
              componentsFailed: result.failed,
              originalError: result.error,
              suggestions: [
                'Check component dependencies',
                'Review Salesforce limits',
                'Verify permissions'
              ]
            });
          }

          return result;
        },
        'deploy-components'
      );
    } catch (error) {
      // Add to error aggregator
      this.errorAggregator.addError({
        severity: 'error',
        category: 'deployment',
        message: 'Deployment failed after retries',
        context: {
          components: components.length,
          error: error instanceof Error ? error.message : String(error)
        }
      });

      // Re-throw con contexto
      if (error instanceof DeploymentError) {
        throw error;
      }

      throw new DeploymentError({
        message: 'Unexpected deployment error',
        originalError: error instanceof Error ? error : undefined,
        suggestions: ['Check logs', 'Review error details']
      });
    }
  }
}
```

---

## 📝 Checklist for New Features

Before implementing a new feature, ensure:

### 1. Planning Phase
- [ ] Identify possible errors (use EDD - Error-Driven Development)
- [ ] Define fallback strategy (if applicable)
- [ ] Decide if retry logic is needed
- [ ] Decide if circuit breaker is needed
- [ ] Plan logging strategy

### 2. Implementation Phase
- [ ] Import appropriate error classes
- [ ] Use `ErrorAggregator` to collect errors
- [ ] Use `ErrorResilientParser` for parsing
- [ ] Use `RetryHandler` for operations with possible transient failures
- [ ] Use `CircuitBreaker` for external services (AI, APIs)
- [ ] Add logging with context (`getLogger`)
- [ ] Throw custom errors with suggestions
- [ ] Implement fallbacks when possible

### 3. Testing Phase
- [ ] Test happy path
- [ ] Test error scenarios (EDD)
- [ ] Test retry logic
- [ ] Test circuit breaker behavior
- [ ] Test fallback functionality
- [ ] Test error messages are user-friendly
- [ ] Verify error path coverage (>90%)

---

## 🚨 Pending Errors to Implement

### US-072: Network Error Handling
**Status**: Partially implemented (RetryHandler exists)
**Missing**:
- Network-specific error detection
- Improved timeout handling
- User-friendly network error messages

### US-073: Agentforce Error Handling
**Status**: Partially implemented (CircuitBreaker exists)
**Missing**:
- Integration with AgentforceService
- AI usage statistics reporting
- Better fallback strategies

### US-074: Deployment Error Handling
**Status**: Partially implemented (DeploymentError + RetryHandler)
**Missing**:
- Save/restore deployment state
- Resume from failure logic
- Different retry strategies

### US-075: Validation Error Reporting
**Status**: Implemented (ValidationError)
**Missing**:
- Link to documentation
- Better severity categorization

### US-077: Error Documentation
**Status**: Not implemented
**Needs**:
- Error code catalog
- Troubleshooting guide
- Recovery procedures

### US-078: Error Analytics
**Status**: Not implemented
**Needs**:
- Error metrics tracking
- Trending analysis
- Dashboard/reporting

---

## 📊 Implementation Status

### ✅ Completed

| Issue | Title | Status | Files |
|-------|-------|--------|-------|
| **US-071** | Parse Error Handling | ✅ DONE | `error-resilient-parser.ts` |
| **US-076** | Error Logging | ✅ DONE | `error-aggregator.ts`, `logger.ts` |
| **US-088** | Retry Logic | ✅ DONE | `retry-handler.ts` |
| **US-060** | Circuit Breaker | ✅ DONE | `circuit-breaker.ts` |

### 🟡 Partially Implemented

| Issue | Title | Status | Coverage |
|-------|-------|--------|----------|
| **US-072** | Network Error Handling | 🟡 Partial | 60% |
| **US-073** | Agentforce Error Handling | 🟡 Partial | 70% |
| **US-074** | Deployment Error Handling | 🟡 Partial | 75% |
| **US-075** | Validation Error Reporting | 🟡 Partial | 90% |

### ❌ Not Implemented

| Issue | Title | Status |
|-------|-------|--------|
| **US-077** | Error Documentation | ❌ Not started |
| **US-078** | Error Analytics | ❌ Not started |

### Overall Coverage: 65%

**Goal**: Reach 90%+ coverage for better resilience and UX.

---

## 📦 Existing Infrastructure

### Error Classes
```
src/errors/
├── base-error.ts          ✅ Base class
├── dependency-error.ts    ✅ Dependency errors
├── deployment-error.ts    ✅ Deployment errors
├── parsing-error.ts       ✅ Parse errors
├── validation-error.ts    ✅ Validation errors
└── index.ts              ✅ Exports
```

### Error Utilities
```
src/utils/
├── error-aggregator.ts    ✅ Error collection & reporting
└── logger.ts             ✅ Structured logging
```

### Error Handling Components
```
src/parsers/
└── error-resilient-parser.ts  ✅ Resilient parsing

src/deployment/
├── retry-handler.ts          ✅ Retry with backoff
└── state-manager.ts          ✅ State persistence

src/ai/
└── circuit-breaker.ts        ✅ Circuit breaker pattern
```

---

## 💡 Best Practices

1. **Always use custom errors**: Don't use `throw new Error()`, use specific error classes
2. **Add context**: Include useful information for debugging
3. **Include suggestions**: Help users resolve the problem
4. **Log appropriately**:
   - `debug`: Development information
   - `info`: Normal flow
   - `warn`: Non-critical issues
   - `error`: Critical issues
5. **Fail gracefully**: Always have a fallback when possible
6. **Test error paths**: Coverage >90% includes error paths
7. **User-friendly messages**: Errores técnicos → mensajes claros

---

## 🔗 Referencias

- `docs/methodology/ERROR_DRIVEN_DEVELOPMENT.md` - Metodología EDD
- `src/errors/` - Error classes
- `src/utils/error-aggregator.ts` - Error aggregation
- `src/parsers/error-resilient-parser.ts` - Resilient parsing
- `src/deployment/retry-handler.ts` - Retry logic
- `src/ai/circuit-breaker.ts` - Circuit breaker pattern

---

## 📞 Support

If you have questions about error handling:
1. Review this guide
2. Review [Error-Driven Development](./methodology/ERROR_DRIVEN_DEVELOPMENT.md)
3. Search for examples in the codebase
4. Consult error handling unit tests
5. Check [Error Catalog](./ERROR_CATALOG.md) for specific error codes

---

## 📚 Related Documentation

- [Error Catalog](./ERROR_CATALOG.md) - Complete error reference
- [Error-Driven Development](./methodology/ERROR_DRIVEN_DEVELOPMENT.md) - EDD methodology
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md) - Common issues and solutions

