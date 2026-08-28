// Shared helper for filtering instructor-authored content (units, lessons, laboratories, quizzes)
// down to the sections/year levels it was targeted at. Empty target arrays mean "visible to everyone".
export function matchesContentTarget(
  targetSections: string[] | null | undefined,
  targetYearLevels: number[] | null | undefined,
  studentSection: string | null | undefined,
  studentYearLevel: number | null | undefined
): boolean {
  const sections = Array.isArray(targetSections) ? targetSections : [];
  const yearLevels = Array.isArray(targetYearLevels) ? targetYearLevels : [];

  const sectionOk = sections.length === 0 || (
    !!studentSection && sections.some((s) => String(s).trim().toLowerCase() === String(studentSection).trim().toLowerCase())
  );
  const yearOk = yearLevels.length === 0 || (
    Number.isInteger(Number(studentYearLevel)) && yearLevels.map(Number).includes(Number(studentYearLevel))
  );

  return sectionOk && yearOk;
}
