## 1. Folder structure

- [x] 1.1 Move simple leaf components into dedicated folders
- [x] 1.2 Move shared utility helpers into stable utility modules
- [x] 1.3 Create folder conventions for component-local `types.ts` and `hooks.ts`

## 2. Component migration

- [x] 2.1 Move larger shell and explorer components into feature folders
- [x] 2.2 Split component-specific types into local `types.ts` files where useful
- [x] 2.3 Split component-specific hook orchestration into local `hooks.ts` files where useful

## 3. Import cleanup and verification

- [x] 3.1 Update imports across the component layer to match the new folder structure
- [x] 3.2 Verify the app still builds conceptually with no behavior changes introduced by the refactor
- [x] 3.3 Verify shared helpers are imported from utility modules rather than duplicated inside components
