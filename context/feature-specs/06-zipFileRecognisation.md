# ZIP File Recognition

## Task
Allow users to upload a ZIP file containing a software repository and process it for analysis.

## Requirements

1. Create a backend API to accept ZIP file uploads.
2. Use Multer to handle ZIP file uploads.
3. Validate that the uploaded file is a valid ZIP archive.
4. Store uploaded ZIP files temporarily in `server/src/storage/uploads/`.
5. Extract ZIP files using `adm-zip`.
6. Store extracted repositories temporarily in `server/src/storage/extracted/`.
7. Detect the repository's file and folder structure.
8. Scan repository files using Node.js `fs` and `path`.
9. Ignore unnecessary directories such as `node_modules`, `.git`, and `.env`.
10. Detect project technologies, frameworks, and dependencies.
11. Identify relevant configuration and package files.
12. Prepare the extracted repository data for the Repository Intelligence Engine.
13. Associate the uploaded repository with the authenticated Clerk user.
14. Store relevant repository metadata in MongoDB.
15. Handle invalid, corrupted, empty, and oversized ZIP files.
16. Clean up temporary ZIP and extracted files after processing.
17. Prevent unauthorized access to uploaded repository data.
18. Test valid ZIP, invalid ZIP, empty ZIP, and large ZIP scenarios.