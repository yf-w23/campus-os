# Campus OS 0.4.0 Work Plan

This plan turns `assist-to-os.md` into execution work for the 0.4.0 line. The
first principle is to make Campus OS trustworthy before making it more
autonomous: every campus capability should become a typed, auditable action.

## Phase 1: OS Tool Kernel

Goal: extend the current AI tool registry into a safer action layer.

Deliverables:

- Add action domain types for tool risk, previews, confirmation specs, and
  audit records.
- Extend `AgentTool` with risk and permission metadata while keeping existing
  tools compatible.
- Add local action audit storage with parameter redaction.
- Record every AI tool call, including read calls, user-cancelled writes, and
  failures.
- Add a Settings entry that shows recent AI operation records.

Acceptance:

- Every tool call still appears in the chat trace.
- Every tool call also creates a system-level audit record.
- Passwords, tokens, captcha values, student IDs, phone numbers, and account
  identifiers are redacted before persistence.
- Write actions include confirmation outcome in the audit record.

## Phase 2: Read-Only Campus Copilot

Goal: make the AI useful across campus context without increasing action risk.

Deliverables:

- Register read-only tools for schedule, classroom availability, electricity,
  grades, library seat availability, sports reservations, network balance, and
  campus card balance where service support exists.
- Keep tool results compact and structured.
- Use memory only for user-confirmed preferences.

Acceptance:

- The AI can answer cross-domain questions by calling tools instead of guessing.
- Large HTML/PDF responses are not sent to the model raw.
- Demo mode blocks real campus reads consistently.

## Phase 3: Reversible Write Actions

Goal: support low-risk and reversible campus actions with clear confirmation.

Deliverables:

- Upgrade the current `Alert` confirmation into a reusable confirmation sheet.
- Add dry-run previews for booking/cancelling library seats and rooms.
- Verify write results after execution.
- Expose undo/cancel paths for reversible actions.

Acceptance:

- No reversible write runs without confirmation.
- The audit log records preview, confirmation, execution, and verification
  status.
- Users can find the result after leaving the chat.

## Phase 4: High-Risk Transactions

Goal: handle sensitive campus actions as drafts, plans, or explicitly confirmed
transactions.

Deliverables:

- Add strong-confirmation flows for payment, course registration, campus card
  loss reporting, password/limit changes, teaching assessment submission, and
  email sending.
- Prefer draft/plan/reminder tools before execution tools.
- Keep payment tokens, passwords, verification codes, and full identifiers out
  of logs and AI context.

Acceptance:

- High-risk actions never run unattended.
- Each action has a verify path and a failure recovery note.
- The UI clearly shows what resource, amount, account, or recipient is affected.

## Phase 5: Local Workflows And Reminders

Goal: let Campus OS monitor safe conditions locally and bring the user back at
the right moment.

Deliverables:

- Add local workflow storage for plans, runs, status, and cancellation.
- Add foreground/app-start checks for watches and reminders.
- Support balance thresholds, room/seat availability watches, course capacity
  watches, and daily campus digests.

Acceptance:

- Users can inspect and cancel active monitors.
- Safe read checks may run automatically; writes still require confirmation.
- Failed workflows can resume from the latest safe point.

## Immediate Backlog

1. Add action domain types.
2. Add action audit storage with redaction.
3. Add risk and permission metadata to all existing AI tools.
4. Write audit records from the agent loop.
5. Show recent audit records in Settings.
6. Replace alert confirmations with a reusable confirmation sheet.
7. Register a classroom search AI tool.
8. Add campus card and campus network read-only tools.
9. Fill library room booking records/cancel actions.
10. Add local workflow skeleton for watches.
