export type PaymentMethodType = 'UPI_ID' | 'QR_CODE';

export interface PaymentMethod {
  payment_method_id: string;
  user_id: string;
  type: PaymentMethodType;
  upi_id?: string;
  qr_image_url?: string;
  is_default: boolean;
  created_at?: string;
}

export interface PaymentMethodCreateRequest {
  type: PaymentMethodType;
  upi_id?: string;
  qr_image_url?: string;
  is_default: boolean;
}
