import { useAuthStore } from '../store/auth';
const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
async function req(path: string, opts: RequestInit = {}) {
  const token = useAuthStore.getState().token;
  const res = await fetch(`${API}${path}`, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.error || `HTTP ${res.status}`); }
  return res.status===204 ? null : res.json();
}
export const api = {
  auth: { signup: (d:{email:string;password:string;name:string}) => req('/auth/signup',{method:'POST',body:JSON.stringify(d)}), login: (d:{email:string;password:string}) => req('/auth/login',{method:'POST',body:JSON.stringify(d)}), logout: () => req('/auth/logout',{method:'POST'}), me: () => req('/auth/me') },
  patients: { list: () => req('/patients'), create: (name:string) => req('/patients',{method:'POST',body:JSON.stringify({name})}), get: (id:string) => req(`/patients/${id}`), delete: (id:string) => req(`/patients/${id}`,{method:'DELETE'}), upload: (id:string, file:File) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = useAuthStore.getState().token;
    return fetch(`${API}/patients/${id}/documents`, {
      method: 'POST',
      credentials: 'include',
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      body: fd,
    }).then(r => {
      if (!r.ok) return r.json().catch(() => ({})).then((e) => { throw new Error(e.error || 'Upload failed'); });
      return r.json();
    });
  }, search: (id:string,q:string) => req(`/patients/${id}/search?q=${encodeURIComponent(q)}`), brief: (id:string, type:string, specialty?:string) => req(`/patients/${id}/briefs`,{method:'POST',body:JSON.stringify({type,specialty})}), byoai: (id:string) => req(`/patients/${id}/byoai-context`), analytics: (id:string) => req(`/patients/${id}/analytics`), compare: (aId:string,bId:string) => req('/patients/compare',{method:'POST',body:JSON.stringify({aId,bId})}) }
};