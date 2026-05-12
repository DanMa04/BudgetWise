export interface User {
  id: string;
  email: string;
  display_name: string | null;
  currency_code: string;
  timezone: string;
  created_at: string;
}

export interface UserPreferences {
  currency_code: string;
  timezone: string;
}
