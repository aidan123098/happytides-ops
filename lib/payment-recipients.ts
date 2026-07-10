export const paymentRecipients = ["imran", "dan", "jeremy", "aidan"] as const;

export type PaymentRecipient = (typeof paymentRecipients)[number];

export const paymentRecipientLabels: Record<PaymentRecipient, string> = {
  imran: "Imran",
  dan: "Dan",
  jeremy: "Jeremy",
  aidan: "Aidan"
};

export function paymentRecipientLabel(recipient?: string | null) {
  if (!recipient) return "Unassigned";
  return recipient in paymentRecipientLabels ? paymentRecipientLabels[recipient as PaymentRecipient] : recipient;
}
