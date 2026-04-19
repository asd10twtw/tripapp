# Security Specification - GoGoTrip

## Data Invariants
1. **Trip Integrity**: A trip must have a valid `ownerUid`, `memberUids` (array), `startDate`, and `endDate`.
2. **Member derivation**: Access to sub-collections (events, expenses, etc.) is strictly derived from the `memberUids` array in the parent `Trip` document.
3. **Identity Protection**: Users can only modify their own `UserProfile`.
4. **Member Mapping**: Users joining a trip can only link their `uid` to a `Member` record if they are the authenticated user.
5. **Invite Code lookup**: To support joining, authenticated users can search for trips by `inviteCode`.

## The "Dirty Dozen" Payloads (Deny-list)

1. **Identity Spoofing**: Attempting to create a trip with an `ownerUid` that doesn't match the authenticated user.
2. **Member Injection**: Attempting to update a trip's `memberUids` to include a user who is not the requester (privilege escalation).
3. **Orphaned Access**: Attempting to read a trip's sub-collection without being a member of the parent trip.
4. **State Shortcutting**: Attempting to change the `inviteCode` of a trip someone else owns.
5. **Resource Poisoning**: Use of extremely large strings in document IDs or fields to cause "Denial of Wallet".
6. **Self-Promotion**: Attempting to set `isAdmin` or similar flags on a user profile.
7. **PII Leakage**: Reading other users' profiles without authentication or reading private user info.
8. **Shadow Update**: Adding a field like `isGlobalAdmin: true` to a trip object.
9. **Relational Sync Break**: Deleting a trip without deleting its sub-collections (if handled by rules).
10. **Timestamp Fraud**: Providing a client-side `createdAt` that is in the past or future.
11. **Query Scraping**: Performing a query on `/trips` without filtering by membership or invite code.
12. **Double Claiming**: Claiming an existing `Member` record in a trip with a different `uid` than the requester.

## Security Rule Goals
1. Default Deny catch-all.
2. `isValidTrip` helper with strict field verification and size limits.
3. `canAccessTrip` helper using `get()` to verify membership synchronously.
4. Use `affectedKeys().hasOnly()` for all updates to prevent shadow fields.
5. Secure `list` queries on trips using membership or invite code check.
