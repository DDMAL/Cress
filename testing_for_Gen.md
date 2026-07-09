Cress Testing Checklist

I (Gen) copied this document over from a google docs that Yu Chia made, which you can find [here](https://docs.google.com/document/d/1vOulD6XUE5h969P7fc_9EuJbyf_jZ7jdcrLaIzCbkXs/edit?tab=t.0). That document includes helpful screenshots that weren't copied over.

Demo site: https://integration-golive-pagesdev.cress-test.pages.dev

## 1. What you'll need
- A GitHub account.
- The login will request the public_repo scope. Please note: the app will automatically create a public repo under your account (<your-username>/cress-mappings), and everything you save there is publicly visible (this is by design for the demo). Feel free to use a test account if you'd rather not use your main one.
- A desktop browser (Chrome / Firefox / Edge / Safari all work).
- If you get a new version or something behaves oddly, do a hard refresh first (Windows: Ctrl+Shift+R; Mac: Cmd+Shift+R). Stale cache is the most common source of false bugs.

## 2. Test flow (in order, check off as you go)
### A. Log in

- [ ] Open the demo site, click Log in, and authorize in the GitHub popup (shown below; first login only). The page should then show you as logged in.

### B. Create / edit / save

- [x] Create a new file from the dashboard, open it in the editor, edit, and save.

- [x] (Cross-check) Look at <your-username>/cress-mappings on GitHub. A matching <filename>.csv should appear.

- [ ] MEI validation in the editor shows VALID (sample data is fine).

### C. Delete and restore

- [x] Delete a file: either right-click and choose Move to Trash, or drag it into Trash.

- [x] (Cross-check) The file should appear under the .trash/ folder in your GitHub repo.

- [x] Restore it from the Trash panel (right-click Put Back, or drag it out). The file returns to Your files and moves back to the repo root on GitHub.

### D. Viewing others' files (All Mappings)
 
- [x] The All Mappings panel lists other users' files.
 
- [x] Other people's files are read-only: you can't edit, delete, or drag them.

### E. Copy
 
- [x] Click "Copy to my mappings" on someone else's file. It should appear in your Your files and in your GitHub repo.
 
- [ ] Name-collision test: copy a file whose name matches one you already have. A dialog with Replace / Keep both / Cancel should appear, and Keep both creates "<name> copy".

### F. (Bonus) Cross-device

- [ ] Log in again from a different device (or after clearing browser data). Your files should automatically appear within 1 to 2 seconds, pulled from GitHub.

3. Notes
- Please avoid Rename for now. There is a known bug where the displayed name gets out of sync after renaming, and a fix is in progress.
- Worth reporting: login failures or 401/403 errors, a saved file not showing up on GitHub, or Your files being empty while your GitHub repo has files (try a hard refresh first). Screenshots and a snippet of the browser console are super helpful.

