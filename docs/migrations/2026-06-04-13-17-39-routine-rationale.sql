-- Generation explainability: store the human-readable reason a routine was generated.
alter table workout_routines add column if not exists rationale text;
