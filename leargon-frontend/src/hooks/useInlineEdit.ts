import { useState, useCallback } from 'react';

interface UseInlineEditOptions<T> {
  onSave: (value: T) => Promise<void>;
}

interface UseInlineEditReturn<T> {
  isEditing: boolean;
  editValue: T | null;
  isSaving: boolean;
  error: string | null;
  startEdit: (currentValue: T) => void;
  setEditValue: (value: T) => void;
  save: () => Promise<void>;
  cancel: () => void;
}

export function useInlineEdit<T>({ onSave }: UseInlineEditOptions<T>): UseInlineEditReturn<T> {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<T | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = useCallback((currentValue: T) => {
    setEditValue(currentValue);
    setIsEditing(true);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    setIsEditing(false);
    setEditValue(null);
    setError(null);
  }, []);

  const save = useCallback(async () => {
    if (editValue === null) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(editValue);
      setIsEditing(false);
      setEditValue(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [editValue, onSave]);

  return { isEditing, editValue, isSaving, error, startEdit, setEditValue, save, cancel };
}
