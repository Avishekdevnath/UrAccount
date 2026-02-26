export type JobOpening = {
  id: string;
  department: string;
  title: string;
  location: string;
  employmentType: string;
  salaryRange: string;
};

export const careerCultureItems = [
  {
    title: "Precision over speed",
    description: "We ship work that can stand up to financial scrutiny, not just sprint deadlines.",
    icon: "Microscope",
  },
  {
    title: "Ownership and growth",
    description: "Small-team ownership means your decisions directly shape product outcomes.",
    icon: "Sprout",
  },
  {
    title: "Distributed by design",
    description: "Remote-first collaboration across time zones with async-friendly operating habits.",
    icon: "Globe",
  },
];

export const careerBenefits = [
  {
    title: "Competitive compensation",
    description: "Market-aligned base salary with equity for full-time roles.",
    icon: "BadgeDollarSign",
  },
  {
    title: "Flexible PTO",
    description: "Paid leave policy built for sustainability and healthy pace.",
    icon: "Palmtree",
  },
  {
    title: "Health coverage",
    description: "Comprehensive medical coverage for employees and dependents.",
    icon: "HeartPulse",
  },
  {
    title: "Learning budget",
    description: "Annual stipend for courses, books, certifications, and conferences.",
    icon: "GraduationCap",
  },
  {
    title: "Home office support",
    description: "Initial setup budget for a productive remote workspace.",
    icon: "LaptopMinimalCheck",
  },
  {
    title: "Team offsites",
    description: "In-person planning and collaboration meetups throughout the year.",
    icon: "PlaneTakeoff",
  },
];

export const openJobs: JobOpening[] = [
  {
    id: "senior-backend-engineer",
    department: "Engineering",
    title: "Senior Backend Engineer",
    location: "Remote",
    employmentType: "Full-time",
    salaryRange: "$140k-$170k",
  },
  {
    id: "product-designer",
    department: "Design",
    title: "Product Designer",
    location: "Remote",
    employmentType: "Full-time",
    salaryRange: "$110k-$140k",
  },
  {
    id: "customer-success-manager",
    department: "Customer Success",
    title: "Customer Success Manager",
    location: "Remote",
    employmentType: "Full-time",
    salaryRange: "$85k-$110k",
  },
  {
    id: "accounting-domain-expert",
    department: "Product",
    title: "Accounting Domain Expert",
    location: "Remote",
    employmentType: "Full-time",
    salaryRange: "$100k-$130k",
  },
];

export const hiringSteps = [
  {
    step: "01",
    title: "Application Review",
    description: "We review every application and reply with clear next steps.",
  },
  {
    step: "02",
    title: "Intro Call",
    description: "Short conversation around role expectations and mutual fit.",
  },
  {
    step: "03",
    title: "Skills Interview",
    description: "Practical interview tied directly to the work you will do.",
  },
  {
    step: "04",
    title: "Offer",
    description: "Written offer with complete compensation and role details.",
  },
];

