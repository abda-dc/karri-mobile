export type RouteSubdivision = {
  name: string;
  cities: string[];
};

export type RouteCountry = {
  code: string;
  name: string;
  cities?: string[];
  subdivisions?: RouteSubdivision[];
};

export const ethiopianAirlinesRoutes: RouteCountry[] = [
  { code: "ET", name: "Ethiopia", cities: ["Addis Ababa"] },
  {
    code: "US",
    name: "United States",
    subdivisions: [
      { name: "District of Columbia / Virginia", cities: ["Washington DC / Dulles"] },
      { name: "New York", cities: ["New York"] },
      { name: "Illinois", cities: ["Chicago"] },
      { name: "Georgia", cities: ["Atlanta"] },
    ],
  },
  {
    code: "CA",
    name: "Canada",
    subdivisions: [{ name: "Ontario", cities: ["Toronto"] }],
  },
  { code: "GB", name: "United Kingdom", cities: ["London"] },
  { code: "KE", name: "Kenya", cities: ["Nairobi"] },
  { code: "UG", name: "Uganda", cities: ["Entebbe / Kampala"] },
  { code: "RW", name: "Rwanda", cities: ["Kigali"] },
  { code: "TZ", name: "Tanzania", cities: ["Dar es Salaam"] },
  { code: "ZA", name: "South Africa", cities: ["Johannesburg", "Cape Town"] },
  { code: "AE", name: "United Arab Emirates", cities: ["Dubai"] },
  { code: "SA", name: "Saudi Arabia", cities: ["Riyadh", "Jeddah"] },
  { code: "TR", name: "Turkey", cities: ["Istanbul"] },
  { code: "DE", name: "Germany", cities: ["Frankfurt"] },
  { code: "FR", name: "France", cities: ["Paris"] },
  { code: "IT", name: "Italy", cities: ["Rome", "Milan"] },
  { code: "IN", name: "India", cities: ["Delhi", "Mumbai"] },
  { code: "CN", name: "China", cities: ["Beijing", "Guangzhou", "Shanghai"] },
  { code: "NG", name: "Nigeria", cities: ["Lagos", "Abuja"] },
  { code: "GH", name: "Ghana", cities: ["Accra"] },
];
