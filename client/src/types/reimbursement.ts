export type FormType = 'general' | 'business_trip';

export type ReimbursementStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'QUERY_RAISED'
  | 'PRIVATE_ASK'
  | 'REAPPLIED'
  | 'OWNER_APPROVED'
  | 'CA_PENDING'
  | 'CA_QUERY'
  | 'CA_REAPPLIED'
  | 'PAID'
  | 'PAYMENT_ACKNOWLEDGED'
  | 'REJECTED'
  | 'AUTO_REJECTED'
  | 'CLOSED';

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

export interface Reimbursement {
  reimbursement_id: string;
  reimbursement_code?: string;  // e.g. RB-2026-000001
  initiator_id: string;
  initiator_name: string;
  form_type: FormType;
  status: ReimbursementStatus;
  description?: string;
  items: ReimbursementItem[];
  business_trip_meta?: BusinessTripMeta;
  payment_proof?: PaymentProof;  // Payment proof when status is PAID or later
  created_at: string;
  updated_at: string;
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
