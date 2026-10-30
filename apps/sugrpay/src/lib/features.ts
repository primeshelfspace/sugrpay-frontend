/**
 * Creating invoices and customers from this website is switched off for now:
 * the New Invoice and Add Customer buttons are hidden and their pages send
 * people back to the list. Records still arrive through Zoho and existing
 * drafts can still be edited.
 *
 * To switch it back on, set NEXT_PUBLIC_ALLOW_CREATE_RECORDS=true in the
 * website's environment (Amplify) and rebuild. It is read at build time.
 */
export const CREATE_RECORDS_ENABLED = process.env['NEXT_PUBLIC_ALLOW_CREATE_RECORDS'] === 'true';
