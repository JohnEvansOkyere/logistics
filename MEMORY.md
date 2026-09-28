Maintain a file called MEMORY.md. After any significant decision, about direction, format, content, approach, or strategy, add an entry:

## [Date], [Decision]

**What was decided:** [the choice made]
**Why:** [the reasoning]
**What was rejected:** [alternatives considered and why they were ruled out]

Read MEMORY.md at the start of every session before doing anything. Never contradict a logged decision without flagging it first.

## 2026-09-28, D04 company access and role administration

**What was decided:** The super admin creates user accounts and assigns roles in the admin section. Customer access follows explicit company assignment: each user sees all business records belonging to assigned companies and no records belonging to other companies; no per-record publication gate or document-type list.
**Why:** The user reconfirmed that each company should see all data belonging to it and no other company's data, and that role assignment is administered dynamically.
**What was rejected:** Repeating questions about role names, staff names, multi-company access, and customer-visible record types; these are superseded by the confirmed access model.

## 2026-09-28, First business-engine slice

**What was decided:** Start P02 with local SQLite persistence for quote requests and a connected staff inbox/detail form; do not include authentication, pricing, quote acceptance, or job creation in this slice.
**Why:** It turns the existing local-only intake preview into the first runnable business flow while D03/D12 pricing and job-number rules remain open.
**What was rejected:** Starting with authentication or treating this request-intake slice as the full quote-to-job engine.
