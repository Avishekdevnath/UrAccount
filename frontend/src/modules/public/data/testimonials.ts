export type PublicTestimonial = {
  quote: string;
  author: string;
  role: string;
  initials: string;
};

export const publicTestimonials: PublicTestimonial[] = [
  {
    quote:
      "We closed our clean month-end in under two hours. Earlier it took nearly a week of manual reconciliation.",
    author: "Sarah Lin",
    role: "CFO, Meridian Logistics",
    initials: "SL",
  },
  {
    quote:
      "The audit trail alone justified the switch. We can now produce evidence in minutes, not days.",
    author: "Rajan Kapoor",
    role: "Finance Director, Praxis Health",
    initials: "RK",
  },
  {
    quote:
      "UrAccount replaced multiple spreadsheets and disconnected tools. Finance now runs from one reliable source.",
    author: "Mia Torres",
    role: "Head of Finance, Cloudset Inc.",
    initials: "MT",
  },
];

