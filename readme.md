https://stackoverflow.com/questions/12505158/generating-a-uuid-in-postgres-for-insert-statement

generate uuid

```sql
SELECT uuid_in(overlay(overlay(md5(random()::text || ':' || clock_timestamp()::text) placing '4' from 13) placing to_hex(floor(random()*(11-8+1) + 8)::int)::text from 17)::cstring);

```
