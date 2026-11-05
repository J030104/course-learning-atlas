export function setCoursePicker(courses, active) {
  const picker = document.getElementById('course-picker');
  const select = document.getElementById('courses');
  if (!picker || !select || courses.length < 2) return;
  select.replaceChildren(...courses.map(entry => new Option(entry.label, entry.url, false, entry.id === active)));
  select.onchange = () => location.assign(select.value);
  picker.hidden = false;
}
