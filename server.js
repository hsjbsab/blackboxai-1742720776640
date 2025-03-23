const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { startAutomation } = require('./automation');

const app = express();
const port = 8000;

// Increase timeout to 5 minutes
app.use(express.json({ limit: '50mb', extended: true }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Progress tracking
let currentProgress = {
    percent: 0,
    status: 'Not started',
    message: '',
    type: 'info',
    completed: false
};

app.use(express.static('public'));

// Endpoint to start automation
app.post('/start-automation', async (req, res) => {
    // Set timeout to 5 minutes
    req.setTimeout(300000);
    
    try {
        const { chromeProfilePath, promptsFilePath, outputDirectory, imageRatio } = req.body;

        // Reset progress
        currentProgress = {
            percent: 0,
            status: 'Starting automation...',
            message: 'Initializing browser...',
            type: 'info',
            completed: false
        };

        // Validate paths
        try {
            await Promise.all([
                fs.access(chromeProfilePath),
                fs.access(promptsFilePath),
                fs.access(outputDirectory)
            ]);
        } catch (error) {
            throw new Error(`Invalid path: ${error.message}`);
        }

        // Start automation in background
        startAutomation(
            chromeProfilePath,
            promptsFilePath,
            outputDirectory,
            imageRatio,
            (progress) => {
                currentProgress = { ...currentProgress, ...progress };
            }
        ).catch(error => {
            currentProgress = {
                ...currentProgress,
                status: 'Error',
                message: error.message,
                type: 'error',
                completed: true
            };
            console.error('Automation error:', error);
        });

        // Send immediate response
        res.json({ 
            message: 'Automation started',
            status: 'success'
        });

    } catch (error) {
        console.error('Start automation error:', error);
        res.status(400).json({ 
            error: error.message,
            status: 'error'
        });
    }
});

// Endpoint to get progress
app.get('/progress', (req, res) => {
    try {
        res.json(currentProgress);
    } catch (error) {
        console.error('Progress error:', error);
        res.status(500).json({ 
            error: error.message,
            status: 'error'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: err.message,
        status: 'error'
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});