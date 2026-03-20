# Sequelize Reference

Decision frameworks, operator tables, hook lifecycle, and anti-patterns for Sequelize ORM.

---

<decision_framework>

## Decision Framework

### When to Use Which Query Method?

```
Need to fetch a record?
├─ By primary key? → findByPk(id)
├─ By unique field? → findOne({ where: { email } })
├─ First matching with conditions? → findOne({ where, order })
├─ Multiple records? → findAll({ where, order, limit })
├─ Need count only? → count({ where })
├─ Need existence check? → findOne() !== null (or count() > 0)
└─ Need record or throw? → findByPk(id, { rejectOnEmpty: true })
```

### When to Use Which Write Method?

```
Creating records?
├─ Single record → create({ field: value })
├─ Single with association → create() + include or separate create
├─ Multiple records → bulkCreate([...])
├─ Create if not exists → findOrCreate({ where, defaults })
└─ Create or update → upsert({ field: value })

Updating records?
├─ Single instance → instance.update({ field: value })
├─ Single by condition → Model.update({ data }, { where })
├─ Increment/decrement → instance.increment('field', { by: N })
└─ Multiple matching → Model.update({ data }, { where })

Deleting records?
├─ Single instance → instance.destroy()
├─ Multiple matching → Model.destroy({ where })
├─ Hard delete (paranoid) → instance.destroy({ force: true })
└─ Restore soft-deleted → instance.restore()
```

### When to Use Which Transaction Type?

```
What type of operation?
├─ Need auto-commit/rollback with simple logic
│   └─ Managed: sequelize.transaction(async (t) => {...})
├─ Need manual control over commit/rollback timing
│   └─ Unmanaged: const t = await sequelize.transaction(); try/catch
├─ Want transactions auto-passed to all queries in callback
│   └─ CLS: Sequelize.useCLS(namespace) (v6) or default (v7)
└─ Single operation
    └─ No transaction needed (single query is already atomic)
```

### When to Use Which Association Type?

```
What's the relationship?
├─ One record owns one other → hasOne + belongsTo
├─ One record owns many → hasMany + belongsTo
├─ Many records relate to many → belongsToMany + through table
│   ├─ No extra fields on join → implicit through: "TableName"
│   └─ Extra fields on join → explicit through: JoinModel
└─ Self-referencing (tree/hierarchy) → hasMany + belongsTo on same model
```

### Eager Loading Strategy?

```
How to load related data?
├─ Need related data with parent? → include (eager load)
│   ├─ All fields of relation? → include: [{ model: X, as: "alias" }]
│   ├─ Specific fields only? → include with attributes: ["field"]
│   ├─ Filter related records? → include with where clause
│   ├─ Require relation exists? → required: true (INNER JOIN)
│   └─ Large has-many set? → separate: true (2 queries, avoids cartesian product)
├─ Load later if needed? → instance.getAssociation() (lazy load)
└─ Don't need related data? → No include (avoid unnecessary JOINs)
```

</decision_framework>

---

<performance>

## Performance Optimization

### Indexing Strategy

Add indexes in model definitions or migrations for frequently queried fields:

```typescript
Post.init(
  {
    /* attributes */
  },
  {
    sequelize,
    tableName: "posts",
    indexes: [
      { fields: ["author_id"] }, // Foreign key lookup
      { fields: ["published"] }, // Boolean filter
      { fields: ["created_at"] }, // Sort by date
      { fields: ["author_id", "published", "created_at"] }, // Composite for common query
      { unique: true, fields: ["slug"] }, // Unique constraint
    ],
  },
);
```

### Use attributes to Limit Columns

```typescript
// WRONG: Fetching all columns when only need some
const users = await User.findAll();

// CORRECT: Select only needed columns
const users = await User.findAll({
  attributes: ["id", "name", "email"],
});
```

### Use separate: true for Large Has-Many

```typescript
// When a user has thousands of posts, JOIN creates cartesian product
// separate: true runs 2 queries instead (1 for users, 1 for posts)
const users = await User.findAll({
  include: [{ model: Post, as: "posts", separate: true }],
});
```

### Batch Operations

```typescript
// WRONG: Individual creates in loop
for (const data of items) {
  await Item.create(data);
}

// CORRECT: Batch create
await Item.bulkCreate(items, {
  validate: true, // Run model validations
  ignoreDuplicates: true, // Skip on unique conflict
});
```

### Connection Pooling

Configure pool size based on workload:

```typescript
const MAX_POOL_SIZE = 10;
const MIN_POOL_SIZE = 2;
const ACQUIRE_TIMEOUT_MS = 30000;
const IDLE_TIMEOUT_MS = 10000;

const sequelize = new Sequelize({
  // ...
  pool: {
    max: MAX_POOL_SIZE, // Max concurrent connections
    min: MIN_POOL_SIZE, // Min connections to keep alive
    acquire: ACQUIRE_TIMEOUT_MS, // Max time to acquire connection
    idle: IDLE_TIMEOUT_MS, // Max time connection can be idle
  },
});
```

</performance>

---

<hook_lifecycle>

## Hook Lifecycle Reference

### Hook Firing Order (Single Instance)

```
create:   beforeValidate → afterValidate → beforeCreate → afterCreate
update:   beforeValidate → afterValidate → beforeUpdate → afterUpdate
destroy:  beforeDestroy → afterDestroy
```

### Bulk Operations

```
bulkCreate:  beforeBulkCreate → [per-instance hooks if individualHooks: true] → afterBulkCreate
update:      beforeBulkUpdate → [per-instance hooks if individualHooks: true] → afterBulkUpdate
destroy:     beforeBulkDestroy → [per-instance hooks if individualHooks: true] → afterBulkDestroy
```

### What Does NOT Fire Hooks

| Operation                             | Fires Hooks?    | Workaround                       |
| ------------------------------------- | --------------- | -------------------------------- |
| `bulkCreate` (default)                | Only bulk hooks | `{ individualHooks: true }`      |
| `Model.update({ where })`             | Only bulk hooks | `{ individualHooks: true }`      |
| `Model.destroy({ where })`            | Only bulk hooks | `{ individualHooks: true }`      |
| Database cascades (ON DELETE CASCADE) | No              | Set `hooks: true` on association |
| Raw queries                           | No              | None --- hooks are ORM-level     |
| `queryInterface` methods              | No              | None --- migration-level         |

</hook_lifecycle>

---

## Quick Reference Tables

### DataTypes

| Sequelize Type                      | JavaScript Type | Notes                        |
| ----------------------------------- | --------------- | ---------------------------- |
| `DataTypes.STRING`                  | `string`        | VARCHAR(255) default         |
| `DataTypes.STRING(1234)`            | `string`        | Custom length                |
| `DataTypes.TEXT`                    | `string`        | Unlimited length             |
| `DataTypes.INTEGER`                 | `number`        | 32-bit integer               |
| `DataTypes.BIGINT`                  | `string`        | Returns string, not number   |
| `DataTypes.FLOAT`                   | `number`        | Floating point               |
| `DataTypes.DECIMAL(10, 2)`          | `string`        | Returns string for precision |
| `DataTypes.BOOLEAN`                 | `boolean`       |                              |
| `DataTypes.DATE`                    | `Date`          | With timezone                |
| `DataTypes.DATEONLY`                | `string`        | YYYY-MM-DD format            |
| `DataTypes.JSON`                    | `object`        | Native JSON (PostgreSQL)     |
| `DataTypes.JSONB`                   | `object`        | Binary JSON (PostgreSQL)     |
| `DataTypes.UUID`                    | `string`        |                              |
| `DataTypes.ENUM("a", "b")`          | `string`        |                              |
| `DataTypes.ARRAY(DataTypes.STRING)` | `string[]`      | PostgreSQL only              |

### Operators (Op)

| Operator               | SQL              | Example                                   |
| ---------------------- | ---------------- | ----------------------------------------- |
| `Op.eq`                | `=`              | `{ [Op.eq]: 5 }`                          |
| `Op.ne`                | `<>`             | `{ [Op.ne]: 5 }`                          |
| `Op.gt` / `Op.gte`     | `>` / `>=`       | `{ [Op.gt]: 5 }`                          |
| `Op.lt` / `Op.lte`     | `<` / `<=`       | `{ [Op.lt]: 5 }`                          |
| `Op.between`           | `BETWEEN`        | `{ [Op.between]: [1, 10] }`               |
| `Op.in` / `Op.notIn`   | `IN` / `NOT IN`  | `{ [Op.in]: [1, 2, 3] }`                  |
| `Op.like` / `Op.iLike` | `LIKE` / `ILIKE` | `{ [Op.like]: "%search%" }`               |
| `Op.and`               | `AND`            | `{ [Op.and]: [cond1, cond2] }`            |
| `Op.or`                | `OR`             | `{ [Op.or]: [cond1, cond2] }`             |
| `Op.not`               | `NOT`            | `{ [Op.not]: condition }`                 |
| `Op.is` / `Op.isNot`   | `IS` / `IS NOT`  | `{ [Op.is]: null }`                       |
| `Op.col`               | Column ref       | `{ [Op.eq]: sequelize.col("other_col") }` |

### Checklist

#### Before Deploying

- [ ] All model properties use `declare`
- [ ] Explicit `tableName` on all models
- [ ] `foreignKey` specified on all associations
- [ ] `as` alias consistent between definition and includes
- [ ] Pool configured for expected load
- [ ] Indexes on frequently filtered/sorted columns
- [ ] `paranoid: true` only on models with `timestamps: true`
- [ ] Graceful shutdown calls `sequelize.close()`

#### Code Review Checklist

- [ ] No N+1 queries (use `include` for associations)
- [ ] `{ transaction: t }` on every query in transaction callbacks
- [ ] Named constants for limits, timeouts, page sizes
- [ ] No `findAll` without `limit` in production endpoints
- [ ] Bulk operations specify `{ individualHooks: true }` if hooks are needed
- [ ] `as` alias matches between association definition and `include`
