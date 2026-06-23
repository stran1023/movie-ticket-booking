(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  ready(function () {
    var isCombo = document.querySelector('#id_is_combo');
    if (!isCombo) return;

    // try multiple selectors across Django admin versions
    var categoryRow =
      document.querySelector('.form-row.field-category') ||
      document.querySelector('.fieldBox.field-category') ||
      // fallback: find the closest row by the input itself
      (function () {
        var el = document.querySelector('#id_category');
        return el ? el.closest('.form-row, .fieldBox, .flex-container') : null;
      })();

    if (!categoryRow) return;

    function toggle() {
      // hide when checked
      categoryRow.style.display = isCombo.checked ? 'none' : '';
    }

    isCombo.addEventListener('change', toggle);
    toggle(); // initial state
  });
})();
