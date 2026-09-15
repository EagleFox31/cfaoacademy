import { hasFieldErrors, isValidEmail, isValidLoginIdentifier, resolveFormMessage } from './formErrors.js'

export const AUTH_ERROR_CODES = {
  EMAIL_REQUIRED: 'EMAIL_REQUIRED',
  EMAIL_INVALID: 'EMAIL_INVALID',
  PASSWORD_REQUIRED: 'PASSWORD_REQUIRED',
  PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  NETWORK: 'NETWORK',
  GENERIC: 'GENERIC',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  OIDC_UNAVAILABLE: 'OIDC_UNAVAILABLE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
}

export const AUTH_SUCCESS_CODES = {
  FORGOT_EMAIL_SENT: 'FORGOT_EMAIL_SENT',
}

export const AUTH_MESSAGES = {
  [AUTH_ERROR_CODES.EMAIL_REQUIRED]: 'Indiquez votre nom d’utilisateur ou e-mail.',
  [AUTH_ERROR_CODES.EMAIL_INVALID]: 'Nom d’utilisateur ou e-mail invalide.',
  [AUTH_ERROR_CODES.PASSWORD_REQUIRED]: 'Indiquez votre mot de passe.',
  [AUTH_ERROR_CODES.PASSWORD_TOO_SHORT]: 'Le mot de passe doit contenir au moins 8 caractères.',
  [AUTH_ERROR_CODES.INVALID_CREDENTIALS]: 'Identifiant ou mot de passe incorrect.',
  [AUTH_ERROR_CODES.NETWORK]: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
  [AUTH_ERROR_CODES.GENERIC]: 'Connexion impossible pour le moment. Réessayez plus tard.',
  [AUTH_ERROR_CODES.SERVICE_UNAVAILABLE]:
    'La connexion au portail apprenant sera bientôt disponible.',
  [AUTH_ERROR_CODES.OIDC_UNAVAILABLE]:
    'Service d\u2019authentification temporairement indisponible. Veuillez réessayer plus tard.',
  [AUTH_ERROR_CODES.SESSION_EXPIRED]:
    'Votre session de travail a expiré. Veuillez vous reconnecter.',
  [AUTH_SUCCESS_CODES.FORGOT_EMAIL_SENT]:
    'Si un compte est associé à cette adresse, vous recevrez un e-mail de réinitialisation sous quelques minutes.',
}

export const AUTH_MESSAGES_EN = {
  [AUTH_ERROR_CODES.EMAIL_REQUIRED]: 'Enter your username or email.',
  [AUTH_ERROR_CODES.EMAIL_INVALID]: 'Invalid username or email.',
  [AUTH_ERROR_CODES.PASSWORD_REQUIRED]: 'Enter your password.',
  [AUTH_ERROR_CODES.PASSWORD_TOO_SHORT]: 'Password must be at least 8 characters.',
  [AUTH_ERROR_CODES.INVALID_CREDENTIALS]: 'Incorrect username/email or password.',
  [AUTH_ERROR_CODES.NETWORK]: 'Unable to sign in. Check your network and try again.',
  [AUTH_ERROR_CODES.GENERIC]: 'Unable to sign in right now. Please try again later.',
  [AUTH_ERROR_CODES.SERVICE_UNAVAILABLE]:
    'Learner portal sign-in will be available soon.',
  [AUTH_ERROR_CODES.OIDC_UNAVAILABLE]:
    'Authentication service temporarily unavailable. Please try again later.',
  [AUTH_ERROR_CODES.SESSION_EXPIRED]:
    'Your work session has expired. Please sign in again.',
  [AUTH_SUCCESS_CODES.FORGOT_EMAIL_SENT]:
    'If an account exists for this address, you will receive a reset email within a few minutes.',
}

export const AUTH_MESSAGES_PT = {
  [AUTH_ERROR_CODES.EMAIL_REQUIRED]: 'Indique o seu nome de utilizador ou e-mail.',
  [AUTH_ERROR_CODES.EMAIL_INVALID]: 'Nome de utilizador ou e-mail inválido.',
  [AUTH_ERROR_CODES.PASSWORD_REQUIRED]: 'Indique a sua palavra-passe.',
  [AUTH_ERROR_CODES.PASSWORD_TOO_SHORT]: 'A palavra-passe deve ter pelo menos 8 caracteres.',
  [AUTH_ERROR_CODES.INVALID_CREDENTIALS]: 'Identificador ou palavra-passe incorretos.',
  [AUTH_ERROR_CODES.NETWORK]: 'Impossível iniciar sessão. Verifique a rede e tente novamente.',
  [AUTH_ERROR_CODES.GENERIC]: 'Impossível iniciar sessão neste momento. Tente mais tarde.',
  [AUTH_ERROR_CODES.SERVICE_UNAVAILABLE]:
    'O início de sessão no portail apprenant estará disponível em breve.',
  [AUTH_ERROR_CODES.OIDC_UNAVAILABLE]:
    'Serviço de autenticação temporariamente indisponível. Tente novamente mais tarde.',
  [AUTH_ERROR_CODES.SESSION_EXPIRED]:
    'A sua sessão de trabalho expirou. Inicie sessão novamente.',
  [AUTH_SUCCESS_CODES.FORGOT_EMAIL_SENT]:
    'Se existir uma conta associada a este endereço, receberá um e-mail de reposição em poucos minutos.',
}

const AUTH_MESSAGE_CATALOGS = {
  fr: AUTH_MESSAGES,
  en: AUTH_MESSAGES_EN,
  pt: AUTH_MESSAGES_PT,
}

export function getAuthMessage(code, locale = 'fr') {
  const catalog = AUTH_MESSAGE_CATALOGS[locale] ?? AUTH_MESSAGES
  return resolveFormMessage(catalog, code)
}

export function validateLogin({ email, password }) {
  const fieldErrors = {}
  const trimmedEmail = email?.trim() ?? ''
  const trimmedPassword = password?.trim() ?? ''

  if (!trimmedEmail) fieldErrors.email = AUTH_ERROR_CODES.EMAIL_REQUIRED
  else if (!isValidLoginIdentifier(trimmedEmail)) fieldErrors.email = AUTH_ERROR_CODES.EMAIL_INVALID

  if (!trimmedPassword) fieldErrors.password = AUTH_ERROR_CODES.PASSWORD_REQUIRED
  else if (trimmedPassword.length < 4) fieldErrors.password = AUTH_ERROR_CODES.PASSWORD_TOO_SHORT

  return {
    ok: !hasFieldErrors(fieldErrors),
    fieldErrors,
    formError: null,
  }
}

export function validateForgotPassword({ email }) {
  const fieldErrors = {}
  const trimmedEmail = email?.trim() ?? ''

  if (!trimmedEmail) fieldErrors.email = AUTH_ERROR_CODES.EMAIL_REQUIRED
  else if (!isValidEmail(trimmedEmail)) fieldErrors.email = AUTH_ERROR_CODES.EMAIL_INVALID

  return {
    ok: !hasFieldErrors(fieldErrors),
    fieldErrors,
    formError: null,
  }
}
