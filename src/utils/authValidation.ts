const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
    return EMAIL_RE.test(email.trim());
}

export type FieldErrors = Partial<Record<string, string>>;

export function validateLogin(email: string, password: string): FieldErrors {
    const errors: FieldErrors = {};
    if (!email.trim()) {
        errors.email = 'Email is required';
    } else if (!isValidEmail(email)) {
        errors.email = 'Enter a valid email address';
    }
    if (!password.trim()) {
        errors.password = 'Password is required';
    }
    return errors;
}

export function validateRegister(
    name: string,
    email: string,
    password: string,
    confirmPassword: string,
): FieldErrors {
    const errors: FieldErrors = {};
    if (!name.trim()) {
        errors.name = 'Name is required';
    } else if (name.trim().length < 2) {
        errors.name = 'Name must be at least 2 characters';
    }
    if (!email.trim()) {
        errors.email = 'Email is required';
    } else if (!isValidEmail(email)) {
        errors.email = 'Enter a valid email address';
    }
    if (!password.trim()) {
        errors.password = 'Password is required';
    } else if (password.length < 8) {
        errors.password = 'Password must be at least 8 characters';
    }
    if (!confirmPassword.trim()) {
        errors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
    }
    return errors;
}
