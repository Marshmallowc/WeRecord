export type UserType = 'me' | 'her'

export interface Gift {
  id: string
  from_user: UserType
  to_user: UserType
  title: string
  amount?: number
  description?: string
  source_text: string
  date: string
  created_at: string
}

export interface AABill {
  id: string
  payer: UserType
  status: 'pending' | 'settled'
  total_amount: number
  my_share: number
  source_text: string
  note?: string
  date: string
  created_at: string
  aa_items?: AAItem[]
}

export interface AAItem {
  id: string
  bill_id: string
  name: string
  amount: number
}
