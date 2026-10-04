// The rules for what a Walnut account may be used for, in one place. The login page, the dashboard
// and the "Open your application" selector all ask here; the server enforces the same rules
// (api/account-lib.php: allowed_types), so changing what the page sends cannot get round them.
//
//   UNIVERSITY  the university flow only — never combined with anything else
//   AGENT       partner products, and short courses
//   STUDENT     short courses, and may become a partner later

export const UNIVERSITY = 'UNIVERSITY';
export const UNIVERSITY_ONLY = 'University applications are handled separately. Please continue with University only.';

// True when the chosen account types can exist together.
export const canCombine = (types) => !types.includes(UNIVERSITY) || types.length === 1;

// An account kept for a university: it sees the university flow and nothing else.
export const isUniversityOnly = (types) => types.includes(UNIVERSITY);

// What an existing account may add to itself: nothing for a university account, and never University.
export const canAdd = (types, extra) => !types.includes(UNIVERSITY) && extra !== UNIVERSITY;

/**
 * Keeps a set of tick boxes from holding University together with anything else. The University box is
 * the one with value "UNIVERSITY" or a `data-exclusive` attribute. Ticking it clears and disables the
 * rest, and `say` is given the reason to show (or '' once University is unticked).
 * `boxes` returns the inputs each time, so it works for markup that is redrawn.
 */
export function keepExclusive(root, boxes, say) {
  const apply = () => {
    const all = boxes();
    const university = all.find((input) => input.value === UNIVERSITY || 'exclusive' in input.dataset);
    if (!university) return;
    for (const input of all) {
      if (input === university) continue;
      if (university.checked) input.checked = false;
      input.disabled = university.checked;
      input.closest('label')?.classList.toggle('is-disabled', university.checked);
    }
    say(university.checked ? UNIVERSITY_ONLY : '');
  };
  root.addEventListener('change', (e) => {
    if (boxes().includes(e.target)) apply();
  });
  apply();
}
