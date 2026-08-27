# 📋 Documentation Consolidation Plan

**Created**: December 14, 2025
**Purpose**: Identify duplicate or overlapping documentation that should be consolidated. Historical external-AI notes are retained for traceability only.

---

## 🔍 Analysis Results

### 1. Retired external-AI documentation

The former external-AI documents were removed and are not replaced.

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

| Category                   | Files | Action                        | Priority |
| -------------------------- | ----- | ----------------------------- | -------- |
| **Error Handling**         | 4     | Merge STATUS into INTEGRATION | Medium   |
| **Architecture Decisions** | 2     | Archive V1, keep V2           | Medium   |
| **CI/CD**                  | 3     | Keep separate ✅              | N/A      |
| **Testing**                | 4     | Keep separate ✅              | N/A      |

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

- Add "Related Documentation" sections
- Link between related guides

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
