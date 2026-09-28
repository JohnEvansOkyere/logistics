export type SampleQuoteRequest = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  message: string;
};

export const sampleQuoteRequests: SampleQuoteRequest[] = [
  {
    id: "northstar-request",
    companyName: "Northstar Demo Ltd",
    contactName: "Alex Demo",
    email: "alex@northstar-demo.test",
    message: "Please contact me to discuss a fictional logistics enquiry.",
  },
  {
    id: "cedar-request",
    companyName: "Cedar Sample Company",
    contactName: "Jordan Sample",
    email: "jordan@cedar-sample.test",
    message: "I would like to discuss a sample shipment enquiry.",
  },
  {
    id: "harbor-request",
    companyName: "Harbor Example Trading",
    contactName: "Sam Example",
    email: "sam@harbor-example.test",
    message: "Please share information about a synthetic service request.",
  },
];
