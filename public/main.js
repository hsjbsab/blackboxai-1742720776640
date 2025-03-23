document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('automationForm');
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const statusText = document.getElementById('statusText');
    const logSection = document.getElementById('logSection');

    // Function to add log entry
    function addLog(message, type = 'info') {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logSection.appendChild(logEntry);
        logSection.scrollTop = logSection.scrollHeight;
    }

    // Function to update progress
    function updateProgress(percent, status) {
        progressBar.style.width = `${percent}%`;
        statusText.textContent = status;
    }

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Get form values
        const config = {
            chromeProfilePath: document.getElementById('chromeProfilePath').value,
            promptsFilePath: document.getElementById('promptsFilePath').value,
            outputDirectory: document.getElementById('outputDirectory').value,
            imageRatio: document.getElementById('imageRatio').value
        };

        try {
            // Show progress section
            progressSection.classList.remove('hidden');
            
            // Disable form
            form.querySelectorAll('input, select, button').forEach(el => el.disabled = true);

            // Add initial log
            addLog('Starting automation process...', 'info');

            // Send configuration to server
            const response = await fetch('/start-automation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }

            // Start polling for progress
            const pollProgress = async () => {
                try {
                    const progressResponse = await fetch('/progress');
                    const progressData = await progressResponse.json();

                    if (progressData.error) {
                        throw new Error(progressData.error);
                    }

                    updateProgress(progressData.percent, progressData.status);
                    addLog(progressData.message, progressData.type);

                    if (!progressData.completed) {
                        setTimeout(pollProgress, 1000);
                    } else {
                        // Re-enable form
                        form.querySelectorAll('input, select, button').forEach(el => el.disabled = false);
                        addLog('Automation completed successfully!', 'success');
                    }
                } catch (error) {
                    addLog(`Error: ${error.message}`, 'error');
                    // Re-enable form on error
                    form.querySelectorAll('input, select, button').forEach(el => el.disabled = false);
                }
            };

            // Start polling
            pollProgress();

        } catch (error) {
            addLog(`Error: ${error.message}`, 'error');
            // Re-enable form on error
            form.querySelectorAll('input, select, button').forEach(el => el.disabled = false);
        }
    });
});