import { createContext, useContext } from 'react';

// User pages use their original loading markup from 55a4038f. New generic
// placeholders are suppressed there; the admin interface keeps its own states.
export const LegacyVisualContext = createContext(false);
export const useLegacyVisuals = () => useContext(LegacyVisualContext);
