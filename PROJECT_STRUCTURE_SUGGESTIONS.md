# Project Structure & Organization Suggestions

## Recommended Structure

- client/
  - src/
    - components/
    - hooks/
    - lib/
    - pages/
    - features/ (group by feature, e.g., resume, auth)
    - styles/
    - assets/
  - public/
  - index.html
- server/
  - controllers/
  - routes/
  - services/
  - models/
  - utils/
- shared/
  - schema.ts
- migrations/
- dist/
- tests/
  - unit/
  - integration/

## Additional Recommendations

- Move business logic out of UI components into hooks/services.
- Add more comments and documentation for complex logic.
- Add unit/integration tests for critical features.
- Use ESLint and Prettier for code quality and formatting.
- Use environment variables via `.env` files.
- Remove dead code and unused assets regularly.
