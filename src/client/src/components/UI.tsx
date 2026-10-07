import { forwardRef, useState, cloneElement } from 'react';
import { Loader2, X, ChevronDown, ChevronRight, Search, FileText, Upload, Download, Settings, LogOut, User, Bell, AlertTriangle, CheckCircle, XCircle, Info, HelpCircle, ExternalLink, Copy, Plus, Trash2, Eye, EyeOff, Filter, Calendar, Pill, Stethoscope, ClipboardList, History, ArrowLeft, ArrowRight, RefreshCw, FilePlus, Archive, Lock, Shield, Globe, Menu, ChevronLeft } from 'lucide-react';

export const Spinner = forwardRef<HTMLDivElement, { size?: 'sm'|'md'|'lg' }>(({ size='md' }, ref) => {
  const s = size==='sm'?'w-4 h-4':size==='lg'?'w-8 h-8':'w-6 h-6';
  return <div ref={ref} className={`${s} border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin`} role="status" aria-label="Loading" />;
});
export const IconButton = forwardRef<HTMLButtonElement, { children:React.ReactNode; variant?:'ghost'|'primary'|'secondary'|'danger'; size?:'sm'|'md'; onClick?:()=>void; disabled?:boolean; className?:string; 'aria-label'?:string }>(({ children,variant='ghost',size='md',onClick,disabled,className,'aria-label':label, ...props }, ref) => {
  const base = 'inline-flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const sz = size==='sm'?'p-1.5':'p-2';
  const vars = variant==='primary'?'bg-brand-600 text-white hover:bg-brand-700': variant==='secondary'?'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50': variant==='danger'?'bg-red-600 text-white hover:bg-red-700':'text-slate-600 hover:bg-slate-100';
  return <button ref={ref} className={`${base} ${sz} ${vars} ${className||''}`} onClick={onClick} disabled={disabled} aria-label={label} {...props}>{children}</button>;
});
export const Button = forwardRef<HTMLButtonElement, { children:React.ReactNode; variant?:'primary'|'secondary'|'ghost'|'danger'; size?:'sm'|'md'|'lg'; onClick?:()=>void; disabled?:boolean; type?:'button'|'submit'|'reset'; className?:string }>(({ children,variant='primary',size='md',onClick,disabled,type='button',className, ...props }, ref) => {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const sz = size==='sm'?'px-3 py-1.5 text-sm': size==='lg'?'px-6 py-3 text-base':'px-4 py-2 text-sm';
  const vars = variant==='primary'?'bg-brand-600 text-white hover:bg-brand-700': variant==='secondary'?'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50': variant==='ghost'?'text-slate-600 hover:bg-slate-100':'bg-red-600 text-white hover:bg-red-700';
  return <button ref={ref} className={`${base} ${sz} ${vars} ${className||''}`} onClick={onClick} disabled={disabled} type={type} {...props}>{children}</button>;
});
export const Input = forwardRef<HTMLInputElement, { label?:string; error?:string; type?:string; value:string; onChange:(e:React.ChangeEvent<HTMLInputElement>)=>void; placeholder?:string; id?:string; required?:boolean }>(({ label,error,type='text',value,onChange,placeholder,id,required, ...props }, ref) => (
  <div className="w-full">
    {label && <label htmlFor={id} className="label">{label} {required && <span className="text-red-500">*</span>}</label>}
    <input ref={ref} type={type} id={id} value={value} onChange={onChange} placeholder={placeholder} required={required} className={`input ${error?'border-red-400 focus:border-red-500 focus:ring-red-500':''}`} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} {...props} />
    {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
  </div>
));
export const Textarea = forwardRef<HTMLTextAreaElement, { label?:string; error?:string; value:string; onChange:(e:React.ChangeEvent<HTMLTextAreaElement>)=>void; placeholder?:string; id?:string; rows?:number }>(({ label,error,value,onChange,placeholder,id,rows=4, ...props }, ref) => (
  <div className="w-full">
    {label && <label htmlFor={id} className="label">{label}</label>}
    <textarea ref={ref} id={id} value={value} onChange={onChange} placeholder={placeholder} rows={rows} className={`input resize-y ${error?'border-red-400 focus:border-red-500 focus:ring-red-500':''}`} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} {...props} />
    {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
  </div>
));
export const Select = forwardRef<HTMLSelectElement, { label?:string; error?:string; value:string; onChange:(e:React.ChangeEvent<HTMLSelectElement>)=>void; options:Array<{value:string;label:string}>; id?:string; placeholder?:string }>(({ label,error,value,onChange,options,id,placeholder, ...props }, ref) => (
  <div className="w-full">
    {label && <label htmlFor={id} className="label">{label}</label>}
    <select ref={ref} id={id} value={value} onChange={onChange} className={`input ${error?'border-red-400 focus:border-red-500 focus:ring-red-500':''}`} aria-invalid={!!error} {...props}>
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    {error && <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
  </div>
));
export const Badge = ({ children, variant='default', className }: { children:React.ReactNode; variant?:'default'|'new'|'changed'|'resolved'|'open'|'conflict'|'repeated'; className?:string }) => {
  const cls = variant==='new'?'badge-new': variant==='changed'?'badge-changed': variant==='resolved'?'badge-resolved': variant==='open'?'badge-open': variant==='conflict'?'badge-conflict': variant==='repeated'?'badge-repeated':'badge bg-slate-100 text-slate-700';
  return <span className={`${cls} ${className||''}`}>{children}</span>;
};
export const Card = ({ children, className, header }: { children:React.ReactNode; className?:string; header?:React.ReactNode }) => (
  <div className={`card ${className||''}`}>
    {header && <div className="card-header">{header}</div>}
    <div className="card-body">{children}</div>
  </div>
);
export const Modal = ({ open, onClose, title, children, size='md', footer }: { open:boolean; onClose:()=>void; title:string; children:React.ReactNode; size?:'sm'|'md'|'lg'|'xl'; footer?:React.ReactNode }) => {
  if (!open) return null;
  const sz = size==='sm'?'max-w-md': size==='lg'?'max-w-3xl': size==='xl'?'max-w-5xl':'max-w-xl';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className={`w-full ${sz} bg-white rounded-xl shadow-xl animate-slide-up`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
          <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X className="w-5 h-5" /></IconButton>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  );
};
export const Drawer = ({ open, onClose, title, children, footer }: { open:boolean; onClose:()=>void; title:string; children:React.ReactNode; footer?:React.ReactNode }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white shadow-drawer animate-slide-up" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
        <h2 id="drawer-title" className="text-lg font-semibold">{title}</h2>
        <IconButton variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X className="w-5 h-5" /></IconButton>
      </div>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
      {footer && <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">{footer}</div>}
    </div>
  );
};
export const Tooltip = ({ children, content }: { children:React.ReactElement; content:string }) => {
  const [show, setShow] = useState(false);
  return <div className="relative inline-block" onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)} onFocus={()=>setShow(true)} onBlur={()=>setShow(false)}>{cloneElement(children,{...children.props, 'aria-describedby':show?'tooltip':undefined})} {show && <div id="tooltip" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded shadow-lg whitespace-nowrap z-50">{content}</div>}</div>;
};