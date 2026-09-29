import { QuoteDetail } from "../QuoteDetail";

export const metadata = { title: "Quote | BJH Logistics" };

export default async function QuotePage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  return <QuoteDetail quoteId={quoteId} />;
}
