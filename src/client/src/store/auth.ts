import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User { id: string; email: string; name: string; }
interface AuthState { user: User | null; token: string | null; setAuth: (user: User, token: string) => void; clear: () => void; }
export const useAuthStore = create<AuthState>()(persist((set)=>({ user:null, token:null, setAuth:(user,token)=>set({user,token}), clear:()=>set({user:null,token:null}) }), { name:'medbrief-auth' }));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return children;
}