# 📋 Documentation Consolidation Plan

**Created**: December 14, 2025
**Purpose**: Identify duplicate or overlapping documentation that should be consolidated

---

## 🔍 Analysis Results

### 1. Agentforce Documentation (5 files) - CONSOLIDATE

**Current Files**:
- `docs/AGENTFORCE_API_KEY_SETUP.md` - Setup and authentication
- `docs/guides/AGENTFORCE_INTEGRATION.md` - General integration guide
- `docs/AI_AUTO_APPLY.md` - AI auto-apply feature
- `docs/guides/AGENTFORCE_TOKEN_LIMITS.md` - Token limits
- `docs/guides/MEMORY_VS_API_COSTS.md` - Cost analysis

**Recommendation**: Consolidate into **`docs/guides/AGENTFORCE_COMPLETE_GUIDE.md`**

**Structure**:
```
AGENTFORCE_COMPLETE_GUIDE.md
├── Overview
├── Authentication & Setup (from AGENTFORCE_API_KEY_SETUP.md)
├── Integration Guide (from AGENTFORCE_INTEGRATION.md)
├── Auto-Apply Feature (from AI_AUTO_APPLY.md)
├── Token Limits & Costs (from AGENTFORCE_TOKEN_LIMITS.md + MEMORY_VS_API_COSTS.md)
└── Best Practices
```

**Action**:
- ✅ Keep `guides/AGENTFORCE_INTEGRATION.md` as main guide
- ✅ Merge `AGENTFORCE_API_KEY_SETUP.md` into it
- ✅ Merge `AI_AUTO_APPLY.md` into it
- ✅ Merge `AGENTFORCE_TOKEN_LIMITS.md` and `MEMORY_VS_API_COSTS.md` into it
- ⚠️ **Status**: Keep separate for now (different audiences), but cross-reference

---

### 2. Error Handling Documentation (4 files) - PARTIAL CONSOLIDATION

**Current Files**:
- `docs/ERROR_HANDLING_INTEGRATION.md` - Integration guide
- `docs/ERROR_HANDLING_STATUS.md` - Implementation status
- `docs/ERROR_CATALOG.md` - Error catalog
- `docs/methodology/ERROR_DRIVEN_DEVELOPMENT.md` - Methodology

**Recommendation**:
- ✅ Keep `ERROR_HANDLING_INTEGRATION.md` (developer guide)
- ✅ Keep `ERROR_CATALOG.md` (reference)
- ✅ Keep `methodology/ERROR_DRIVEN_DEVELOPMENT.md` (methodology)
- ⚠️ **Merge `ERROR_HANDLING_STATUS.md` into `ERROR_HANDLING_INTEGRATION.md`** (status section)

**Action**: Add status section to `ERROR_HANDLING_INTEGRATION.md` and deprecate `ERROR_HANDLING_STATUS.md`

---

### 3. Architecture Decisions (2 files) - CONSOLIDATE

**Current Files**:
- `docs/ARCHITECTURE_DECISION_STATE_MANAGER.md` - Original decision (formal state machine)
- `docs/ARCHITECTURE_DECISION_STATE_MANAGER_V2.md` - Revised decision (simplified)

**Recommendation**:
- ✅ **Keep V2** (current implementation)
- ⚠️ **Archive V1** or add note that V2 supersedes V1

**Action**: Add note to V1 that it's superseded by V2, or move to `docs/archive/`

---

### 4. CI/CD Documentation (3 files) - KEEP SEPARATE ✅

**Current Files**:
- `docs/CI_CD_DEPLOYMENT.md` - Deployment guide
- `docs/CI_CD_OPTIMIZATION.md` - Optimization strategy
- `docs/PROVISIONING_CI_CD.md` - Data provisioning

**Recommendation**: ✅ **Keep separate** - Different topics, different audiences

**Reason**:
- `CI_CD_DEPLOYMENT.md` - General CI/CD guide
- `CI_CD_OPTIMIZATION.md` - Technical optimization details
- `PROVISIONING_CI_CD.md` - Specific feature (provisioning)

---

### 5. Testing Documentation (4 files) - KEEP SEPARATE ✅

**Current Files**:
- `docs/TESTING_SUMMARY.md` - Current test status
- `docs/E2E_COVERAGE_ANALYSIS.md` - E2E coverage analysis
- `docs/methodology/TESTING_STRATEGY.md` - Testing strategy
- `docs/guides/ACCEPTANCE_CRITERIA_TESTING.md` - AC testing workflow

**Recommendation**: ✅ **Keep separate** - Different purposes

**Reason**:
- `TESTING_SUMMARY.md` - Status/metrics
- `E2E_COVERAGE_ANALYSIS.md` - Coverage analysis
- `methodology/TESTING_STRATEGY.md` - Strategy/methodology
- `guides/ACCEPTANCE_CRITERIA_TESTING.md` - Workflow guide

---

## 📊 Consolidation Summary

| Category | Files | Action | Priority |
|----------|-------|--------|----------|
| **Agentforce** | 5 | Cross-reference, keep separate | Low |
| **Error Handling** | 4 | Merge STATUS into INTEGRATION | Medium |
| **Architecture Decisions** | 2 | Archive V1, keep V2 | Medium |
| **CI/CD** | 3 | Keep separate ✅ | N/A |
| **Testing** | 4 | Keep separate ✅ | N/A |

---

## 🎯 Recommended Actions

### High Priority

1. **Archive `ARCHITECTURE_DECISION_STATE_MANAGER.md`**
   - Add note that V2 supersedes it
   - Move to `docs/archive/` or add deprecation notice

### Medium Priority

2. **Merge `ERROR_HANDLING_STATUS.md` into `ERROR_HANDLING_INTEGRATION.md`**
   - Add "Implementation Status" section
   - Remove duplicate file
   - Update cross-references

### Low Priority

3. **Improve cross-references between Agentforce docs**
   - Add "Related Documentation" sections
   - Link between related guides
   - Consider creating `docs/guides/AGENTFORCE_INDEX.md` as entry point

---

## ✅ Files to Keep (No Consolidation Needed)

These files serve distinct purposes and should remain separate:

- ✅ `CI_CD_DEPLOYMENT.md` - General CI/CD guide
- ✅ `CI_CD_OPTIMIZATION.md` - Optimization details
- ✅ `PROVISIONING_CI_CD.md` - Provisioning feature
- ✅ `TESTING_SUMMARY.md` - Status/metrics
- ✅ `E2E_COVERAGE_ANALYSIS.md` - Coverage analysis
- ✅ `methodology/TESTING_STRATEGY.md` - Strategy
- ✅ `guides/ACCEPTANCE_CRITERIA_TESTING.md` - Workflow

---

## 📝 Notes

- **Agentforce docs**: While they could be consolidated, they serve different audiences:
  - Setup guide (quick reference)
  - Integration guide (detailed)
  - Token limits (reference)
  - Cost analysis (reference)
  - Auto-apply (feature-specific)

  **Better approach**: Improve cross-references and create an index.

- **Error Handling**: `STATUS` is implementation-specific and should be part of `INTEGRATION` guide.

- **Architecture Decisions**: V1 is outdated, V2 is current. Archive V1.

---

**Status**: Analysis complete, ready for consolidation actions


