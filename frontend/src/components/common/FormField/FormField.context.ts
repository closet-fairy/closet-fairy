import { createContext } from 'react';

interface FormFieldContextValue {
  labelId: string;
  hintId?: string;
}

export const FormFieldContext = createContext<FormFieldContextValue | null>(
  null,
);
