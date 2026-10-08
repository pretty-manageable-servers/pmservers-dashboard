export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  apiMock: process.env.NEXT_PUBLIC_API_MOCK === '1',
  authMock: process.env.NEXT_PUBLIC_AUTH_MOCK === '1',
};
