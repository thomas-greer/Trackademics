const RAW_SCHOOLS = [
  { name: "University of Utah", abbr: "UofU" },
  { name: "Utah State University", abbr: "USU" },
  { name: "Brigham Young University", abbr: "BYU" },
  { name: "Utah Valley University", abbr: "UVU" },
  { name: "Weber State University", abbr: "WSU" },
  { name: "Southern Utah University", abbr: "SUU" },
  { name: "Utah Tech University", abbr: "UTU" },
  { name: "Westminster University", abbr: "WU" },
  { name: "Salt Lake Community College", abbr: "SLCC" },
  { name: "Harvard University", abbr: "HARV" },
  { name: "Stanford University", abbr: "STAN" },
  { name: "Massachusetts Institute of Technology", abbr: "MIT" },
  { name: "Yale University", abbr: "YALE" },
  { name: "Princeton University", abbr: "PRIN" },
  { name: "Columbia University", abbr: "COLUM" },
  { name: "University of Pennsylvania", abbr: "UPENN" },
  { name: "Duke University", abbr: "DUKE" },
  { name: "Northwestern University", abbr: "NU" },
  { name: "Johns Hopkins University", abbr: "JHU" },
  { name: "University of Chicago", abbr: "UCHIC" },
  { name: "University of California, Los Angeles", abbr: "UCLA" },
  { name: "University of California, Berkeley", abbr: "UCB" },
  { name: "University of Southern California", abbr: "USC" },
  { name: "New York University", abbr: "NYU" },
  { name: "University of Michigan", abbr: "UMICH" },
  { name: "University of Texas at Austin", abbr: "UT" },
  { name: "Texas A&M University", abbr: "TAMU" },
  { name: "University of Florida", abbr: "UF" },
  { name: "Florida State University", abbr: "FSU" },
  { name: "University of Georgia", abbr: "UGA" },
  { name: "Ohio State University", abbr: "OSU" },
  { name: "Penn State University", abbr: "PSU" },
  { name: "University of Washington", abbr: "UW" },
  { name: "University of Wisconsin-Madison", abbr: "UWIS" },
  { name: "University of North Carolina at Chapel Hill", abbr: "UNC" },
  { name: "University of Virginia", abbr: "UVA" },
  { name: "University of Maryland", abbr: "UMD" },
  { name: "Purdue University", abbr: "PURD" },
  { name: "Indiana University Bloomington", abbr: "IU" },
  { name: "University of Illinois Urbana-Champaign", abbr: "UIUC" },
  { name: "University of Minnesota Twin Cities", abbr: "UMN" },
  { name: "University of Arizona", abbr: "UAZ" },
  { name: "Arizona State University", abbr: "ASU" },
  { name: "University of Colorado Boulder", abbr: "UCBLD" },
  { name: "University of Oregon", abbr: "UO" },
  { name: "University of California, San Diego", abbr: "UCSD" },
  { name: "University of California, Davis", abbr: "UCD" },
  { name: "University of California, Irvine", abbr: "UCI" },
  { name: "University of California, Santa Barbara", abbr: "UCSB" },
  { name: "Boston University", abbr: "BU" },
];

export const SCHOOLS = [...RAW_SCHOOLS].sort((a, b) =>
  a.name.localeCompare(b.name)
);

const SCHOOL_ABBR = SCHOOLS.reduce((acc, school) => {
  acc[school.name.toLowerCase()] = school.abbr;
  return acc;
}, {});

export function getSchoolAbbreviation(name) {
  if (!name) return "";
  const clean = String(name).trim();
  if (!clean) return "";
  return SCHOOL_ABBR[clean.toLowerCase()] || clean;
}
