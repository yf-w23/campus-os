export type ToolRisk =
  | 'read'
  | 'write_reversible'
  | 'write_irreversible'
  | 'payment'
  | 'credential';

export type ConfirmationStatus =
  | 'not_required'
  | 'approved'
  | 'denied'
  | 'unavailable';

export type ActionExecutionStatus = 'success' | 'error' | 'cancelled';

export interface ActionPreview {
  title: string;
  summary: string;
  affectedResource?: string;
  accountLabel?: string;
  reversible?: boolean;
  requiresSecondFactor?: boolean;
}

export interface ConfirmationSpec {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface VerificationResult {
  ok: boolean;
  message?: string;
}

export interface UndoResult {
  ok: boolean;
  message?: string;
}

export interface AuditRecord {
  id: string;
  createdAt: string;
  toolName: string;
  toolTitle?: string;
  risk: ToolRisk;
  permission: string;
  params?: unknown;
  preview?: ActionPreview;
  confirmation: ConfirmationStatus;
  status: ActionExecutionStatus;
  verification?: VerificationResult;
  resultSummary?: string;
  errorMessage?: string;
}
