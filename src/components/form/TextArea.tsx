import React, { forwardRef } from "react";

interface TextAreaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      value,
      onChange,
      placeholder,
      className = "",
      rows = 4,
      name,
      disabled,
      autoFocus,
      ...rest
    },
    ref
  ) => {
    return (
      <textarea
        ref={ref}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        rows={rows}
        className={`w-full bg-zinc-900 border rounded p-2 resize-none border-zinc-600 cursor-text ${className}`}
        {...rest}
      />
    );
  }
);

export default TextArea;
