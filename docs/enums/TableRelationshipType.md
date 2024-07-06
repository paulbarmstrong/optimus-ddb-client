[optimus-ddb-client](../index.md) / TableRelationshipType

# Enumeration: TableRelationshipType

Type representing the nature of a relationship between two Tables

## Table of contents

### Enumeration Members

- [MANY\_TO\_MANY](TableRelationshipType.md#many_to_many)
- [MANY\_TO\_ONE](TableRelationshipType.md#many_to_one)
- [ONE\_TO\_MANY](TableRelationshipType.md#one_to_many)
- [ONE\_TO\_ONE](TableRelationshipType.md#one_to_one)

## Enumeration Members

### MANY\_TO\_MANY

• **MANY\_TO\_MANY** = ``"MANY_TO_MANY"``

Items in this Table are coupled to any number of items in the peer Table, and vice versa.

Items of each Table have an array attribute which identifies its coupled items in the other Table.

#### Defined in

[src/Types.ts:75](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L75)

___

### MANY\_TO\_ONE

• **MANY\_TO\_ONE** = ``"MANY_TO_ONE"``

Items in this Table are coupled to one item in the peer Table.

Items in the peer Table map to any number of items in this Table. Items of this Table have a string or number
attribute which identifies its coupled item in the peer Table. Items of the peer Table have an array attribute
which identifies its coupled items in this Table.

#### Defined in

[src/Types.ts:69](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L69)

___

### ONE\_TO\_MANY

• **ONE\_TO\_MANY** = ``"ONE_TO_MANY"``

Items in this Table are coupled to any number of items in the peer Table.

Items of this Table have an array attribute which identifies its coupled items in the peer Table. Items of the
peer Table have a string or number attribute which identifies its coupled item in this Table.

#### Defined in

[src/Types.ts:61](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L61)

___

### ONE\_TO\_ONE

• **ONE\_TO\_ONE** = ``"ONE_TO_ONE"``

There is a 1:1 coupling between each item in this Table and the peer Table.

Items of each Table have a string or number attribute which identifies its coupled item in the other Table.

#### Defined in

[src/Types.ts:54](https://github.com/paulbarmstrong/optimus-ddb-client/blob/main/src/Types.ts#L54)
