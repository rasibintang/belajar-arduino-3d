/** Kesalahan dari lapisan akun. code: 'not-signed-in' | 'forbidden' | 'network' | 'invalid' */
export class AccountError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'AccountError';
    this.code = code;
  }
}
