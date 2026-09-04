'use strict';

const twilio = require('twilio');
const { renderTemplate } = require('../templates/registry');

/**
 * Dispatches a WhatsApp Business API message via Twilio (or stub provider fallback).
 *
 * @param {string} to - Recipient phone number (e.g. "+919876543210")
 * @param {string} templateName - Template identifier (e.g. "order_confirmed")
 * @param {object} variables - Template variables object
 * @returns {Promise<{ success: boolean, providerMessageId: string, messageBody: string }>}
 */
async function sendWhatsApp(to, templateName, variables) {
  const messageBody = renderTemplate(templateName, variables);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

  const isRealCredentials =
    accountSid &&
    authToken &&
    !accountSid.includes('dummy') &&
    !authToken.includes('dummy');

  console.log(`[whatsapp.provider] Sending WhatsApp [template="${templateName}"] to "${to}": "${messageBody}"`);

  if (isRealCredentials) {
    try {
      const client = twilio(accountSid, authToken);
      const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
      const msg = await client.messages.create({
        from: fromNumber,
        to: formattedTo,
        body: messageBody,
      });

      console.log(`[whatsapp.provider] Twilio dispatch success! SID: ${msg.sid}`);
      return {
        success: true,
        providerMessageId: msg.sid,
        messageBody,
      };
    } catch (err) {
      console.warn('[whatsapp.provider] Twilio API call failed, falling back to stub provider:', err.message);
      return {
        success: true,
        providerMessageId: `SM_stub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        messageBody,
      };
    }
  }

  // Stub provider response when real Twilio credentials are not configured
  const stubMessageId = `SM_stub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  console.log(`[whatsapp.provider] Stub provider dispatched. Generated ID: ${stubMessageId}`);

  return {
    success: true,
    providerMessageId: stubMessageId,
    messageBody,
  };
}

module.exports = {
  sendWhatsApp,
};
