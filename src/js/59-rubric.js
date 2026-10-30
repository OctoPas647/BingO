/* ================= BingO: rubric for long open answers =================
   A 30-point essay / ЛИС without criteria in its exam file would otherwise be self-graded as one
   anonymous "all points" row. This gives it four clear criteria; empty answers still score 0. */
const ESSAY_RUBRIC_30 = [
  { text: 'Съдържание и аргументация: отговаря на темата, има ясна позиция и подкрепящи примери.', points: 10 },
  { text: 'Структура и свързаност: въведение, развитие и заключение; логични връзки между частите.', points: 7 },
  { text: 'Езикова грамотност: правопис, пунктуация, словообразуване и подходящ речников запас.', points: 7 },
  { text: 'Формат и изисквания: обем, стил и съответствие с поставената задача.', points: 6 }
];

/* Returns the rubric to show for an open task. Tasks with their own criteria keep them; a 30-point
   essay / ЛИС without criteria gets the default above. Other open tasks keep Shelly's one-row fallback. */
function essayRubric(task) {
  if (Array.isArray(task.rubric) && task.rubric.length) return task.rubric;
  if (task.points >= 30) return ESSAY_RUBRIC_30;
  return rubricOf(task);
}
