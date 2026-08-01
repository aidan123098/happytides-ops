"use client";

import { Input } from "@/components/ui/input";
import type { ShippingAddress } from "@/types/domain";

export const emptyShippingAddress: ShippingAddress = {
  recipientName: "",
  company: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "US",
  phone: "",
  email: "",
  residential: true
};

type ShippingAddressFieldsProps = {
  value: ShippingAddress;
  onChange: (value: ShippingAddress) => void;
  disabled?: boolean;
};

export function ShippingAddressFields({ value, onChange, disabled }: ShippingAddressFieldsProps) {
  function update(patch: Partial<ShippingAddress>) {
    onChange({ ...value, ...patch });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="text-xs font-semibold uppercase text-slate-500">Recipient</span>
        <Input className="mt-1 bg-white" disabled={disabled} value={value.recipientName} onChange={(event) => update({ recipientName: event.target.value })} />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase text-slate-500">Company <span className="normal-case font-normal">(optional)</span></span>
        <Input className="mt-1 bg-white" disabled={disabled} value={value.company ?? ""} onChange={(event) => update({ company: event.target.value })} />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-xs font-semibold uppercase text-slate-500">Address</span>
        <Input className="mt-1 bg-white" disabled={disabled} value={value.line1} onChange={(event) => update({ line1: event.target.value })} />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-xs font-semibold uppercase text-slate-500">Apartment, suite <span className="normal-case font-normal">(optional)</span></span>
        <Input className="mt-1 bg-white" disabled={disabled} value={value.line2 ?? ""} onChange={(event) => update({ line2: event.target.value })} />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase text-slate-500">City</span>
        <Input className="mt-1 bg-white" disabled={disabled} value={value.city} onChange={(event) => update({ city: event.target.value })} />
      </label>
      <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase text-slate-500">State</span>
          <Input className="mt-1 bg-white uppercase" disabled={disabled} maxLength={2} value={value.region} onChange={(event) => update({ region: event.target.value.toUpperCase() })} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase text-slate-500">ZIP</span>
          <Input className="mt-1 bg-white" disabled={disabled} inputMode="numeric" value={value.postalCode} onChange={(event) => update({ postalCode: event.target.value })} />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-semibold uppercase text-slate-500">Phone <span className="normal-case font-normal">(optional)</span></span>
        <Input className="mt-1 bg-white" disabled={disabled} type="tel" value={value.phone ?? ""} onChange={(event) => update({ phone: event.target.value })} />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase text-slate-500">Email <span className="normal-case font-normal">(optional)</span></span>
        <Input className="mt-1 bg-white" disabled={disabled} type="email" value={value.email ?? ""} onChange={(event) => update({ email: event.target.value })} />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
        <input type="checkbox" checked={value.residential} disabled={disabled} onChange={(event) => update({ residential: event.target.checked })} />
        Residential address
      </label>
    </div>
  );
}
