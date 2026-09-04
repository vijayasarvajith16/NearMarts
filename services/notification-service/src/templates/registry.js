'use strict';

const templates = {
  order_confirmed:
    'Hi {{buyerName}}, your order {{orderNumber}} from {{vendorName}} has been confirmed!',
  order_out_for_delivery:
    'Your order {{orderNumber}} is out for delivery.',
  order_delivered:
    'Your order {{orderNumber}} has been delivered. Enjoying it? Leave a review for {{vendorName}}!',
  payment_failed:
    'Payment for order {{orderNumber}} failed. Please retry or choose Cash on Delivery.',
  vendor_approved:
    'Congrats {{storeName}}, your store is now live on NearMart!',
  vendor_rejected:
    'Your store application needs changes: {{reason}}',
  new_order_vendor:
    'New order {{orderNumber}} received! Check your dashboard.',
};

/**
 * Compiles a template string by replacing {{key}} placeholders with variable values.
 */
function renderTemplate(templateName, variables = {}) {
  const templateStr = templates[templateName];
  if (!templateStr) {
    console.warn(`[templates] Template "${templateName}" not found in registry.`);
    return `Notification: ${templateName}`;
  }

  return templateStr.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] !== undefined && variables[key] !== null
      ? variables[key]
      : '';
  });
}

module.exports = {
  templates,
  renderTemplate,
};
