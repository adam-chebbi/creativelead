# Desktop Worker Setup & Build Guide

The worker is an Electron application that runs on the user's local machine, automating a headless Chrome browser via Playwright to scrape Google Maps. 

## 1. Testing the Worker Locally

Before building the `.exe` or `.dmg` files, you can test the worker directly in development mode.

1. **Navigate and Install**:
   ```bash
   cd worker
   npm install
   ```

2. **Start the Worker**:
   ```bash
   npm start
   # or npm run dev
   ```
   This will launch the Electron app in development mode. The app will look for the API at the domain specified in your `package.json` (`apiBaseUrl`). If you are testing against your local dev server, temporarily change `apiBaseUrl` in `worker/package.json` to `http://localhost:3070`.

## 2. Generating Application Icons

Before packaging the app, Electron Builder needs application icons in the `worker/assets/` folder. 

We have provided a script that extracts the `favicon.ico` and `logo.png` from the `img/` folder and places them in the right spot.

From the root of your project, run:
```bash
python copy_icons.py
```
*Note: For macOS builds, you will ideally need an `icon.icns` file in the `img/` folder. Windows uses `.ico` and Linux uses `.png`.*

## 3. Building the Setup Executables

You can package the worker into a distributable setup file using `electron-builder`.

Run the appropriate command for your current operating system from inside the `worker/` directory:

- **For Windows (.exe):**
  ```bash
  npm run build:win
  ```
  *Output:* `worker/dist/CreativeLeads-Worker-Setup-2.0.0.exe`

- **For macOS (.dmg):**
  *(Must be run on a Mac)*
  ```bash
  npm run build:mac
  ```
  *Output:* `worker/dist/CreativeLeads-Worker-2.0.0.dmg`

- **For Linux (.AppImage):**
  ```bash
  npm run build:linux
  ```
  *Output:* `worker/dist/CreativeLeads-Worker-2.0.0.AppImage`

## 4. Serving the Setup Files to Users

To allow users to download the worker from the Dashboard's `/download` page:

1. **Upload the Executables**:
   Upload the compiled setup files (e.g., `.exe`, `.dmg`) from `worker/dist/` to your VPS. Place them in the Nginx static serving directory: `/var/www/autoreach/public/downloads/`

2. **Update the Manifest**:
   In `/var/www/autoreach/public/downloads/`, create or update a file named `manifest.json`:
   ```json
   {
     "windows": { "file": "CreativeLeads-Worker-Setup-2.0.0.exe", "sizeMB": 85 },
     "macos": { "file": "CreativeLeads-Worker-2.0.0.dmg", "sizeMB": 90 },
     "linux": { "file": "CreativeLeads-Worker-2.0.0.AppImage", "sizeMB": 80 }
   }
   ```
   *The Dashboard fetches this JSON file dynamically to display the correct download links to users.*
