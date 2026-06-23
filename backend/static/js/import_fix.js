document.addEventListener('DOMContentLoaded', function() {
    const fileInput = document.getElementById('id_import_file');
    const formatSelect = document.getElementById('id_input_format');
 
    if (fileInput && formatSelect) {
        fileInput.addEventListener('change', function() {
            const fileName = this.value;
            if (!fileName) return;
 
            // Grab the extension (e.g., 'csv' or 'xlsx')
            const ext = fileName.split('.').pop().toLowerCase();
 
            // Loop through the dropdown and select the matching format
            for (let i = 0; i < formatSelect.options.length; i++) {
                const optionText = formatSelect.options[i].text.toLowerCase();
                if (optionText.includes(ext)) {
                    formatSelect.selectedIndex = i;
                    break;
                }
            }
        });
    }
});