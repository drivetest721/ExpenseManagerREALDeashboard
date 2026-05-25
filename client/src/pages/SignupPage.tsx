/**
 * SignupPage — two-step account creation.
 *  Step 1: collect name / email / password (+ optional employee_id) and
 *          POST /api/auth/signup so a verification code is emailed.
 *  Step 2: collect the 6-digit code and POST /api/auth/verify-email; on
 *          success the issued JWT is persisted and the user is forwarded
 *          to /expense.
 *
 * Mirrors LoginPage.tsx styling (bg-gray-50 page, white card, green CTA).
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, UserPlus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ErrorCard } from '../components/ErrorCard';
import { Footer } from '../components/Footer';
import { signupApi, verifyEmailApi, resendCodeApi } from '../utils/authApi';

// ── Zod schemas ────────────────────────────────────────────────────────────────
const objSignupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72),
  employee_id: z.string().max(50).optional().or(z.literal('')),
});

const objVerifySchema = z.object({
  code: z
    .string()
    .min(4, 'Enter the code from your email')
    .max(10)
    .regex(/^[0-9]+$/, 'Code must be numeric'),
});

type SignupFormValues = z.infer<typeof objSignupSchema>;
type VerifyFormValues = z.infer<typeof objVerifySchema>;

type Step = 'signup' | 'verify';

// ── Component ──────────────────────────────────────────────────────────────────
export default function SignupPage() {
  const { refreshUser } = useAuth();
  const objNavigate = useNavigate();

  const [strStep, setStrStep] = useState<Step>('signup');
  const [strPendingEmail, setStrPendingEmail] = useState<string>('');
  const [bShowPassword, setBShowPassword] = useState(false);
  const [objApiError, setObjApiError] = useState<string | null>(null);
  const [strInfo, setStrInfo] = useState<string | null>(null);
  const [bResending, setBResending] = useState(false);

  // ── Step 1 form ─────────────────────────────────────────────────────────────
  const {
    register: registerSignup,
    handleSubmit: handleSubmitSignup,
    formState: { errors: objSignupErrors, isSubmitting: bSignupSubmitting },
  } = useForm<SignupFormValues>({ resolver: zodResolver(objSignupSchema) });

  const onSubmitSignup = async (objData: SignupFormValues) => {
    setObjApiError(null);
    setStrInfo(null);
    try {
      const objResp = await signupApi({
        name: objData.name,
        email: objData.email,
        password: objData.password,
        employee_id: objData.employee_id ? objData.employee_id : undefined,
      });
      setStrPendingEmail(objResp.email);
      setStrStep('verify');
      setStrInfo(`A 6-digit verification code has been sent to ${objResp.email}.`);
    } catch (objErr: unknown) {
      const strMsg =
        (objErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Signup failed. Please try again.';
      setObjApiError(strMsg);
    }
  };

  // ── Step 2 form ─────────────────────────────────────────────────────────────
  const {
    register: registerVerify,
    handleSubmit: handleSubmitVerify,
    formState: { errors: objVerifyErrors, isSubmitting: bVerifySubmitting },
    reset: resetVerify,
  } = useForm<VerifyFormValues>({ resolver: zodResolver(objVerifySchema) });

  const onSubmitVerify = async (objData: VerifyFormValues) => {
    setObjApiError(null);
    setStrInfo(null);
    try {
      await verifyEmailApi({ email: strPendingEmail, code: objData.code });
      await refreshUser();
      objNavigate('/expense', { replace: true });
    } catch (objErr: unknown) {
      const strMsg =
        (objErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Verification failed. Please try again.';
      setObjApiError(strMsg);
    }
  };

  const onResend = async () => {
    setObjApiError(null);
    setStrInfo(null);
    setBResending(true);
    try {
      await resendCodeApi(strPendingEmail);
      resetVerify({ code: '' });
      setStrInfo('A new verification code has been emailed.');
    } catch (objErr: unknown) {
      const strMsg =
        (objErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Unable to resend the code. Please try again.';
      setObjApiError(strMsg);
    } finally {
      setBResending(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md space-y-6">

          {/* Brand mark */}
          <div className="flex flex-col items-center gap-2 cursor-default">
            <div className="w-3 h-12 rounded-full bg-[#00703C]" />
            <h1 className="text-2xl font-bold text-gray-900">Real Dashboard</h1>
            <p className="text-sm text-gray-500">Expense Management · Create your account</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 cursor-default">
              {strStep === 'signup' ? 'Sign up' : 'Verify your email'}
            </h2>

            {objApiError && <ErrorCard title="Something went wrong" error={objApiError} />}
            {strInfo && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 cursor-default">
                {strInfo}
              </div>
            )}

            {strStep === 'signup' ? (
              <SignupForm
                register={registerSignup}
                errors={objSignupErrors}
                onSubmit={handleSubmitSignup(onSubmitSignup)}
                bIsSubmitting={bSignupSubmitting}
                bShowPassword={bShowPassword}
                toggleShowPassword={() => setBShowPassword((b) => !b)}
              />
            ) : (
              <VerifyForm
                register={registerVerify}
                errors={objVerifyErrors}
                onSubmit={handleSubmitVerify(onSubmitVerify)}
                bIsSubmitting={bVerifySubmitting}
                strEmail={strPendingEmail}
                onResend={onResend}
                bResending={bResending}
                onBack={() => {
                  setStrStep('signup');
                  setObjApiError(null);
                  setStrInfo(null);
                }}
              />
            )}

            <p className="text-center text-xs text-gray-500 cursor-default">
              Already have an account?{' '}
              <Link to="/login" className="text-[#00703C] hover:underline cursor-pointer">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}



// ── Sub-component: Signup details form ────────────────────────────────────────
interface SignupFormProps {
  register: ReturnType<typeof useForm<SignupFormValues>>['register'];
  errors: ReturnType<typeof useForm<SignupFormValues>>['formState']['errors'];
  onSubmit: () => void;
  bIsSubmitting: boolean;
  bShowPassword: boolean;
  toggleShowPassword: () => void;
}

function SignupForm({
  register,
  errors,
  onSubmit,
  bIsSubmitting,
  bShowPassword,
  toggleShowPassword,
}: SignupFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1 cursor-default">
          Full name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          {...register('name')}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#00703C] focus:border-transparent cursor-text
            ${errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'}`}
          placeholder="Jane Doe"
          disabled={bIsSubmitting}
        />
        {errors.name && <p className="mt-1 text-xs text-red-600 cursor-default">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1 cursor-default">
          Email address <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          {...register('email')}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#00703C] focus:border-transparent cursor-text
            ${errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'}`}
          placeholder="you@riveredge.in"
          disabled={bIsSubmitting}
        />
        {errors.email && <p className="mt-1 text-xs text-red-600 cursor-default">{errors.email.message}</p>}
      </div>

      <div>
        <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700 mb-1 cursor-default">
          Employee ID <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="employee_id"
          type="text"
          {...register('employee_id')}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#00703C] focus:border-transparent cursor-text
            ${errors.employee_id ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'}`}
          placeholder="EMP001"
          disabled={bIsSubmitting}
        />
        {errors.employee_id && (
          <p className="mt-1 text-xs text-red-600 cursor-default">{errors.employee_id.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1 cursor-default">
          Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            id="password"
            type={bShowPassword ? 'text' : 'password'}
            autoComplete="new-password"
            {...register('password')}
            className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#00703C] focus:border-transparent cursor-text
              ${errors.password ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'}`}
            placeholder="••••••••"
            disabled={bIsSubmitting}
          />
          <button
            type="button"
            onClick={toggleShowPassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            tabIndex={-1}
            aria-label={bShowPassword ? 'Hide password' : 'Show password'}
          >
            {bShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.password && (
          <p className="mt-1 text-xs text-red-600 cursor-default">{errors.password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={bIsSubmitting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#00703C] hover:bg-[#005a30] text-white font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <UserPlus className="w-4 h-4" />
        {bIsSubmitting ? 'Sending code…' : 'Create account'}
      </button>
    </form>
  );
}


// ── Sub-component: Verification code form ─────────────────────────────────────
interface VerifyFormProps {
  register: ReturnType<typeof useForm<VerifyFormValues>>['register'];
  errors: ReturnType<typeof useForm<VerifyFormValues>>['formState']['errors'];
  onSubmit: () => void;
  bIsSubmitting: boolean;
  strEmail: string;
  onResend: () => void;
  bResending: boolean;
  onBack: () => void;
}

function VerifyForm({
  register,
  errors,
  onSubmit,
  bIsSubmitting,
  strEmail,
  onResend,
  bResending,
  onBack,
}: VerifyFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <p className="text-sm text-gray-600 cursor-default">
        Enter the 6-digit code we just sent to <strong>{strEmail}</strong>.
      </p>

      <div>
        <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1 cursor-default">
          Verification code <span className="text-red-500">*</span>
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          {...register('code')}
          className={`w-full px-3 py-2 border rounded-md tracking-[0.5em] text-center text-lg focus:outline-none focus:ring-2 focus:ring-[#00703C] focus:border-transparent cursor-text
            ${errors.code ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'}`}
          placeholder="••••••"
          disabled={bIsSubmitting}
        />
        {errors.code && <p className="mt-1 text-xs text-red-600 cursor-default">{errors.code.message}</p>}
      </div>

      <button
        type="submit"
        disabled={bIsSubmitting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#00703C] hover:bg-[#005a30] text-white font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ShieldCheck className="w-4 h-4" />
        {bIsSubmitting ? 'Verifying…' : 'Verify & continue'}
      </button>

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-500 hover:text-gray-700 cursor-pointer"
          disabled={bIsSubmitting}
        >
          ← Edit details
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={bResending || bIsSubmitting}
          className="text-[#00703C] hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {bResending ? 'Resending…' : 'Resend code'}
        </button>
      </div>
    </form>
  );
}
