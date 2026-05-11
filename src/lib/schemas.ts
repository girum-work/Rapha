import { z } from 'zod';

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signUpSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const onboardingStep1Schema = z.object({
  name: z.string().min(2, 'Name required'),
  age: z.coerce.number().min(1).max(120),
  blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
});

export const onboardingStep2Schema = z.object({
  allergies: z.string().optional(),
  medications: z.string().optional(),
  conditions: z.string().optional(),
});

export const onboardingStep3Schema = z.object({
  emergency_contact_name: z.string().min(2, 'Contact name required'),
  emergency_contact_phone: z
    .string()
    .regex(/^(09|07)\d{8}$/, 'Ethiopian phone: 09XXXXXXXX or 07XXXXXXXX'),
  location_consent: z.boolean(),
});

export type SignInForm = z.infer<typeof signInSchema>;
export type SignUpForm = z.infer<typeof signUpSchema>;

// For react-hook-form + zodResolver, the form values are best modeled as the
// schema *input* types (e.g. coerce() accepts string/unknown).
export type OnboardingStep1Form = z.input<typeof onboardingStep1Schema>;
export type OnboardingStep2Form = z.input<typeof onboardingStep2Schema>;
export type OnboardingStep3Form = z.input<typeof onboardingStep3Schema>;

export type OnboardingStep1 = z.output<typeof onboardingStep1Schema>;
export type OnboardingStep2 = z.output<typeof onboardingStep2Schema>;
export type OnboardingStep3 = z.output<typeof onboardingStep3Schema>;

