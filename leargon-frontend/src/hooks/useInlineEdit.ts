import { useState, useCallback } from 'react';

const UNSET = Symbol('UNSET');

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
  const [editValue, setEditValueState] = useState<T | typeof UNSET>(UNSET);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = useCallback((currentValue: T) => {
    setEditValueState(currentValue);
    setIsEditing(true);
    setError(null);
  }, []);

  const cancel = useCallback(() => {
    setIsEditing(false);
    setEditValueState(UNSET);
    setError(null);
  }, []);

  const setEditValue = useCallback((value: T) => {
    setEditValueState(value);
  }, []);

  const save = useCallback(async () => {
    if (editValue === UNSET) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(editValue as T);
      setIsEditing(false);
      setEditValueState(UNSET);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [editValue, onSave]);

  return {
    isEditing,
    editValue: editValue === UNSET ? null : (editValue as T | null),
    isSaving,
    error,
    startEdit,
    setEditValue,
    save,
    cancel,
  };
}
