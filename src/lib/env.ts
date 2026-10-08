const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  apiUrl,
  aiUrl: process.env.NEXT_PUBLIC_AI_URL || `${apiUrl}/ai/v1`,
  apiMock: process.env.NEXT_PUBLIC_API_MOCK === '1',
  authMock: process.env.NEXT_PUBLIC_AUTH_MOCK === '1',
};
