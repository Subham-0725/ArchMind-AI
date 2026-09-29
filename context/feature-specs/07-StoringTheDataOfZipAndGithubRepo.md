## Overview# Store ZIP and GitHub Repository Data

## Task
Create a MongoDB model to store information about repositories uploaded or imported by users.

## Requirements

1. Create a `Repository` model in the backend.
2. Store the authenticated user's Clerk `userId`.
3. Store the repository source type: `zip` or `github`.
4. Store the file name for ZIP uploads.
5. Store the GitHub repository name for GitHub imports.
6. Store the GitHub repository URL when applicable.
7. Store the repository owner's name or username.
8. Store the repository upload/import timestamp.
9. Store the repository size when applicable.
10. Store the repository status such as `uploaded`, `processing`, `completed`, or `failed`.
11. Store the repository's file and folder structure after processing.
12. Store detected technologies, frameworks, and dependencies.
13. Store the local storage/extraction path when required for processing.
14. Store processing errors or failure details when applicable.
15. Associate every repository record with the authenticated user.
16. Prevent unauthorized users from accessing another user's repositories.
17. Prevent duplicate repository records for the same user.
18. Create APIs to create, retrieve, and update repository records.
19. Return repository metadata to the frontend after successful upload/import.
20. Keep raw ZIP files in temporary storage instead of storing the ZIP binary directly in MongoDB.
21. Clean up temporary ZIP and extracted files after processing.
22. Test ZIP upload, GitHub import, retrieval, duplicate, and failure cases.