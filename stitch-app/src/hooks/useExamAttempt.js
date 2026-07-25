/** Parked after Convex → Supabase hard cutover. */
export const useExamAttempt = () => ({
  status: 'parked',
  error: 'Exam mode is unavailable after the Supabase cutover.',
  start: async () => {},
  submit: async () => {},
});
export default useExamAttempt;
