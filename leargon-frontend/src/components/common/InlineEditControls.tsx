import React from 'react';
import { Box, IconButton, CircularProgress } from '@mui/material';
import { Edit, Check, Close } from '@mui/icons-material';

interface InlineEditControlsProps {
  /** Whether the current user may start editing this section. */
  canEdit: boolean;
  /** A `useInlineEdit` handle (only the fields used here are required). */
  edit: { isEditing: boolean; isSaving: boolean; save: () => void; cancel: () => void };
  /** Begin editing — wraps the section-specific `startEdit(...)` call. */
  onStart: () => void;
}

/**
 * Right-aligned edit / save / cancel controls for the top of an accordion section body.
 *
 * These live in `AccordionDetails` rather than `AccordionSummary`: MUI's `AccordionSummary` renders a
 * real `<button>`, so an `IconButton` placed inside it produces an invalid nested `<button>`. Keeping
 * the controls in the body matches the Business Entity / Process detail panels.
 */
const InlineEditControls: React.FC<InlineEditControlsProps> = ({ canEdit, edit, onStart }) => (
  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mb: 1 }}>
    {canEdit && !edit.isEditing && (
      <IconButton size="small" onClick={onStart}>
        <Edit fontSize="small" />
      </IconButton>
    )}
    {edit.isEditing && (
      <>
        <IconButton size="small" color="primary" onClick={edit.save} disabled={edit.isSaving}>
          {edit.isSaving ? <CircularProgress size={16} /> : <Check fontSize="small" />}
        </IconButton>
        <IconButton size="small" onClick={edit.cancel} disabled={edit.isSaving}>
          <Close fontSize="small" />
        </IconButton>
      </>
    )}
  </Box>
);

export default InlineEditControls;
