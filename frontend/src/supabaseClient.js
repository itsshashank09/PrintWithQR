import { createClient } from '@supabase/supabase-js';

const getEnvValue = (val) => {
  if (!val || val === 'YOUR_SUPABASE_URL_HERE' || val === 'YOUR_SUPABASE_ANON_KEY_HERE') {
    return '';
  }
  return val;
};

const supabaseUrl = getEnvValue(import.meta.env.VITE_SUPABASE_URL) || getEnvValue(process.env.SUPABASE_URL) || getEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL) || 'https://lvtmbhxjkuocohcdwclu.supabase.co';
const supabaseAnonKey = getEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY) || getEnvValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) || getEnvValue(process.env.SUPABASE_ANON_KEY) || getEnvValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) || 'sb_publishable_JGCdrdQJx7x8Dq0LQJcM1Q_lsDTiD_9';

let client;

// A robust nested mock handler to prevent runtime crashes when credentials are not configured on host
const makeChainedMock = () => {
  const mockObj = () => {};
  const proxy = new Proxy(mockObj, {
    get: (target, prop) => {
      if (prop === 'then') {
        return (resolve) => resolve({ data: null, error: new Error("Supabase is not configured.") });
      }
      return proxy;
    },
    apply: () => {
      return proxy;
    }
  });
  return proxy;
};

try {
  console.log("Supabase Client Init: URL =", supabaseUrl ? "Present (" + supabaseUrl.substring(0, 15) + "...)" : "Missing", "Key =", supabaseAnonKey ? "Present" : "Missing");
  if (supabaseUrl && supabaseAnonKey) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } else {
    console.warn("Supabase credentials not found in env variables. Using safe UI placeholder mock client.");
    client = new Proxy({}, {
      get: (target, prop) => {
        if (prop === 'auth') {
          return {
            signUp: async () => ({ data: {}, error: new Error("Supabase Auth is not configured. Please add environment variables.") }),
            signInWithPassword: async () => ({ data: {}, error: new Error("Supabase Auth is not configured. Please add environment variables.") }),
            getUser: async () => ({ data: { user: null }, error: null }),
            updateUser: async () => ({ data: {}, error: new Error("Supabase Auth is not configured. Please add environment variables.") }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
          };
        }
        if (prop === 'storage') {
          return {
            from: () => ({
              upload: async () => ({ data: null, error: new Error("Supabase Storage is not configured.") }),
              getPublicUrl: () => ({ data: { publicUrl: '' } })
            })
          };
        }
        return makeChainedMock();
      }
    });
  }
} catch (err) {
  console.error("Failed to initialize Supabase client:", err);
  client = makeChainedMock();
}

export const supabase = client;
