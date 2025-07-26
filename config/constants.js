// config/constants.js

export const SHEETS_WEBAPP_URL = process.env.SHEETS_WEBAPP_URL || '';
export const RECAPTCHA_SECRET   = process.env.RECAPTCHA_SECRET || '';
export const RATE_LIMIT_WINDOW  = parseInt(process.env.RATE_LIMIT_WINDOW  || '60');
export const RATE_LIMIT_MAX     = parseInt(process.env.RATE_LIMIT_MAX     || '5');
