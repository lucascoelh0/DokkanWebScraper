# Passive Analysis Roadmap

## Goal

Move from display-oriented passive text to machine-usable passive semantics without losing the original DokkanInfo wording.

## Recommended Model

Keep three layers:

1. Source layer
- passive name
- original multi-line text
- original lines

2. Normalized layer
- cleaned lines
- section labels such as `Basic effect(s)` or `When attacking`
- trigger groups

3. Semantic layer
- typed effects such as `atk_percent`, `def_percent`, `damage_reduction_percent`, `guard`, `crit_chance_percent`
- trigger conditions such as `on_entry`, `when_attacking`, `slot_1`, `hp_below`, `category_ally_present`

## Suggested Future Interfaces

```ts
interface ParsedPassive {
  name?: string;
  text: string;
  lines: string[];
  sections: PassiveSection[];
  effects: PassiveEffect[];
}

interface PassiveSection {
  label?: string;
  trigger?: string;
  lines: string[];
}

interface PassiveEffect {
  kind: string;
  target?: string;
  value?: number;
  unit?: "percent" | "flat" | "boolean" | "ki";
  chance?: number;
  duration?: string;
  trigger?: string;
  sourceLine: string;
}
```

## Suggested Delivery Order

1. Keep scraping `PassiveDetails` only.
2. Add section splitting for multi-line passives.
3. Add effect extraction for the most common stats:
- ATK
- DEF
- Ki
- damage reduction
- critical hit chance
- additional Super Attack chance
- guard
- evade chance
4. Add trigger extraction:
- start of turn
- when attacking
- when receiving attack
- slot 1 / slot 2 / slot 3
- category ally checks
- HP threshold checks
5. Add transformation, standby, domain, and active skill semantic parsing if needed.

## Important Constraint

Do not replace the original scraped text with parsed output.
Parsed passive data should be additive.
The raw DokkanInfo wording must remain available for display and debugging.
