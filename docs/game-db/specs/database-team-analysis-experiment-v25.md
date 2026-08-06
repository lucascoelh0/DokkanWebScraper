# Database Team Analysis experiment v25 (DB26)

DB26 maps causality type `49` to the minimum native operation `current_attack_special_category_mask_intersection`. The handler reads `cau_val1`, intersects its low 8 bits with `CardSpecial::Category::Attribute`, and ignores `cau_val2/3`. The native category constructor independently ties that attribute to `special_categories.raw_attribute` at object offset 8.

The experimental contract consumes the structured `special_categories(id, raw_attribute, name)` table. IDs and attributes are canonical numeric identity; names remain localized text. Current attributes `1`, `2`, and `4` map to `Ki Blast`, `Unarmed`, and `Physical`. All 83 occurrences across 34 states resolve to a supported selector.

Activation remains partial. The handler has an `AdditionalParam` byte gate, while event direction, attacker/target role, timing, recurrence and calculation bucket are not statically proved. DB26 must not be interpreted as a complete nullification or incoming-attack predicate.
