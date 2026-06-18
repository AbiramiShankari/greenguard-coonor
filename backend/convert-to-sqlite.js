const fs = require('fs');

const path = 'e:/greenguard coonoor/backend/prisma/schema.prisma';
let schema = fs.readFileSync(path, 'utf-8');

// 1. Change provider
schema = schema.replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"');
schema = schema.replace(/url\s*=\s*env\("DATABASE_URL"\)/, 'url = "file:./dev.db"');

// 2. Remove enums
const enumRegex = /enum \w+ \{[\s\S]*?\}/g;
schema = schema.replace(enumRegex, (match) => {
    return match.split('\n').map(line => '// ' + line).join('\n');
});

// 3. Replace enum fields with String
schema = schema.replace(/role\s+Role/g, 'role String');
schema = schema.replace(/status\s+ComplaintStatus/g, 'status String');
schema = schema.replace(/status\s+CollectionStatus/g, 'status String');
schema = schema.replace(/priority\s+Priority/g, 'priority String');
schema = schema.replace(/wasteType\s+WasteType/g, 'wasteType String');
schema = schema.replace(/status\s+SMSStatus/g, 'status String');
schema = schema.replace(/fromStatus\s+ComplaintStatus/g, 'fromStatus String');
schema = schema.replace(/toStatus\s+ComplaintStatus/g, 'toStatus String');

// 4. Handle default values missing quotes
schema = schema.replace(/@default\((CITIZEN|ADMIN|COLLECTOR)\)/g, '@default("$1")');
schema = schema.replace(/@default\((NEW|IN_PROGRESS|RESOLVED|CLOSED|DUPLICATE)\)/g, '@default("$1")');
schema = schema.replace(/@default\((PENDING|ASSIGNED|PICKED_UP|COMPLETED|CANCELLED)\)/g, '@default("$1")');
schema = schema.replace(/@default\((LOW|MEDIUM|HIGH|CRITICAL)\)/g, '@default("$1")');
schema = schema.replace(/@default\((RECYCLABLE|ORGANIC|HAZARDOUS|E_WASTE|MIXED)\)/g, '@default("$1")');
schema = schema.replace(/@default\((SENT|FAILED|QUEUED)\)/g, '@default("$1")');

// 5. Handle Json fields
schema = schema.replace(/outputJson\s+Json\?/g, 'outputJson String?');

fs.writeFileSync(path, schema);
console.log('Converted schema to SQLite safely');
