# AGENTS

## Project Goal
Automate product listings from Google Drive skeletons to a React storefront using Google Sheets as the database.

## Automation Workflow
1. **Google Drive Scraper**: Agent monitors a specific Google Drive folder for "Skeletons" (Excel/JSON templates with product details).
2. **Sheet Processor**: Detected skeletons are parsed and their data is normalized then appended/updated in the Central Google Sheet DB.
3. **Frontend Sync**: The React Storefront fetches the latest data from the Google Sheet (via a proxy or direct API) to display the live inventory.
4. **Image Handling**: Google Drive image links are processed and cached for fast serving on the webstore.

## Tech Stack
- **Frontend**: React (Vite), Vanilla CSS
- **Database**: Google Sheets
- **Source**: Google Drive Folders
- **Integration**: Google Apps Script / Node.js Workers
