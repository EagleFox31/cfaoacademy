import { hasFieldErrors, isValidEmail, resolveFormMessage } from './formErrors.js'

export const CONTACT_ERROR_CODES = {
  NAME_REQUIRED: 'NAME_REQUIRED',
  EMAIL_REQUIRED: 'EMAIL_REQUIRED',
  EMAIL_INVALID: 'EMAIL_INVALID',
  SUBJECT_REQUIRED: 'SUBJECT_REQUIRED',
  MESSAGE_REQUIRED: 'MESSAGE_REQUIRED',
  MESSAGE_TOO_SHORT: 'MESSAGE_TOO_SHORT',
  NETWORK: 'NETWORK',
  GENERIC: 'GENERIC',
}

export const CONTACT_SUCCESS_CODES = {
  MESSAGE_SENT: 'MESSAGE_SENT',
}

export const CONTACT_MESSAGES = {
  [CONTACT_ERROR_CODES.NAME_REQUIRED]: 'Indiquez votre nom.',
  [CONTACT_ERROR_CODES.EMAIL_REQUIRED]: 'Indiquez votre adresse e-mail.',
  [CONTACT_ERROR_CODES.EMAIL_INVALID]: 'Adresse e-mail invalide.',
  [CONTACT_ERROR_CODES.SUBJECT_REQUIRED]: 'Indiquez l’objet de votre message.',
  [CONTACT_ERROR_CODES.MESSAGE_REQUIRED]: 'Rédigez votre message.',
  [CONTACT_ERROR_CODES.MESSAGE_TOO_SHORT]: 'Le message doit contenir au moins 20 caractères.',
  [CONTACT_ERROR_CODES.NETWORK]: 'Envoi impossible. Vérifiez votre réseau et réessayez.',
  [CONTACT_ERROR_CODES.GENERIC]: 'Envoi impossible pour le moment. Réessayez plus tard.',
  [CONTACT_SUCCESS_CODES.MESSAGE_SENT]:
    'Votre message a bien été enregistré. L’équipe Academy vous répondra sous 48 h ouvrées.',
}

export const CONTACT_MESSAGES_EN = {
  [CONTACT_ERROR_CODES.NAME_REQUIRED]: 'Enter your name.',
  [CONTACT_ERROR_CODES.EMAIL_REQUIRED]: 'Enter your email address.',
  [CONTACT_ERROR_CODES.EMAIL_INVALID]: 'Invalid email address.',
  [CONTACT_ERROR_CODES.SUBJECT_REQUIRED]: 'Enter a subject for your message.',
  [CONTACT_ERROR_CODES.MESSAGE_REQUIRED]: 'Write your message.',
  [CONTACT_ERROR_CODES.MESSAGE_TOO_SHORT]: 'Message must be at least 20 characters.',
  [CONTACT_ERROR_CODES.NETWORK]: 'Unable to send. Check your network and try again.',
  [CONTACT_ERROR_CODES.GENERIC]: 'Unable to send right now. Please try again later.',
  [CONTACT_SUCCESS_CODES.MESSAGE_SENT]:
    'Your message has been received. The Academy team will reply within 2 business days.',
}

export const CONTACT_MESSAGES_PT = {
  [CONTACT_ERROR_CODES.NAME_REQUIRED]: 'Indique o seu nome.',
  [CONTACT_ERROR_CODES.EMAIL_REQUIRED]: 'Indique o seu endereço de e-mail.',
  [CONTACT_ERROR_CODES.EMAIL_INVALID]: 'Endereço de e-mail inválido.',
  [CONTACT_ERROR_CODES.SUBJECT_REQUIRED]: 'Indique o assunto da mensagem.',
  [CONTACT_ERROR_CODES.MESSAGE_REQUIRED]: 'Escreva a sua mensagem.',
  [CONTACT_ERROR_CODES.MESSAGE_TOO_SHORT]: 'A mensagem deve ter pelo menos 20 caracteres.',
  [CONTACT_ERROR_CODES.NETWORK]: 'Impossível enviar. Verifique a rede e tente novamente.',
  [CONTACT_ERROR_CODES.GENERIC]: 'Impossível enviar neste momento. Tente mais tarde.',
  [CONTACT_SUCCESS_CODES.MESSAGE_SENT]:
    'A sua mensagem foi registada. A equipa Academy responderá em 48 h úteis.',
}

const CONTACT_MESSAGE_CATALOGS = {
  fr: CONTACT_MESSAGES,
  en: CONTACT_MESSAGES_EN,
  pt: CONTACT_MESSAGES_PT,
}

export function getContactMessage(code, locale = 'fr') {
  const catalog = CONTACT_MESSAGE_CATALOGS[locale] ?? CONTACT_MESSAGES
  return resolveFormMessage(catalog, code)
}

export function validateContactForm({ name, email, subject, message }) {
  const fieldErrors = {}
  const trimmedName = name?.trim() ?? ''
  const trimmedEmail = email?.trim() ?? ''
  const trimmedSubject = subject?.trim() ?? ''
  const trimmedMessage = message?.trim() ?? ''

  if (!trimmedName) fieldErrors.name = CONTACT_ERROR_CODES.NAME_REQUIRED
  if (!trimmedEmail) fieldErrors.email = CONTACT_ERROR_CODES.EMAIL_REQUIRED
  else if (!isValidEmail(trimmedEmail)) fieldErrors.email = CONTACT_ERROR_CODES.EMAIL_INVALID
  if (!trimmedSubject) fieldErrors.subject = CONTACT_ERROR_CODES.SUBJECT_REQUIRED
  if (!trimmedMessage) fieldErrors.message = CONTACT_ERROR_CODES.MESSAGE_REQUIRED
  else if (trimmedMessage.length < 20) fieldErrors.message = CONTACT_ERROR_CODES.MESSAGE_TOO_SHORT

  return {
    ok: !hasFieldErrors(fieldErrors),
    fieldErrors,
    formError: null,
  }
}
