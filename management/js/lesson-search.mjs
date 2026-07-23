const searchInput = document.querySelector('#lessonSearch');
const levelFilter = document.querySelector('#levelFilter');
const curriculumList = document.querySelector('#curriculumList');
const resultLabel = document.querySelector('#lessonSearchResult');
const emptyMessage = document.querySelector('#lessonSearchEmpty');

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function searchableText(card) {
  const heading = card.querySelector('h3')?.textContent || '';
  const details = card.querySelector('.list-card-head p')?.textContent || '';
  return normalize(`${heading} ${details}`);
}

function applyLessonSearch() {
  if (!searchInput || !curriculumList || !resultLabel || !emptyMessage) return;

  const sections = [...curriculumList.children].filter((element) => element.matches('section'));
  if (!sections.length) {
    resultLabel.hidden = true;
    emptyMessage.hidden = true;
    return;
  }

  const terms = normalize(searchInput.value).split(/\s+/).filter(Boolean);
  let totalLessons = 0;
  let visibleLessons = 0;

  for (const section of sections) {
    const cards = [...section.children].filter((element) => element.matches('.list-card'));
    let visibleInSection = 0;

    for (const card of cards) {
      totalLessons += 1;
      const haystack = searchableText(card);
      const matches = terms.every((term) => haystack.includes(term));
      card.hidden = !matches;
      if (matches) {
        visibleLessons += 1;
        visibleInSection += 1;
      }
    }

    section.hidden = visibleInSection === 0;
  }

  resultLabel.textContent = terms.length
    ? `${visibleLessons} of ${totalLessons} lessons shown`
    : `${totalLessons} lessons in this level`;
  resultLabel.hidden = totalLessons === 0;
  emptyMessage.hidden = terms.length === 0 || visibleLessons > 0;
}

let searchFrame = 0;
function scheduleLessonSearch() {
  cancelAnimationFrame(searchFrame);
  searchFrame = requestAnimationFrame(applyLessonSearch);
}

searchInput?.addEventListener('input', scheduleLessonSearch);
levelFilter?.addEventListener('change', scheduleLessonSearch);

if (curriculumList) {
  const observer = new MutationObserver(scheduleLessonSearch);
  observer.observe(curriculumList, { childList: true });
}

scheduleLessonSearch();
