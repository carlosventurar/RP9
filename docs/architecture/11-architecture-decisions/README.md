# 11. Architecture Decision Records (ADRs)

## 📝 ADR Overview

Architecture Decision Records (ADRs) documentan las decisiones arquitectónicas significativas tomadas durante el desarrollo de **Agente Virtual IA**.

## 📋 ADR Index

| ADR # | Title | Status | Date |
|-------|-------|--------|------|
| [ADR-001](./adr-001-frontend-framework.md) | Frontend Framework Selection | Accepted | 2025-08-16 |
| [ADR-002](./adr-002-authentication-strategy.md) | Authentication Strategy | Accepted | 2025-08-16 |
| [ADR-003](./adr-003-database-choice.md) | Database Technology Choice | Accepted | 2025-08-16 |
| [ADR-004](./adr-004-serverless-functions.md) | Serverless Functions Architecture | Accepted | 2025-08-16 |
| [ADR-005](./adr-005-multi-tenant-isolation.md) | Multi-tenant Isolation Strategy | Accepted | 2025-08-16 |
| [ADR-006](./adr-006-ai-provider-abstraction.md) | AI Provider Abstraction | Accepted | 2025-08-16 |

## 📄 ADR Template

Use this template for new ADRs:

```markdown
# ADR-XXX: [Title]

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Context
What is the issue that we're seeing that is motivating this decision or change?

## Decision
What is the change that we're proposing and/or doing?

## Consequences
What becomes easier or more difficult to do because of this change?

### Positive
- List positive outcomes

### Negative  
- List negative outcomes or trade-offs

### Neutral
- List neutral aspects

## Alternatives Considered
What other options were evaluated?

## Related Decisions
- Link to related ADRs
- Reference external decisions

## References
- Links to supporting documentation
- Research sources
- Benchmark data
```

## 🔄 ADR Process

### Creating New ADRs
1. Copy the ADR template
2. Assign next sequential number
3. Fill in all sections thoughtfully
4. Review with architecture team
5. Update index table
6. Commit to repository

### Updating Existing ADRs
- ADRs are immutable once accepted
- To change a decision, create a new ADR that supersedes the old one
- Update the status of the superseded ADR

### ADR Statuses
- **Proposed**: Under consideration
- **Accepted**: Decision approved and implemented
- **Deprecated**: No longer relevant but kept for history
- **Superseded**: Replaced by a newer ADR

---

**Next**: Review individual ADRs for detailed decision context and rationale.