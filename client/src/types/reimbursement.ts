export type FormType = 'general' | 'business_trip';

/**
 * UPDATED: Simplified 9-state workflow (removed CA-specific states)
 */
export type ReimbursementStatus =
  | 'DRAFT'         // Initial draft state
  | 'SUBMITTED'     // First submission (or re-submission after query/ask)
  | 'IN_REVIEW'     // Being reviewed by current reviewer
  | 'QUERY'         // Reviewer raised query (unified, replaces QUERY_RAISED)
  | 'ASK'           // Reviewer raised private ask (unified, replaces PRIVATE_ASK)
  | 'REAPPLIED'     // Initiator responded (replaces REAPPLIED)
  | 'REJECTED'      // Rejected (terminal state)
  | 'PAID'          // Marked as paid
  | 'ACKNOWLEDGED'; // Initiator acknowledged payment (terminal state, replaces CLOSED)

/**
 * DEPRECATED: Keep for backward compatibility, map to new statuses
 */
export type DeprecatedReimbursementStatus =
  | 'QUERY_RAISED'          // → QUERY
  | 'PRIVATE_ASK'           // → ASK
  | 'OWNER_APPROVED'        // → IN_REVIEW (next step)
  | 'CA_PENDING'            // → IN_REVIEW (at CA step)
  | 'CA_QUERY'              // → QUERY
  | 'CA_REAPPLIED'          // → REAPPLIED
  | 'PAYMENT_ACKNOWLEDGED'  // → ACKNOWLEDGED
  | 'AUTO_REJECTED'         // → REJECTED
  | 'CLOSED';               // → ACKNOWLEDGED

export interface ReimbursementItem {
  category_id: string;
  category_name?: string;   // resolved from backend
  sub_category?: string;
  amount: number;
  expense_date: string; // YYYY-MM-DD
  description?: string;
  attachments: string[]; // attachment_id array
}

export interface BusinessTripMeta {
  from_date: string; // YYYY-MM-DD
  to_date: string;   // YYYY-MM-DD
}

export interface PaymentProof {
  attachment_id: string;
  payment_date: string; // ISO datetime
  paid_by: string; // user_id
  transaction_ref: string;
  payment_method?: string;
}

/**
 * NEW: Enhanced approval chain node with step tracking
 */
export interface ApprovalChainNode {
  step: number;                    // Index in chain (0 = initiator, 1+ = reviewers)
  user_id: string;                 // User ID
  username: string;                // Display name
  role: string;                    // Role (initiator, manager, owner, ca)
  current_status: string;          // Status at this step
  receivedAt: string | null;       // ISO datetime when reviewer opened (null if not viewed yet)
  submittedAt: string | null;      // ISO datetime when actioned (null if not actioned yet)
  bIsReApply: boolean;             // Only for initiator (step 0): true if resubmitting after query/ask
}

export interface Reimbursement {
  reimbursement_id: string;
  reimbursement_code?: string;     // DEPRECATED: Old format (RB-2026-000001)
  initiator_id: string;
  initiator_name: string;
  form_type: FormType;
  status: ReimbursementStatus;
  description?: string;
  items: ReimbursementItem[];
  business_trip_meta?: BusinessTripMeta;
  payment_proof?: PaymentProof;   // Payment proof when status is PAID or later

  // NEW: Enhanced approval chain fields
  approval_chain: ApprovalChainNode[];  // Embedded approval chain with step tracking
  current_step: number;                 // Current step index in approval chain
  current_reviewer_id: string;          // Current reviewer user ID

  // Timestamps (all in IST timezone)
  created_at: string;              // Set on first submission (not draft creation)
  updated_at: string;              // Last update time
  draft_created_at?: string;       // When draft was first created
  submitted_at?: string;           // When first submitted (same as created_at usually)
  acknowledged_at?: string;        // When initiator acknowledged payment
  acknowledged_by?: string;        // User ID who acknowledged
}

export interface ReimbursementItemSummary {
  category_id: string;
  category_name?: string;
  sub_category?: string;
  amount: number;
  expense_date?: string;
  description?: string;
}

export interface ReimbursementListItem {
  reimbursement_id: string;
  reimbursement_code?: string;
  initiator_id: string;
  initiator_name: string;
  form_type: FormType;
  status: ReimbursementStatus;
  description?: string;
  total_amount: number;
  created_at: string;
  updated_at?: string;
  items: ReimbursementItemSummary[];
}

export interface ReimbursementCreateRequest {
  form_type: FormType;
  description?: string;
  items: ReimbursementItem[];
  business_trip_meta?: BusinessTripMeta;
}

export interface ReimbursementUpdateRequest {
  description?: string;
  items?: ReimbursementItem[];
  business_trip_meta?: BusinessTripMeta;
}
