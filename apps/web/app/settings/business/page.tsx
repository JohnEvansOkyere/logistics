import { BusinessSettingsForm } from "./BusinessSettingsForm";

export const metadata = {
  title: "Business settings | BJH Logistics",
  description: "Issuer details, currencies, tax lines, numbering and defaults.",
};

export default function BusinessSettingsPage() {
  return <BusinessSettingsForm />;
}
