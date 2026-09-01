// ============================================================
// Montaser Workshop — TypeScript Database Types
// ============================================================

export type UserRole = 'admin' | 'technician'
export type VisitStatus = 'Pending' | 'In Progress' | 'Completed' | 'Delivered'
export type TransactionType = 'Income' | 'Expense'
export type TransactionRefType = 'Visit_Payment' | 'Employee_Wage' | 'Other'

// ── Row types ────────────────────────────────────────────────
export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
}

export interface Customer {
  id: string
  phone: string
  name: string
  created_at: string
}

export interface Vehicle {
  id: string
  customer_id: string
  license_plate: string
  chassis_number_vin: string | null
  make_and_model: string
}

export interface Visit {
  id: string
  vehicle_id: string
  entry_date: string
  complaint: string | null
  status: VisitStatus
  total_amount: number
}

export interface EcuCompany {
  id: string
  name: string
}

export interface EcuCategory {
  id: string
  name: string
}

export interface Ecu {
  id: string
  company_id: string | null
  category_id: string | null
  name: string
  barcode: string | null
  symbols_codes: string | null
  stock_quantity: number
  min_quantity?: number
  purchase_price: number
  selling_price: number
}

export interface UsedPart {
  id: string
  visit_id: string
  ecu_id: string
  quantity: number
  selling_price_at_time: number
}

export interface Employee {
  id: string
  name: string
  phone: string | null
  specialization: string | null
}

export interface DailyWage {
  id: string
  employee_id: string
  date: string
  amount: number
}

export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  reference_type: TransactionRefType
  reference_id: string | null
  description: string | null
  date: string
}

// ── Joined / extended types ─────────────────────────────────
export interface VehicleWithCustomer extends Vehicle {
  customers: Customer
}

export interface VisitWithVehicle extends Visit {
  vehicles: Vehicle & { customers: Customer }
}

export interface UsedPartWithEcu extends UsedPart {
  ecus: Ecu & {
    ecu_companies: EcuCompany | null
    ecu_categories: EcuCategory | null
  }
}

export interface EcuWithRelations extends Ecu {
  ecu_companies: EcuCompany | null
  ecu_categories: EcuCategory | null
}

export interface DailyWageWithEmployee extends DailyWage {
  employees: Employee
}

// ── Supabase Database type (for createClient generics) ──────
export type Database = {
  public: {
    Tables: {
      profiles:        { Row: Profile;     Insert: Omit<Profile, 'id'>;      Update: Partial<Omit<Profile, 'id'>> }
      customers:       { Row: Customer;    Insert: Omit<Customer, 'id' | 'created_at'>; Update: Partial<Omit<Customer, 'id'>> }
      vehicles:        { Row: Vehicle;     Insert: Omit<Vehicle, 'id'>;      Update: Partial<Omit<Vehicle, 'id'>> }
      visits:          { Row: Visit;       Insert: Omit<Visit, 'id' | 'total_amount'>; Update: Partial<Omit<Visit, 'id'>> }
      ecu_companies:   { Row: EcuCompany;  Insert: Omit<EcuCompany, 'id'>;  Update: Partial<Omit<EcuCompany, 'id'>> }
      ecu_categories:  { Row: EcuCategory; Insert: Omit<EcuCategory, 'id'>; Update: Partial<Omit<EcuCategory, 'id'>> }
      ecus:            { Row: Ecu;         Insert: Omit<Ecu, 'id'>;          Update: Partial<Omit<Ecu, 'id'>> }
      used_parts:      { Row: UsedPart;    Insert: Omit<UsedPart, 'id'>;     Update: Partial<Omit<UsedPart, 'id'>> }
      employees:       { Row: Employee;    Insert: Omit<Employee, 'id'>;     Update: Partial<Omit<Employee, 'id'>> }
      daily_wages:     { Row: DailyWage;   Insert: Omit<DailyWage, 'id'>;   Update: Partial<Omit<DailyWage, 'id'>> }
      transactions:    { Row: Transaction; Insert: Omit<Transaction, 'id'>; Update: Partial<Omit<Transaction, 'id'>> }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role:                  UserRole
      visit_status:               VisitStatus
      transaction_type:           TransactionType
      transaction_reference_type: TransactionRefType
    }
  }
}
