document.addEventListener('DOMContentLoaded', () => {
    const arrowIcons = document.querySelectorAll('.arrow-icon');
  
    arrowIcons.forEach(icon => {
      icon.addEventListener('click', () => {
        const index = icon.getAttribute('data-index');
        const detailsRow = document.getElementById(`details-${index}`);
  
        if (detailsRow.classList.contains('hidden-details')) {
          detailsRow.classList.remove('hidden-details');
          icon.innerHTML = '&#9650;'; // Up arrow
        } else {
          detailsRow.classList.add('hidden-details');
          icon.innerHTML = '&#9660;'; // Down arrow
        }
      });
    });
  });
  