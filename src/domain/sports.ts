export interface SportsVenueInfo {
  name: string;
  gymId: string;
  itemId: string;
}

export interface SportsResource {
  resId: string;
  resHash: string;
  timeSession: string;
  fieldName: string;
  overlaySize: number;
  canNetBook: boolean;
  cost?: number;
  bookId?: string;
  locked?: boolean;
  userType?: string;
  paymentStatus?: boolean;
}

export interface SportsResourcesInfo {
  count: number;
  init: number;
  phone?: string;
  data: SportsResource[];
}

export interface SportsReservationRecord {
  name: string;
  field: string;
  time: string;
  price: string;
  method: string;
  bookTimestamp?: number;
  bookId?: string;
  payId?: string;
}
