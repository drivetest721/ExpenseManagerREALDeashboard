/**
 * LoginPage — employee login form.
 * Validates with Zod + react-hook-form, calls useAuth().login(),
 * then redirects to the originally-requested route (or /expense).
 *
 * UI follows ui_schema_guidelines.md:
 *  - bg-gray-50 page background
 *  - bg-white card with shadow-sm border-gray-200
 *  - Primary button: bg-[#00703C] hover:bg-[#005a30]
 *  - Error banner from ErrorCard component
 */
import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { ErrorCard } from '../components/ErrorCard';
import { Footer } from '../components/Footer';

// ── Zod validation schema ──────────────────────────────────────────────────────
const objLoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof objLoginSchema>;

// ── Component ──────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { login } = useAuth();
  const objNavigate = useNavigate();
  const objLocation = useLocation();
  const [bShowPassword, setBShowPassword] = useState(false);
  const [objApiError, setObjApiError] = useState<string | null>(null);

  // Redirect to the page the user tried to access, default /expense
  const strFrom = (objLocation.state as { from?: string })?.from ?? '/expense';

  const {
    register,
    handleSubmit,
    formState: { errors: objErrors, isSubmitting: bIsSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(objLoginSchema),
  });

  const onSubmit = async (objData: LoginFormValues) => {
    setObjApiError(null);
    try {
      await login({ email: objData.email, password: objData.password });
      objNavigate(strFrom, { replace: true });
    } catch (objErr: unknown) {
      const strMsg =
        (objErr as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Login failed. Please try again.';
      setObjApiError(strMsg);
    }
  };

  return (
    <>
      {/* No AppHeader on login page — full-page centered card */}
      <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md space-y-6">

          {/* Brand mark with favicon logo */}
          <div className="flex flex-col items-center gap-3 cursor-default">
            <img src="/favicon.png" alt="Logo" className="w-16 h-16" />
            <h1 className="text-2xl font-bold text-gray-900">Real Dashboard</h1>
            <p className="text-sm text-gray-500">Expense Management · Sign in to continue</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 cursor-default">Sign in</h2>

            {objApiError && (
              <ErrorCard title="Authentication failed" error={objApiError} />
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1 cursor-default"
                >
                  Email address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#00703C] focus:border-transparent cursor-text
                    ${objErrors.email ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'}`}
                  placeholder="you@riveredge.in"
                  disabled={bIsSubmitting}
                />
                {objErrors.email && (
                  <p className="mt-1 text-xs text-red-600 cursor-default">{objErrors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1 cursor-default"
                >
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={bShowPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...register('password')}
                    className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#00703C] focus:border-transparent cursor-text
                      ${objErrors.password ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'}`}
                    placeholder="••••••••"
                    disabled={bIsSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setBShowPassword((b) => !b)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    tabIndex={-1}
                    aria-label={bShowPassword ? 'Hide password' : 'Show password'}
                  >
                    {bShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {objErrors.password && (
                  <p className="mt-1 text-xs text-red-600 cursor-default">{objErrors.password.message}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={bIsSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#00703C] hover:bg-[#005a30] text-white font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogIn className="w-4 h-4" />
                {bIsSubmitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-500 cursor-default">
              Don't have an account?{' '}
              <Link to="/signup" className="text-[#00703C] hover:underline cursor-pointer">
                Create one
              </Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
