# Lichess Position Training Desktop Fit

The previous viewport subtraction still allowed the board to exceed the modal's real content area.

This correction:

- fixes the desktop dialog to the available viewport height;
- gives the content row the exact remaining height after the header;
- reserves grid rows for feedback, explanation, and action buttons;
- fits the square board inside only the remaining first row;
- keeps the sidebar independently scrollable;
- compacts spacing on desktop screens at or below 850px high.
