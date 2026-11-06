import { useId, useState } from 'react';

// ============================================================================
// 1. DESIGN SYSTEM TOKENS
// ============================================================================
export const tokens = {
  pageBg: 'bg-[#F4F6F9]',
  card: 'rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.06)]',
  label: 'mb-1.5 block text-[13px] font-semibold tracking-tight text-slate-700',
  input:
    'h-[44px] w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all hover:border-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
  textarea:
    'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all hover:border-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
  inputError:
    'border-red-500 bg-red-50/20 focus:border-red-600 focus:ring-red-500/15',
  error: 'mt-1.5 text-xs font-semibold text-red-600',
  hint: 'mt-1.5 text-xs font-medium text-slate-500',
};

// Legacy class exports for backward compatibility
export const inputCls = tokens.input;
export const btnPrimary =
  'inline-flex h-[42px] min-h-[42px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';
export const btnSecondary =
  'inline-flex h-[42px] min-h-[42px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-slate-400/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';
export const btnDanger =
  'inline-flex h-[42px] min-h-[42px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 transition-all hover:bg-red-600 hover:border-red-600 hover:text-white active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer';

// ============================================================================
// 2. STANDARDIZED CARD COMPONENT
// ============================================================================
export function Card({ children, className = '', noPadding = false, ...props }) {
  const hasCustomPadding =
    noPadding ||
    /\bp-\d+\b|\bpx-\d+\b|\bpy-\d+\b|\b!p-\d+\b/.test(className);

  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_12px_-2px_rgba(15,23,42,0.06)] ${
        hasCustomPadding ? '' : 'p-6 sm:p-8'
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// ============================================================================
// 3. STANDARDIZED BUTTON COMPONENT (Fixed px-5 horizontal padding!)
// ============================================================================
export function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  children,
  ...props
}) {
  const base =
    'inline-flex h-[42px] min-h-[42px] items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-semibold transition-all cursor-pointer active:scale-[0.99] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 select-none';

  const variants = {
    primary:
      'bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/25',
    secondary:
      'border border-slate-300 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 focus:ring-4 focus:ring-slate-400/20',
    outline:
      'border border-slate-300 bg-white text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 focus:ring-4 focus:ring-slate-400/20',
    danger:
      'border border-red-200 bg-red-50 text-red-700 hover:bg-red-600 hover:border-red-600 hover:text-white focus:ring-4 focus:ring-red-500/20',
    ghost:
      'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    link: 'h-auto min-h-0 bg-transparent p-0 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline',
  };

  const variantClass = variants[variant] || variants.primary;

  return (
    <button
      type={type}
      className={`${variant === 'link' ? variants.link : `${base} ${variantClass}`} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// ============================================================================
// 4. PASSWORD EYE VISIBILITY TOGGLE
// ============================================================================
export function EyeToggle({ show, visible, onToggle }) {
  const isShown = show !== undefined ? show : visible;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
      aria-label={isShown ? 'Hide password' : 'Show password'}
      title={isShown ? 'Hide password' : 'Show password'}
    >
      {isShown ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
          />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      )}
    </button>
  );
}

// ============================================================================
// 5. STANDARDIZED INPUT FIELD COMPONENT
// ============================================================================
export function InputField({
  label,
  id,
  as,
  type = 'text',
  required = false,
  error,
  hint,
  className = '',
  wrapperClassName = '',
  children,
  showPasswordToggle = true,
  rightElement,
  ...props
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const [showPass, setShowPass] = useState(false);

  const isSelect = as === 'select' || type === 'select';
  const isTextarea = as === 'textarea' || type === 'textarea';
  const isPassword = type === 'password' && !isSelect && !isTextarea;
  const effectiveType = isPassword ? (showPass ? 'text' : 'password') : type;

  const baseFieldClass = isTextarea ? tokens.textarea : tokens.input;
  const errorClass = error ? tokens.inputError : '';
  const prClass = isPassword && showPasswordToggle ? 'pr-11' : '';

  return (
    <div
      data-error={Boolean(error)}
      className={`w-full ${wrapperClassName}`}
    >
      {label && (
        <label htmlFor={inputId} className={tokens.label}>
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        {isSelect ? (
          <select
            id={inputId}
            required={required}
            aria-invalid={Boolean(error)}
            className={`${baseFieldClass} ${errorClass} cursor-pointer ${className}`}
            {...props}
          >
            {children}
          </select>
        ) : isTextarea ? (
          <textarea
            id={inputId}
            required={required}
            aria-invalid={Boolean(error)}
            className={`${baseFieldClass} ${errorClass} ${className}`}
            {...props}
          />
        ) : (
          <input
            id={inputId}
            type={effectiveType}
            required={required}
            aria-invalid={Boolean(error)}
            className={`${baseFieldClass} ${errorClass} ${prClass} ${className}`}
            {...props}
          />
        )}

        {isPassword && showPasswordToggle && (
          <EyeToggle
            visible={showPass}
            onToggle={() => setShowPass((prev) => !prev)}
          />
        )}

        {!isPassword && rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>

      {hint && !error && <p className={tokens.hint}>{hint}</p>}
      {error && (
        <p role="alert" className={tokens.error}>
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = InputField;

// ============================================================================
// 6. UNIFIED STATUS BADGE SYSTEM
// ============================================================================
const STATUS_COLOR_MAP = {
  unconfirmed: 'border-slate-300 bg-slate-100 text-slate-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  scheduled: 'border-blue-200 bg-blue-50 text-blue-700',
  confirmed: 'border-blue-200 bg-blue-50 text-blue-700',
  arrived: 'border-red-200 bg-red-50 text-red-700',
  checked_in: 'border-red-200 bg-red-50 text-red-700',
  in_chair: 'border-violet-200 bg-violet-50 text-violet-700',
  'in chair': 'border-violet-200 bg-violet-50 text-violet-700',
  in_progress: 'border-violet-200 bg-violet-50 text-violet-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  declined: 'border-red-200 bg-red-50 text-red-700',
  cancelled: 'border-slate-200 bg-slate-100 text-slate-600',
  no_show: 'border-slate-200 bg-slate-100 text-slate-600',
  'no-show': 'border-slate-200 bg-slate-100 text-slate-600',
  planned: 'border-amber-200 bg-amber-50 text-amber-800',
  existing: 'border-blue-200 bg-blue-50 text-blue-700',
  charge: 'border-amber-200 bg-amber-50 text-amber-800',
  payment: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  admin: 'border-purple-200 bg-purple-50 text-purple-800',
  dentist: 'border-blue-200 bg-blue-50 text-blue-700',
  receptionist: 'border-teal-200 bg-teal-50 text-teal-800',
};

const TONE_FALLBACK_MAP = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
};

export function Badge({ status, tone = 'neutral', className = '', children }) {
  const rawText = String(status || (typeof children === 'string' ? children : '') || '')
    .trim()
    .toLowerCase();

  const resolvedColor =
    STATUS_COLOR_MAP[rawText] || TONE_FALLBACK_MAP[tone] || TONE_FALLBACK_MAP.neutral;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${resolvedColor} ${className}`}
    >
      {children || status}
    </span>
  );
}

// ============================================================================
// 7. STANDARDIZED MODAL CONTAINER
// ============================================================================
export function Modal({ title, subtitle, onClose, children, maxWidth = 'max-w-lg' }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <Card
        noPadding
        className={`my-8 w-full ${maxWidth} overflow-hidden p-6 sm:p-8 shadow-xl`}
      >
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && (
              <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
        <div>{children}</div>
      </Card>
    </div>
  );
}

// ============================================================================
// 8. SUPPORTING UI COMPONENTS (Tabs, Stepper, EmptyState, Icon)
// ============================================================================
export function Tabs({ tabs = [], activeTab, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200/80">
      {tabs.map((t) => {
        const active = activeTab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`min-h-[42px] border-b-2 px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
              active
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({ steps = [], currentStep = 0 }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      {steps.map((label, idx) => {
        const isDone = idx < currentStep;
        const isCurrent = idx === currentStep;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isDone
                  ? 'bg-emerald-600 text-white'
                  : isCurrent
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {isDone ? '✓' : idx + 1}
            </span>
            <span
              className={`hidden text-xs font-semibold sm:inline ${
                isCurrent ? 'text-blue-600 font-bold' : isDone ? 'text-slate-800' : 'text-slate-400'
              }`}
            >
              {label}
            </span>
            {idx < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 rounded ${
                  isDone ? 'bg-emerald-500' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
      <p className="text-sm font-bold text-slate-800">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-xs font-medium text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Icon({ name, className = 'h-4 w-4' }) {
  switch (name) {
    case 'menu':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    case 'close':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'grid':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      );
    case 'user':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'shield':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case 'finance':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'settings':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'activity':
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}