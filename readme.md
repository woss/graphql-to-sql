https://stackoverflow.com/questions/12505158/generating-a-uuid-in-postgres-for-insert-statement

https://www.postgresql.org/docs/current/uuid-ossp.html
generate uuid

```sql
SELECT uuid_in(overlay(overlay(md5(random()::text || ':' || clock_timestamp()::text) placing '4' from 13) placing to_hex(floor(random()*(11-8+1) + 8)::int)::text from 17)::cstring);

```

## Tasks

- [ ] `DateTime` must be correctly handled. especially `createdAt` and `updatedAt`
- [ ] `ID!` default CID, currently autoincrement

## Notes

- Prisma uses CID for ID! type, we ahre using autoincrement INTEGER.
- `UUID` is defaulted to `UUIDV4` and excepcts that DB supports `uuid_generate_v4()`
