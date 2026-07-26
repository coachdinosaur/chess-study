# Lesson Main Lines, Variations, and Sub-Variations

This document defines how the main app records and presents branching lesson lines in Study and Analysis.

## Main-line rule

Every position may have one preferred continuation.

- The first move recorded from a position becomes that position's main line.
- A later new move from the same position is added as a variation.
- Opening or replaying a variation does not automatically promote it.
- Main-line changes require the explicit **Make main line** action.

This rule applies independently at every position in the tree. A move can therefore be the main continuation inside a side variation without becoming part of the lesson's top-level main line.

## Quick example

1. Record `1.e4` from the starting position. It becomes the main line.
2. Return to the starting position and record `1.d4`. It remains a variation.
3. Click `1.d4`. Merely opening it does not change the saved main line.
4. Click **Make main line** only when `1.d4` should become preferred. The former `1.e4` line remains stored as a variation.
5. Enter either branch and record a different continuation later in the line to create a sub-variation.

## Make main line

When the selected move has siblings and is not currently preferred, the notation area shows **Make main line**. Main-line moves display a status badge instead of a promotion button. Main-line moves display a status badge instead of a promotion button.

Selecting it:

1. makes that move the preferred child of its parent position;
2. keeps the former main continuation as a variation;
3. updates forward navigation and selected-line practice;
4. changes PGN export ordering without deleting any branch;
5. preserves all descendant moves, comments, and sub-variations.

The action promotes only the selected move at its immediate branch point. It does not rewrite unrelated earlier or later branch choices.

## Creating variations

To create a side variation:

1. navigate to the position where the branch begins;
2. play a move that is not already recorded there;
3. the new move is stored as a variation when that position already has a main continuation;
4. continue playing to extend that variation.

Following an already-recorded variation selects it for viewing but does not make it the preferred continuation.

## Creating sub-variations

Sub-variations use the same process at any depth:

1. enter an existing variation;
2. navigate to a position inside that variation;
3. play a different move from that position;
4. the new move appears as a nested variation;
5. use **Make main line** there only when that nested move should become the preferred continuation at that local branch point.

There is no special sub-variation file type or separate storage system. The lesson is one recursive move tree, so branches can be nested to any practical depth.

## Study and Analysis behavior

- **Analysis** remains the primary editing workspace.
- **Study** can navigate the same tree and use **Make main line** without exposing the full tools panel.
- Clicking notation moves is navigation, not promotion.
- Left and Right Arrow navigation follows the saved preferred continuation.
- Selected-line practice follows the saved main-line choices.
- Branch drill accepts any recorded child move from the selected position.

## Comments and PGN punctuation

The app's notation view displays comments as styled prose without surrounding punctuation.

PGN files retain standard syntax:

```text
1. e4 {Controls the centre.} (1. d4 d5) 1... e5
```

- `{comment}` is a PGN comment.
- `(variation)` is a recursive annotation variation.
- Nested parentheses represent sub-variations.

Parentheses cannot replace comment braces in exported PGN because PGN readers interpret parentheses as moves branching from the current position. The app may hide braces visually, but its import and export must preserve the standard distinction.

## Persistence and compatibility

Main-line selection is stored through each parent node's `selectedChildId`.

Existing lesson files remain compatible:

- a valid saved `selectedChildId` remains authoritative;
- when it is missing, the first valid child is treated as the main line;
- side variations and sub-variations remain in each node's `children` array;
- no schema-version change is required;
- PGN import keeps the first imported continuation as the main line and later continuations as variations.

## Validation checklist

1. Record a first move and confirm that it becomes the main line.
2. Return to the same position and record another move.
3. Confirm that the new move appears as a variation and does not replace forward navigation.
4. Select the variation and confirm that merely opening it does not promote it.
5. Select **Make main line** and confirm that forward navigation follows it.
6. Add a branch inside that variation and confirm that it appears as a sub-variation.
7. Save and reopen the lesson and confirm that all preferred branches remain selected.
8. Export PGN and confirm comments use braces while variations and sub-variations use parentheses.

Implementation validation is automated in the lesson interoperability workflow.
