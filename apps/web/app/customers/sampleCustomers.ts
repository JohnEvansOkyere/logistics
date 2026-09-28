export type CustomerProfile = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
};

export const sampleCustomers: CustomerProfile[] = [
  {
    id: "northstar-demo",
    companyName: "Northstar Demo Ltd",
    contactName: "Alex Demo",
    email: "alex@northstar-demo.test",
  },
  {
    id: "cedar-sample",
    companyName: "Cedar Sample Company",
    contactName: "Jordan Sample",
    email: "jordan@cedar-sample.test",
  },
  {
    id: "harbor-example",
    companyName: "Harbor Example Trading",
    contactName: "Sam Example",
    email: "sam@harbor-example.test",
  },
  {
    id: "summit-test",
    companyName: "Summit Test Services",
    contactName: "Casey Test",
    email: "casey@summit-test.test",
  },
];
